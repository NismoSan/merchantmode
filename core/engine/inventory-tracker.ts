import { EventEmitter } from 'events';
import type { InventoryItem, InventoryState } from '../models/inventory';
import { ServerOpCode } from '../network/packets/op-codes';
import { BinaryReader } from '../network/serialization/binary-reader';

export class InventoryTracker extends EventEmitter {
  private state: InventoryState = {
    items: new Map(),
    gold: 0,
    maxSlots: 60,
  };

  getState(): InventoryState {
    return this.state;
  }

  getItem(slot: number): InventoryItem | undefined {
    return this.state.items.get(slot);
  }

  getGold(): number {
    return this.state.gold;
  }

  findSlotByName(name: string): number | undefined {
    for (const [slot, item] of this.state.items) {
      if (item.name.toLowerCase() === name.toLowerCase()) {
        return slot;
      }
    }
    return undefined;
  }

  findAllSlotsByName(name: string): number[] {
    const slots: number[] = [];
    for (const [slot, item] of this.state.items) {
      if (item.name.toLowerCase() === name.toLowerCase()) {
        slots.push(slot);
      }
    }
    return slots;
  }

  hasItem(name: string, quantity: number = 1): boolean {
    let total = 0;
    for (const item of this.state.items.values()) {
      if (item.name.toLowerCase() === name.toLowerCase()) {
        total += item.quantity || 1;
      }
    }
    return total >= quantity;
  }

  getFreeSlots(): number {
    return this.state.maxSlots - this.state.items.size;
  }

  /**
   * Process a decoded server packet to update inventory state.
   */
  processPacket(opCode: number, data: Uint8Array): void {
    switch (opCode) {
      case ServerOpCode.AddItemToPane:
        this.handleAddItem(data);
        break;
      case ServerOpCode.RemoveItemFromPane:
        this.handleRemoveItem(data);
        break;
      case ServerOpCode.Attributes:
        this.handleAttributes(data);
        break;
    }
  }

  private handleAddItem(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const item: InventoryItem = {
        slot: reader.readUint8(),
        sprite: reader.readUint16(),
        color: reader.readUint8(),
        name: reader.readString8(),
        quantity: reader.readUint32(),
        isStackable: reader.readBoolean(),
        maxDurability: reader.readUint32(),
        durability: reader.readUint32(),
      };

      this.state.items.set(item.slot, item);
      console.log(`[InventoryTracker] Item added: slot=${item.slot} name="${item.name}" qty=${item.quantity}`);
      this.emit('itemAdded', item);
    } catch (err) {
      console.error('[InventoryTracker] Failed to parse AddItem:', err);
    }
  }

  private handleRemoveItem(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const slot = reader.readUint8();
      const item = this.state.items.get(slot);
      this.state.items.delete(slot);
      this.emit('itemRemoved', slot, item);
    } catch (err) {
      console.error('[InventoryTracker] Failed to parse RemoveItem:', err);
    }
  }

  private handleAttributes(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const flags = reader.readUint8();

      // Flags bitmask (from Arbiter StatsFieldFlags):
      //   0x20 = Stats, 0x10 = Vitals, 0x08 = ExperienceGold, 0x04 = Modifiers
      // Sections must be parsed in order to reach the gold field.

      if (flags & 0x20) {
        // Stats section: 3 unknown bytes + level + abilityLevel + maxHp u32 + maxMp u32
        //   + str/int/wis/con/dex (5 bytes) + hasStatPoints bool + statPoints u8
        //   + maxWeight u16 + weight u16 + unknown u32
        reader.offset += 3; // unknown bytes
        reader.offset += 1; // level
        reader.offset += 1; // abilityLevel
        reader.offset += 4; // maxHealth u32
        reader.offset += 4; // maxMana u32
        reader.offset += 5; // str, int, wis, con, dex
        reader.offset += 1; // hasStatPoints
        reader.offset += 1; // statPoints
        reader.offset += 2; // maxWeight u16
        reader.offset += 2; // weight u16
        reader.offset += 4; // unknown u32
      }

      if (flags & 0x10) {
        // Vitals section: health u32 + mana u32
        reader.offset += 4; // health
        reader.offset += 4; // mana
      }

      if (flags & 0x08) {
        // ExperienceGold section
        reader.offset += 4; // totalExperience u32
        reader.offset += 4; // toNextLevel u32
        reader.offset += 4; // totalAbility u32
        reader.offset += 4; // toNextAbility u32
        reader.offset += 4; // gamePoints u32
        const gold = reader.readUint32();
        const oldGold = this.state.gold;
        this.state.gold = gold;
        if (gold !== oldGold) {
          console.log(`[InventoryTracker] Gold updated: ${oldGold} -> ${gold}`);
          this.emit('goldUpdated', gold);
        }
      }
    } catch (err) {
      console.error('[InventoryTracker] Failed to parse Attributes:', err);
    }
  }

  clear(): void {
    this.state.items.clear();
    this.state.gold = 0;
    this.emit('cleared');
  }
}
