import type { BinaryReader } from './binary-reader';
import type { BinaryWriter } from './binary-writer';

export interface Serializable {
  serialize(writer: BinaryWriter): void;
  deserialize(reader: BinaryReader): void;
}
