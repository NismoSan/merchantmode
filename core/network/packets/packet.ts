import type { BinaryReader } from '../serialization/binary-reader';
import type { BinaryWriter } from '../serialization/binary-writer';

export interface Packet {
  readonly opCode: number;
  serialize(writer: BinaryWriter): void;
  deserialize(reader: BinaryReader): void;
}
