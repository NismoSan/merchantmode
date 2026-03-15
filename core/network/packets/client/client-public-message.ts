import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ClientOpCode } from '../op-codes';

export enum PublicMessageType {
  Say = 0,
  Shout = 1,
  Chant = 2,
}

export class ClientPublicMessage implements Packet {
  readonly opCode = ClientOpCode.PublicMessage;
  messageType: PublicMessageType = PublicMessageType.Say;
  content: string = '';

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.messageType);
    writer.writeString8(this.content);
  }

  deserialize(reader: BinaryReader): void {
    this.messageType = reader.readUint8();
    this.content = reader.readString8();
  }
}
