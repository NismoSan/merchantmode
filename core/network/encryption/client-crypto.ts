import { Crypto } from './crypto';
import { EncryptionType } from './encryption-type';
import { generateKey, generateValuePair, getMd5Hash, getClientEncryptionType, xor } from './utils';

/**
 * Handles CLIENT packet encryption/decryption.
 * Matches Arbiter's ClientPacketEncryptor exactly.
 *
 * - decrypt() decrypts packets coming FROM the client
 * - encrypt() encrypts packets going TO the server
 * Both use client encryption types and client bRand/sRand masks.
 */
export class ClientCrypto extends Crypto {
  static isEncrypted(opCode: number): boolean {
    return opCode !== 0x00 && opCode !== 0x10 && opCode !== 0x48;
  }

  private static useStaticKey(opCode: number): boolean {
    return getClientEncryptionType(opCode) === EncryptionType.NORMAL;
  }

  shouldEncrypt(opCode: number): boolean {
    return ClientCrypto.isEncrypted(opCode);
  }

  /**
   * Decrypt a client packet (data after the opcode byte in the frame).
   * Input: the encrypted data portion [sequence, ...encryptedPayload, ...trailer]
   * Returns: the decrypted payload bytes only.
   */
  decrypt(buffer: Uint8Array, opCode: number): Uint8Array {
    if (!ClientCrypto.isEncrypted(opCode)) {
      return buffer;
    }

    const useHashKey = !ClientCrypto.useStaticKey(opCode);
    let encryptionKey: Uint8Array;

    if (useHashKey) {
      // Read trailing 3 bytes for bRand/sRand (client masks: 0x7470 and 0x23)
      const { a, b } = ClientCrypto.readHashKeySalt(buffer);
      encryptionKey = generateKey(a, b, this.keySaltsBuffer);
    } else {
      encryptionKey = this.keyBuffer;
    }

    // Sequence number is first byte
    const sequence = buffer[0];

    // Payload length: total - sequence(1) - trailing(3) - checksum(4) - zero+cmd?(useHashKey ? 2 : 1)
    // Arbiter: payloadLength = data.Length - (useHashKey ? 10 : 9)
    const payloadLength = buffer.length - (useHashKey ? 10 : 9);

    // Extract and copy the encrypted payload (starts at byte 1)
    const decrypted = new Uint8Array(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      decrypted[i] = buffer[1 + i];
    }

    // XOR decrypt
    xor(decrypted, encryptionKey, sequence, this.seed);

    return decrypted;
  }

  /**
   * Encrypt a client packet for sending to the server.
   * Input: decrypted payload bytes, opCode, sequence number
   * Returns: encrypted data (everything after opcode in the frame: [seq, encrypted, zero, cmd?, checksum, a_lo, s, a_hi])
   */
  encrypt(buffer: Uint8Array, opCode: number, sequence?: number): Uint8Array {
    if (!ClientCrypto.isEncrypted(opCode)) {
      return buffer;
    }

    const useHashKey = !ClientCrypto.useStaticKey(opCode);
    const { a, b } = generateValuePair();

    let encryptionKey: Uint8Array;
    if (useHashKey) {
      encryptionKey = generateKey(a, b, this.keySaltsBuffer);
    } else {
      encryptionKey = this.keyBuffer;
    }

    const ord = sequence !== undefined ? sequence : this.nextOrdinal();

    // Build the full encrypted buffer
    // Arbiter layout: [command][sequence][...dialog?][...payload][0x00][command?][checksum x4][a_lo][s][a_hi]
    // We don't include command in our data (it's the frame opcode), so:
    // [sequence][...payload][0x00][command?][checksum x4][a_lo][s][a_hi]
    // Total = 1(seq) + payload + 1(zero) + (useHashKey ? 1 : 0)(cmd) + 4(checksum) + 3(rand) = payload + 9 or 10
    const totalLength = buffer.length + (useHashKey ? 10 : 9);
    const encrypted = new Uint8Array(totalLength);

    // For checksum, we need [command, sequence, payload] before encryption
    const checksumInput = new Uint8Array(buffer.length + 2);
    checksumInput[0] = opCode;
    checksumInput[1] = ord;
    checksumInput.set(buffer, 2);

    // Copy sequence and payload
    encrypted[0] = ord;
    encrypted.set(buffer, 1);

    // Set the trailing zero byte and optional command
    const payloadEnd = 1 + buffer.length;
    encrypted[payloadEnd] = 0x00;
    if (useHashKey) {
      encrypted[payloadEnd + 1] = opCode;
    }

    // Arbiter encrypts buffer[2..^7] in its full buffer (which has command at [0]).
    // That covers: payload + zero byte + optional command byte = totalLength - 9 bytes.
    // In our buffer (no command prefix at [0]), the equivalent region is [1..^7].
    // encPayloadLen = (totalLength + 1) - 9 = totalLength - 8, to account for the missing command prefix.
    const encPayloadLen = totalLength - 8;
    const encSlice = encrypted.subarray(1, 1 + encPayloadLen);

    // XOR encrypt the payload region
    xor(encSlice, encryptionKey, ord, this.seed);

    // Now compute MD5 checksum over [command, sequence, encrypted_payload, zero, command?]
    // Arbiter: MD5.HashData(buffer[..^7], checksum) — everything except last 7 bytes
    const checksumRegion = new Uint8Array(totalLength - 7 + 1); // +1 for command prefix
    checksumRegion[0] = opCode;
    for (let i = 0; i < totalLength - 7; i++) {
      checksumRegion[1 + i] = encrypted[i];
    }
    const hash = getMd5Hash(checksumRegion);

    // Write checksum: hash[13], hash[3], hash[11], hash[7]
    encrypted[totalLength - 7] = hash[13];
    encrypted[totalLength - 6] = hash[3];
    encrypted[totalLength - 5] = hash[11];
    encrypted[totalLength - 4] = hash[7];

    // Write trailing bRand/sRand (client masks)
    ClientCrypto.writeHashKeySalt(encrypted, a, b);

    return encrypted;
  }

  /** Read bRand/sRand from trailing 3 bytes using CLIENT masks */
  static readHashKeySalt(buffer: Uint8Array): { a: number; b: number } {
    const b = (buffer[buffer.length - 2] ^ 0x23) & 0xFF;
    const a = ((buffer[buffer.length - 1] << 8) | buffer[buffer.length - 3]) ^ 0x7470;
    return { a, b };
  }

  /** Write bRand/sRand to trailing 3 bytes using CLIENT masks */
  static writeHashKeySalt(buffer: Uint8Array, a: number, b: number): void {
    buffer[buffer.length - 3] = ((a & 0xFF) ^ 0x70) & 0xFF;
    buffer[buffer.length - 2] = (b ^ 0x23) & 0xFF;
    buffer[buffer.length - 1] = (((a >> 8) & 0xFF) ^ 0x74) & 0xFF;
  }
}
