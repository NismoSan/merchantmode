export interface InventoryItem {
  slot: number;
  sprite: number;
  color: number;
  name: string;
  quantity: number;
  isStackable: boolean;
  maxDurability: number;
  durability: number;
}

export interface InventoryState {
  items: Map<number, InventoryItem>; // slot -> item
  gold: number;
  maxSlots: number;
}
