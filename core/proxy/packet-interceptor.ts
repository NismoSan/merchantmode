import { EventEmitter } from 'events';
import { ClientCrypto } from '../network/encryption/client-crypto';
import { ServerCrypto } from '../network/encryption/server-crypto';
import { ServerOpCode, ClientOpCode } from '../network/packets/op-codes';
import { ConnectionState, ConnectionPhase } from './connection-state';

const SYNC_BYTE = 0xAA;

/**
 * Intercepts packets flowing through the proxy.
 *
 * Uses Arbiter's model: intercept-decrypt-reencrypt.
 * For each direction we maintain an encryptor to decrypt incoming packets
 * and re-encrypt them (or forward the original bytes for pass-through).
 *
 * Critical packets (ConnectionInfo, Redirect, ClientAuth) are handled
 * to update crypto state and rewrite redirect addresses.
 */
export class PacketInterceptor extends EventEmitter {
  connectionState = new ConnectionState();

  // Crypto for decrypting/encrypting in each direction
  private clientEncryptor: ClientCrypto;
  private serverEncryptor: ServerCrypto;

  // Sequence counters (ordinals) for each direction
  private clientSequence: number = 0;
  private serverSequence: number = 0;

  // Buffers for TCP stream reassembly
  private clientBuffer: Buffer = Buffer.alloc(0);
  private serverBuffer: Buffer = Buffer.alloc(0);

  // The local proxy endpoint for rewriting redirects
  private localPort: number;

  constructor(localPort: number = 2610) {
    super();
    this.localPort = localPort;
    // Initialize with default -- will be updated on ConnectionInfo
    this.clientEncryptor = new ClientCrypto(0);
    this.serverEncryptor = new ServerCrypto(0);
  }

  /**
   * Reset crypto state for a new connection (e.g. after redirect).
   */
  resetForNewConnection(): void {
    this.clientBuffer = Buffer.alloc(0);
    this.serverBuffer = Buffer.alloc(0);
    this.clientSequence = 0;
    this.serverSequence = 0;
  }

  /**
   * Intercept client->server data. Returns data to forward (may be modified).
   */
  interceptClientToServer(data: Buffer): Buffer {
    this.clientBuffer = Buffer.concat([this.clientBuffer, data]);
    return this.processClientBuffer();
  }

  /**
   * Intercept server->client data. Returns data to forward (may be modified).
   */
  interceptServerToClient(data: Buffer): Buffer {
    this.serverBuffer = Buffer.concat([this.serverBuffer, data]);
    return this.processServerBuffer();
  }

  /**
   * Encode a raw packet payload for injection as a client packet.
   * rawPayload: [opCode, ...data]
   */
  encodeClientPacket(rawPayload: Uint8Array): Buffer {
    const opCode = rawPayload[0];
    const packetData = rawPayload.subarray(1);

    // Encrypt using the server encryptor (encrypts client->server direction)
    const encrypted = this.serverEncryptor.encrypt(Buffer.from(packetData), opCode);

    const length = encrypted.length + 1; // +1 for opcode
    const frame = Buffer.alloc(length + 3); // +3 for sync + 2 length bytes
    frame[0] = SYNC_BYTE;
    frame[1] = (length >> 8) & 0xff;
    frame[2] = length & 0xff;
    frame[3] = opCode;
    frame.set(encrypted, 4);

    return frame;
  }

  private processClientBuffer(): Buffer {
    const outputChunks: Buffer[] = [];

    while (this.clientBuffer.length >= 4) {
      if (this.clientBuffer[0] !== SYNC_BYTE) {
        this.clientBuffer = this.clientBuffer.subarray(1);
        continue;
      }

      const length = (this.clientBuffer[1] << 8) | this.clientBuffer[2];
      const totalLength = length + 3; // sync + 2 length bytes + payload

      if (this.clientBuffer.length < totalLength) break;

      const packetFrame = this.clientBuffer.subarray(0, totalLength);
      const opCode = this.clientBuffer[3];
      const encryptedData = this.clientBuffer.subarray(4, totalLength);

      // Decrypt for inspection using serverEncryptor (decrypts client->server)
      try {
        const decrypted = this.serverEncryptor.decrypt(
          Uint8Array.from(encryptedData), opCode
        );

        // Handle ClientAuthenticate (opcode 0x10) - unencrypted, contains crypto params
        if (opCode === ClientOpCode.Login) {
          this.handleClientAuth(encryptedData);
        }

        this.emit('packet', 'client', opCode, decrypted);
      } catch {
        // Some client packets are unencrypted (opcode 0x00 Version, 0x10 Auth, 0x48 CancelCast)
        if (opCode === ClientOpCode.Login) {
          this.handleClientAuth(encryptedData);
        }
        this.emit('packet', 'client', opCode, encryptedData);
      }

      // Forward original bytes
      outputChunks.push(Buffer.from(packetFrame));
      this.clientBuffer = this.clientBuffer.subarray(totalLength);
    }

    return outputChunks.length > 0 ? Buffer.concat(outputChunks) : Buffer.alloc(0);
  }

