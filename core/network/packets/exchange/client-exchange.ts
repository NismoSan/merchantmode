import type { BinaryReader } from '../../serialization/binary-reader';
import type { BinaryWriter } from '../../serialization/binary-writer';
import type { Packet } from '../packet';
import { ClientOpCode } from '../op-codes';
import { ExchangeClientAction } from './exchange-types';

export class ClientExchange implements Packet {
  readonly opCode = ClientOpCode.Exchange;
  action: ExchangeClientAction = ExchangeClientAction.Cancel;
  targetId: number = 0;
  slot: number = 0;
  quantity: number = 0;
  goldAmount: number = 0;

  serialize(writer: BinaryWriter): void {
    writer.writeUint8(this.action);
    writer.writeUint32(this.targetId);

    switch (this.action) {
      case ExchangeClientAction.AddItem:
        writer.writeUint8(this.slot);
        break;
      case ExchangeClientAction.AddStackableItem:
        writer.writeUint8(this.slot);
        writer.writeUint8(this.quantity);
        break;
      case ExchangeClientAction.SetGold:
        writer.writeUint32(this.goldAmount);
        break;
    }
  }

  deserialize(reader: BinaryReader): void {
    this.action = reader.readUint8();
    this.targetId = reader.readUint32();

    switch (this.action) {
      case ExchangeClientAction.AddItem:
        this.slot = reader.readUint8();
        break;
      case ExchangeClientAction.AddStackableItem:
        this.slot = reader.readUint8();
        this.quantity = reader.readUint8();
        break;
      case ExchangeClientAction.SetGold:
        this.goldAmount = reader.readUint32();
        break;
    }
  }

  static beginExchange(targetId: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.BeginExchange;
    pkt.targetId = targetId;
    return pkt;
  }

  static addItem(targetId: number, slot: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.AddItem;
    pkt.targetId = targetId;
    pkt.slot = slot;
    return pkt;
  }

  static addStackableItem(targetId: number, slot: number, quantity: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.AddStackableItem;
    pkt.targetId = targetId;
    pkt.slot = slot;
    pkt.quantity = quantity;
    return pkt;
  }

  static setGold(targetId: number, amount: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.SetGold;
    pkt.targetId = targetId;
    pkt.goldAmount = amount;
    return pkt;
  }

  static cancel(targetId: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.Cancel;
    pkt.targetId = targetId;
    return pkt;
  }

  static accept(targetId: number): ClientExchange {
    const pkt = new ClientExchange();
    pkt.action = ExchangeClientAction.Accept;
    pkt.targetId = targetId;
    return pkt;
  }
}
