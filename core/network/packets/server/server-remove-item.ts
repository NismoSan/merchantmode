import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ServerOpCode } from '../op-codes';

export class ServerRemoveItem implements Packet {
  readonly opCode = ServerOpCode.RemoveItemFromPane;
  slot: number = 0;

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.slot);
  }

  deserialize(reader: BinaryReader): void {
    this.slot = reader.readUint8();
  }
}
