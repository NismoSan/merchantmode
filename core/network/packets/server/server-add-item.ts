import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ServerOpCode } from '../op-codes';

export class ServerAddItem implements Packet {
  readonly opCode = ServerOpCode.AddItemToPane;
  slot: number = 0;
  sprite: number = 0;
  color: number = 0;
  name: string = '';
  quantity: number = 0;
  isStackable: boolean = false;
  maxDurability: number = 0;
  durability: number = 0;

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.slot);
    writer.writeUint16(this.sprite);
    writer.writeUint8(this.color);
    writer.writeString8(this.name);
    writer.writeUint32(this.quantity);
    writer.writeBoolean(this.isStackable);
    writer.writeUint32(this.maxDurability);
    writer.writeUint32(this.durability);
  }

  deserialize(reader: BinaryReader): void {
    this.slot = reader.readUint8();
    this.sprite = reader.readUint16();
    this.color = reader.readUint8();
    this.name = reader.readString8();
    this.quantity = reader.readUint32();
    this.isStackable = reader.readBoolean();
    this.maxDurability = reader.readUint32();
    this.durability = reader.readUint32();
  }
}
