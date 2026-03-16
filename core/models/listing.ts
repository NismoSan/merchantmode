export type ListingType = 'BUY' | 'SELL' | 'TRADE';
export type ListingStatus = 'ACTIVE' | 'SOLD_OUT' | 'PAUSED';

export interface MerchantListing {
  id: string;
  characterName: string;
  type: ListingType;
  itemName: string;
  price: number;
  quantity: number;
  quantityRemaining: number;
  status: ListingStatus;
  wantedItems?: { name: string; quantity: number }[];
  offeredItems?: { name: string; quantity: number }[];
  notes?: string;
  stackSize?: number;
  syncToAe?: boolean;
  createdAt: string;
  updatedAt: string;
}