  private processServerBuffer(): Buffer {
    const outputChunks: Buffer[] = [];

    while (this.serverBuffer.length >= 4) {
      if (this.serverBuffer[0] !== SYNC_BYTE) {
        this.serverBuffer = this.serverBuffer.subarray(1);
        continue;
      }

      const length = (this.serverBuffer[1] << 8) | this.serverBuffer[2];
      const totalLength = length + 3;

      if (this.serverBuffer.length < totalLength) break;

      const opCode = this.serverBuffer[3];
      const encryptedData = Buffer.from(this.serverBuffer.subarray(4, totalLength));

      // Handle special unencrypted packets BEFORE decryption
      if (opCode === ServerOpCode.ConnectionInfo) {
        // ConnectionInfo (0x00) is unencrypted
        this.handleConnectionInfo(encryptedData);
        this.emit('packet', 'server', opCode, encryptedData);
        outputChunks.push(Buffer.from(this.serverBuffer.subarray(0, totalLength)));
        this.serverBuffer = this.serverBuffer.subarray(totalLength);
        continue;
      }

      if (opCode === ServerOpCode.AcceptConnection) {
        // AcceptConnection (0x7E) is unencrypted
        this.connectionState.phase = ConnectionPhase.CONNECTED;
        this.emit('packet', 'server', opCode, encryptedData);
        outputChunks.push(Buffer.from(this.serverBuffer.subarray(0, totalLength)));
        this.serverBuffer = this.serverBuffer.subarray(totalLength);
        continue;
      }

      if (opCode === ServerOpCode.Redirect) {
        // Redirect (0x03) is unencrypted
        const modifiedFrame = this.handleRedirect(
          Buffer.from(this.serverBuffer.subarray(0, totalLength))
        );
        this.emit('packet', 'server', opCode, encryptedData);
        outputChunks.push(modifiedFrame);
        this.serverBuffer = this.serverBuffer.subarray(totalLength);
        continue;
      }

      // Normal encrypted packet - decrypt for inspection
      try {
        const decrypted = this.clientEncryptor.decrypt(
          Uint8Array.from(encryptedData), opCode
        );

        // Track UserId (0x05) for login state
        if (opCode === ServerOpCode.UserId) {
          this.connectionState.isLoggedIn = true;
          this.connectionState.phase = ConnectionPhase.IN_GAME;
        }

        this.emit('packet', 'server', opCode, decrypted);
      } catch {
        this.emit('packet', 'server', opCode, encryptedData);
      }

      // Forward original bytes
      outputChunks.push(Buffer.from(this.serverBuffer.subarray(0, totalLength)));
      this.serverBuffer = this.serverBuffer.subarray(totalLength);
    }

    return outputChunks.length > 0 ? Buffer.concat(outputChunks) : Buffer.alloc(0);
  }

  /**
   * ConnectionInfo (Server opcode 0x00) - unencrypted
   * Format: skip(1), checksum(u32), seed(u8), keyLength(u8), key(bytes)
   */
  private handleConnectionInfo(data: Buffer): void {
    try {
      let offset = 0;
      offset += 1; // skip unknown byte
      offset += 4; // skip checksum (u32)
      const seed = data[offset++];
      const keyLength = data[offset++];
      const key = data.subarray(offset, offset + keyLength);

      this.setEncryptionParameters(seed, key);
      this.connectionState.seed = seed;
      this.connectionState.phase = ConnectionPhase.AUTHENTICATED;

      console.log(`[Interceptor] Crypto initialized: seed=${seed}, keyLen=${keyLength}`);
    } catch (err) {
      console.error('[Interceptor] Failed to parse ConnectionInfo:', err);
    }
  }

