import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ServerOpCode } from '../op-codes';
import { ExchangeServerEvent, ExchangeParty } from './exchange-types';

export class ServerExchange implements Packet {
  readonly opCode = ServerOpCode.Exchange;
  event: ExchangeServerEvent = ExchangeServerEvent.Cancelled;

  // Started
  targetId: number = 0;
  targetName: string = '';

  // QuantityPrompt
  promptSlot: number = 0;

  // ItemAdded
  party: ExchangeParty = ExchangeParty.You;
  itemIndex: number = 0;
  itemSprite: number = 0;
  itemColor: number = 0;
  itemName: string = '';

  // GoldAdded
  goldAmount: number = 0;

  // Cancelled / Accepted
  message: string = '';

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.event);

    switch (this.event) {
      case ExchangeServerEvent.Started:
        writer.writeUint32(this.targetId);
        writer.writeString8(this.targetName);
        break;
      case ExchangeServerEvent.QuantityPrompt:
        writer.writeUint8(this.promptSlot);
        break;
      case ExchangeServerEvent.ItemAdded:
        writer.writeUint8(this.party);
        writer.writeUint8(this.itemIndex);
        writer.writeUint16(this.itemSprite);
        writer.writeUint8(this.itemColor);
        writer.writeString8(this.itemName);
        break;
      case ExchangeServerEvent.GoldAdded:
        writer.writeUint8(this.party);
        writer.writeUint32(this.goldAmount);
        break;
      case ExchangeServerEvent.Cancelled:
      case ExchangeServerEvent.Accepted:
        writer.writeUint8(this.party);
        writer.writeString8(this.message);
        break;
    }
  }

  deserialize(reader: BinaryReader): void {
    this.event = reader.readUint8();

    switch (this.event) {
      case ExchangeServerEvent.Started:
        this.targetId = reader.readUint32();
        this.targetName = reader.readString8();
        break;
      case ExchangeServerEvent.QuantityPrompt:
        this.promptSlot = reader.readUint8();
        break;
      case ExchangeServerEvent.ItemAdded:
        this.party = reader.readUint8();
        this.itemIndex = reader.readUint8();
        this.itemSprite = reader.readUint16();
        this.itemColor = reader.readUint8();
        this.itemName = reader.readString8();
        break;
      case ExchangeServerEvent.GoldAdded:
        this.party = reader.readUint8();
        this.goldAmount = reader.readUint32();
        break;
      case ExchangeServerEvent.Cancelled:
      case ExchangeServerEvent.Accepted:
        this.party = reader.readUint8();
        if (reader.remaining() > 0) {
          this.message = reader.readString8();
        }
        break;
    }
  }
}
