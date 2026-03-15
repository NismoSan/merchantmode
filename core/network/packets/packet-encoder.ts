import type { Crypto } from '../encryption/crypto';
import { BinaryReader } from '../serialization/binary-reader';

export interface PacketPayload {
  opCode: number;
  data: Uint8Array;
}

const SYNC_BYTE = 0xAA;

export function encodePacket(payload: PacketPayload, crypto: Crypto): Uint8Array {
  const encrypted = crypto.encrypt(payload.data, payload.opCode);
  const length = encrypted.length + 1;
  const buffer = new Uint8Array(encrypted.length + 4);

  buffer[0] = SYNC_BYTE;
  buffer[1] = (length >> 8) & 0xff;
  buffer[2] = length & 0xff;
  buffer[3] = payload.opCode;
  buffer.set(encrypted, 4);

  return buffer;
}

export interface DecodedPacket {
  opCode: number;
  rawData: Uint8Array;
  decryptedData: Uint8Array;
}

export function decodePackets(buffer: Uint8Array, crypto: Crypto): { packets: DecodedPacket[]; remaining: Uint8Array } {
  const packets: DecodedPacket[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (buffer[offset] !== SYNC_BYTE) {
      offset++;
      continue;
    }

    if (offset + 3 >= buffer.length) break;

    const length = (buffer[offset + 1] << 8) | buffer[offset + 2];
    const totalLength = length + 3;

    if (offset + totalLength > buffer.length) break;

    const opCode = buffer[offset + 3];
    const rawData = buffer.subarray(offset + 4, offset + totalLength);
    let decryptedData: Uint8Array;

    try {
      decryptedData = crypto.decrypt(Uint8Array.from(rawData), opCode);
    } catch {
      decryptedData = rawData;
    }

    packets.push({ opCode, rawData, decryptedData });
    offset += totalLength;
  }

  return { packets, remaining: buffer.subarray(offset) };
}
