import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ClientOpCode } from '../op-codes';

export class ClientWhisper implements Packet {
  readonly opCode = ClientOpCode.Whisper;
  target: string = '';
  content: string = '';

  serialize(writer: BinaryWriter): void {
    writer.writeString8(this.target);
    writer.writeString8(this.content);
  }

  deserialize(reader: BinaryReader): void {
    this.target = reader.readString8();
    this.content = reader.readString8();
  }
}
