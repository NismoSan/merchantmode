import type { Serializable } from './serializable';

export class BinaryReader {
  private buffer: Buffer;
  public offset: number;

  constructor(data: Uint8Array) {
    this.buffer = Buffer.from(data);
    this.offset = 0;
  }

  readUint8(): number {
    const value = this.buffer.readUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.buffer.readUint16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.buffer.readUint32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readInt8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt32(): number {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readString(length?: number): string {
    if (!length) {
      length = this.buffer.byteLength - this.offset;
    }
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
