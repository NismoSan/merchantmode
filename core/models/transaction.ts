export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface Transaction {
  id: string;
  listingId: string;
  counterpartyName: string;
  type: 'BUY' | 'SELL' | 'TRADE';
  itemsGiven: { name: string; quantity: number }[];
  itemsReceived: { name: string; quantity: number }[];
  goldGiven: number;
  goldReceived: number;
  status: TransactionStatus;
  reason?: string;
  timestamp: string;
}
