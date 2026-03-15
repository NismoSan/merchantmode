import { Crypto } from './crypto';
import { EncryptionType } from './encryption-type';
import { generateKey, generateValuePair, getServerEncryptionType, xor } from './utils';

/**
 * Handles SERVER packet encryption/decryption.
 * Matches Arbiter's ServerPacketEncryptor exactly.
 *
 * - decrypt() decrypts packets coming FROM the server
 * - encrypt() encrypts packets going TO the client
 * Both use server encryption types and server bRand/sRand masks.
 */
export class ServerCrypto extends Crypto {
  static isEncrypted(opCode: number): boolean {
    return opCode !== 0x00 && opCode !== 0x03 && opCode !== 0x40 && opCode !== 0x7E;
  }

  private static useStaticKey(opCode: number): boolean {
    return getServerEncryptionType(opCode) === EncryptionType.NORMAL;
  }

  shouldEncrypt(opCode: number): boolean {
    return ServerCrypto.isEncrypted(opCode);
  }

  /**
   * Decrypt a server packet (data after the opcode byte in the frame).
   * Input: [sequence, ...encryptedPayload, bRand_lo, sRand, bRand_hi]
   * Returns: the decrypted payload bytes only.
   */
  decrypt(buffer: Uint8Array, opCode: number): Uint8Array {
    if (!ServerCrypto.isEncrypted(opCode)) {
      return buffer;
    }

    const useHashKey = !ServerCrypto.useStaticKey(opCode);
    let encryptionKey: Uint8Array;

    if (useHashKey) {
      // Read trailing 3 bytes for bRand/sRand (server masks: 0x6474 and 0x24)
      const { a, b } = ServerCrypto.readHashKeySalt(buffer);
      encryptionKey = generateKey(a, b, this.keySaltsBuffer);
    } else {
      encryptionKey = this.keyBuffer;
    }

    // Sequence number is first byte
    const sequence = buffer[0];

    // Arbiter: payloadLength = data.Length - 4 (1 seq + 3 trailing)
    const payloadLength = buffer.length - 4;

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
   * Encrypt a server packet for sending to the client.
   * Input: decrypted payload bytes, opCode, sequence number
   * Returns: encrypted data [sequence, ...encrypted, bRand_lo, sRand, bRand_hi]
   */
  encrypt(buffer: Uint8Array, opCode: number, sequence?: number): Uint8Array {
    if (!ServerCrypto.isEncrypted(opCode)) {
      return buffer;
    }

    const useHashKey = !ServerCrypto.useStaticKey(opCode);
    const { a, b } = generateValuePair();

    let encryptionKey: Uint8Array;
    if (useHashKey) {
      encryptionKey = generateKey(a, b, this.keySaltsBuffer);
    } else {
      encryptionKey = this.keyBuffer;
    }

    const ord = sequence !== undefined ? sequence : this.nextOrdinal();

    // Arbiter layout: [sequence][...encrypted_payload][bRand_lo][sRand][bRand_hi]
    // Total = 1 + payload.length + 3 = payload.length + 4
    const totalLength = buffer.length + 4;
    const encrypted = new Uint8Array(totalLength);

    // Copy sequence and payload
    encrypted[0] = ord;
    for (let i = 0; i < buffer.length; i++) {
      encrypted[1 + i] = buffer[i];
    }

    // Encrypt the payload region (indices 1 through 1+payload.length)
    const encSlice = encrypted.subarray(1, 1 + buffer.length);
    xor(encSlice, encryptionKey, ord, this.seed);

    // Write trailing bRand/sRand (server masks)
    ServerCrypto.writeHashKeySalt(encrypted, a, b);

    return encrypted;
  }

  /** Read bRand/sRand from trailing 3 bytes using SERVER masks */
  static readHashKeySalt(buffer: Uint8Array): { a: number; b: number } {
    const b = (buffer[buffer.length - 2] ^ 0x24) & 0xFF;
    const a = ((buffer[buffer.length - 1] << 8) | buffer[buffer.length - 3]) ^ 0x6474;
    return { a, b };
  }

  /** Write bRand/sRand to trailing 3 bytes using SERVER masks */
  static writeHashKeySalt(buffer: Uint8Array, a: number, b: number): void {
    buffer[buffer.length - 3] = ((a & 0xFF) ^ 0x74) & 0xFF;
    buffer[buffer.length - 2] = (b ^ 0x24) & 0xFF;
    buffer[buffer.length - 1] = (((a >> 8) & 0xFF) ^ 0x64) & 0xFF;
  }
}
