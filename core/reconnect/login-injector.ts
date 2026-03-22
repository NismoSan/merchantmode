import { ProxyConnection } from '../proxy/proxy-connection';
import { ClientOpCode } from '../network/packets/op-codes';

// CRC16 table used by the DA protocol (same as Nexon CRC16)
const CRC16_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
  0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6,
  0x9339, 0x8318, 0xB37B, 0xA35A, 0xD3BD, 0xC39C, 0xF3FF, 0xE3DE,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485,
  0xA56A, 0xB54B, 0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4,
  0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC,
  0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B,
  0x5AF5, 0x4AD4, 0x7AB7, 0x6A96, 0x1A71, 0x0A50, 0x3A33, 0x2A12,
  0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A,
  0x6CA6, 0x7C87, 0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41,
  0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49,
  0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70,
  0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A, 0x9F59, 0x8F78,
  0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F,
  0x1080, 0x00A1, 0x30C2, 0x20E3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E,
  0x02B1, 0x1290, 0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D,
  0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E, 0xC71D, 0xD73C,
  0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xD94C, 0xC96D, 0xF90E, 0xE92F, 0x99C8, 0x89E9, 0xB98A, 0xA9AB,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3,
  0xCB7D, 0xDB5C, 0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A,
  0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92,
  0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9,
  0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83, 0x1CE0, 0x0CC1,
  0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8,
  0x6E17, 0x7E36, 0x4E55, 0x5E74, 0x2E93, 0x3EB2, 0x0ED1, 0x1EF0,
];

function u8(v: number): number { return v & 0xFF; }
function u16(v: number): number { return v & 0xFFFF; }
function u32(v: number): number { return v >>> 0; }

function calculateCRC16(buffer: number[], index: number, length: number): number {
  let crc = 0;
  for (let i = index; i < index + length; i++) {
    crc = u16(buffer[i] ^ (u16(crc << 8) ^ u16(CRC16_TABLE[crc >> 8])));
  }
  return crc;
}

function random(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

/**
 * Constructs the decrypted payload for a Login (0x03) packet.
 * Matches DASB's client.js logIn() method exactly.
 * The proxy's injectClientPacket() handles encryption.
 */
function buildLoginPayload(username: string, password: string): Uint8Array {
  const key1 = random(0xFF);
  const key2 = random(0xFF);
  let clientId = random(0xFFFFFFFF);

  // Encode clientId with key2-derived key
  const clientIdKey = u8(key2 + 138);
  const clientIdArray = [
    clientId & 0xFF,
    (clientId >> 8) & 0xFF,
    (clientId >> 16) & 0xFF,
    (clientId >> 24) & 0xFF,
  ];

  let clientIdChecksum = u16(calculateCRC16(clientIdArray, 0, 4));
  const clientIdChecksumKey = u8(key2 + 0x5E);
  clientIdChecksum ^= u16(clientIdChecksumKey | ((clientIdChecksumKey + 1) << 8));
  clientId ^= u32(clientIdKey | ((clientIdKey + 1) << 8) | ((clientIdKey + 2) << 16) | ((clientIdKey + 3) << 24));

  let randomValue = random(0xFFFF);
  const randomValueKey = u8(key2 + 115);
  randomValue ^= u32(randomValueKey | ((randomValueKey + 1) << 8) | ((randomValueKey + 2) << 16) | ((randomValueKey + 3) << 24));

  // Build the payload as a byte array
  const payload: number[] = [];

  // String8(username)
  payload.push(username.length);
  for (let i = 0; i < username.length; i++) payload.push(username.charCodeAt(i));

  // String8(password)
  payload.push(password.length);
  for (let i = 0; i < password.length; i++) payload.push(password.charCodeAt(i));

  // key1, key2 XOR'd
  payload.push(key1);
  payload.push(u8(key2 ^ (key1 + 59)));

  // clientId (u32 LE)
  payload.push(clientId & 0xFF);
  payload.push((clientId >> 8) & 0xFF);
  payload.push((clientId >> 16) & 0xFF);
  payload.push((clientId >> 24) & 0xFF);

  // clientIdChecksum (u16 LE)
  payload.push(clientIdChecksum & 0xFF);
  payload.push((clientIdChecksum >> 8) & 0xFF);

  // randomValue (u32 LE)
  payload.push(randomValue & 0xFF);
  payload.push((randomValue >> 8) & 0xFF);
  payload.push((randomValue >> 16) & 0xFF);
  payload.push((randomValue >> 24) & 0xFF);

  // CRC16 over the 12 bytes starting after username+password strings
  // (key1, key2_xored, clientId[4], checksum[2], randomValue[4])
  const crcStart = username.length + password.length + 2; // +2 for length bytes
  let crc = calculateCRC16(payload, crcStart, 12);
  const crcKey = u8(key2 + 165);
  crc ^= u16(crcKey | ((crcKey + 1) << 8));
  payload.push(crc & 0xFF);
  payload.push((crc >> 8) & 0xFF);

  // Fixed trailer (0x01 only — the protocol zero byte is added by encrypt())
  payload.push(0x01);

  return new Uint8Array(payload);
}

/**
 * Inject a Login (0x03) packet through the proxy with saved credentials.
 * Call this after LoginControls (0x66) is received from the server.
 */
export function injectLogin(connection: ProxyConnection, username: string, password: string): void {
  const payload = buildLoginPayload(username, password);
  const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`[Reconnect] Login payload (${payload.length} bytes): ${hex}`);
  connection.injectClientPacket(ClientOpCode.Login, payload);
  console.log(`[Reconnect] Injected login packet for ${username}`);
}
