import type { Serializable } from './serializable';

export class PacketReadError extends Error {
  constructor(type: string, size: number, offset: number, bufferLength: number) {
    super(
      `Read past end of packet: tried to read ${type} (${size} bytes) at offset ${offset}, ` +
      `but packet is only ${bufferLength} bytes`
    );
    this.name = 'PacketReadError';
  }
}

export class BinaryReader {
  private buffer: Buffer;
  public offset: number;

  constructor(data: Uint8Array) {
    this.buffer = Buffer.from(data);
    this.offset = 0;
  }

  private ensureBytes(type: string, size: number): void {
    if (this.offset + size > this.buffer.byteLength) {
      throw new PacketReadError(type, size, this.offset, this.buffer.byteLength);
    }
  }

  readUint8(): number {
    this.ensureBytes('uint8', 1);
    const value = this.buffer.readUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    this.ensureBytes('uint16', 2);
    const value = this.buffer.readUint16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    this.ensureBytes('uint32', 4);
    const value = this.buffer.readUint32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readInt8(): number {
    this.ensureBytes('int8', 1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    this.ensureBytes('int16', 2);
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt32(): number {
    this.ensureBytes('int32', 4);
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readString(length?: number): string {
    if (!length) {
      length = this.buffer.byteLength - this.offset;
    }
    this.ensureBytes('string', length);
    const value = this.buffer.toString('ascii', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readString8(): string {
    const length = this.readUint8();
    return this.readString(length);
  }

  readString16(): string {
    const length = this.readUint16();
    return this.readString(length);
  }

  readBoolean(): boolean {
    return this.readUint8() === 1;
  }

  readBytes(length?: number): Uint8Array {
    if (!length) {
      length = this.buffer.byteLength - this.offset;
    }
    this.ensureBytes('bytes', length);
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readBytes8(): Uint8Array {
    const length = this.readUint8();
    return this.readBytes(length);
  }

  readSerializable<T extends Serializable>(ctor: new () => T): T {
    const instance = new ctor();
    instance.deserialize(this);
    return instance;
  }

  remaining(): number {
    return this.buffer.byteLength - this.offset;
  }
}
