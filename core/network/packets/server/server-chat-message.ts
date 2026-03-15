import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ServerOpCode } from '../op-codes';

export class ServerChatMessage implements Packet {
  readonly opCode = ServerOpCode.ChatMessage;
  messageType: number = 0;
  senderId: number = 0;
  message: string = '';

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.messageType);
    writer.writeUint32(this.senderId);
    writer.writeString8(this.message);
  }

  deserialize(reader: BinaryReader): void {
    this.messageType = reader.readUint8();
    this.senderId = reader.readUint32();
    this.message = reader.readString8();
  }
}