  /**
   * ClientAuthenticate (Client opcode 0x10) - unencrypted
   * Format: seed(u8), keyLength(u8), key(bytes), name(string8), connectionId(u32)
   */
  private handleClientAuth(data: Buffer): void {
    try {
      let offset = 0;
      const seed = data[offset++];
      const keyLength = data[offset++];
      const key = data.subarray(offset, offset + keyLength);
      offset += keyLength;

      // Read character name (string8: length byte + string)
      const nameLength = data[offset++];
      const name = data.subarray(offset, offset + nameLength).toString('ascii');
      offset += nameLength;

      // connectionId = data.readUInt32BE(offset);

      this.connectionState.characterName = name;
      this.setEncryptionParameters(seed, key, name);

      console.log(`[Interceptor] Client auth: name=${name}, seed=${seed}`);
    } catch (err) {
      console.error('[Interceptor] Failed to parse ClientAuth:', err);
    }
  }

  /**
   * Redirect (Server opcode 0x03) - unencrypted
   * Format: ip(4 bytes), port(u16), remainingCount(u8), seed(u8), keyLen(u8), key(bytes), name(string8), connId(u32)
   *
   * Returns MODIFIED frame with localhost IP/port substituted.
   */
  private handleRedirect(frame: Buffer): Buffer {
    try {
      const data = frame.subarray(4); // skip sync + length + opcode

      // Parse original target
      const b1 = data[0], b2 = data[1], b3 = data[2], b4 = data[3];
      const port = (data[4] << 8) | data[5];
      const host = `${b1}.${b2}.${b3}.${b4}`;

      // Parse crypto params
      let offset = 6;
      offset += 1; // remainingCount byte
      const seed = data[offset++];
      const keyLength = data[offset++];
      const key = data.subarray(offset, offset + keyLength);
      offset += keyLength;

      // Read name
      const nameLength = data[offset++];
      const name = data.subarray(offset, offset + nameLength).toString('ascii');

      console.log(`[Interceptor] Redirect: ${host}:${port} -> rewriting to localhost:${this.localPort}, name=${name}`);

      // Update crypto for the next connection
      this.setEncryptionParameters(seed, key, name);
      this.connectionState.characterName = name;
      this.connectionState.phase = ConnectionPhase.REDIRECTING;

      // Reset sequence counters for next connection
      this.clientSequence = 0;
      this.serverSequence = 0;

      // Rewrite the IP in the frame to 127.0.0.1
      // frame layout: [0xAA][lenHi][lenLo][opCode][data...]
      // data[0..3] = IP bytes
      const modified = Buffer.from(frame);
      modified[4] = 127; // IP byte 1
      modified[5] = 0;   // IP byte 2
      modified[6] = 0;   // IP byte 3
      modified[7] = 1;   // IP byte 4
      // data[4..5] = port (big-endian)
      modified[8] = (this.localPort >> 8) & 0xff;
      modified[9] = this.localPort & 0xff;

      // Emit the REAL redirect target so proxy-server can queue it
      this.emit('redirect', host, port);

      return modified;
    } catch (err) {
      console.error('[Interceptor] Failed to parse Redirect:', err);
      return frame;
    }
  }

  /**
   * Update encryption parameters for both directions.
   */
  private setEncryptionParameters(seed: number, key: Buffer | Uint8Array, name?: string): void {
    this.clientEncryptor = new ClientCrypto(seed);
    this.serverEncryptor = new ServerCrypto(seed);

    if (key.length > 0) {
      const keyStr = Buffer.from(key).toString('ascii');
      this.clientEncryptor.key = keyStr;
      this.serverEncryptor.key = keyStr;
    }

    if (name) {
      this.clientEncryptor.keySalts = name;
      this.serverEncryptor.keySalts = name;
    }

    // Reset ordinals on crypto change
    this.clientEncryptor.currentOrdinal = 0;
    this.serverEncryptor.currentOrdinal = 0;
  }
}
