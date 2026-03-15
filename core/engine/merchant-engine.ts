import { EventEmitter } from 'events';
import type { MerchantListing } from '../models/listing';
import type { Transaction } from '../models/transaction';
import { InventoryTracker } from './inventory-tracker';
import { EntityTracker } from './entity-tracker';
import { ServerOpCode, ClientOpCode } from '../network/packets/op-codes';
import { ExchangeServerEvent, ExchangeParty } from '../network/packets/exchange/exchange-types';
import { BinaryReader } from '../network/serialization/binary-reader';

export enum MerchantState {
  IDLE = 'IDLE',
  WHISPER_QUEUED = 'WHISPER_QUEUED',
  EXCHANGE_OPEN = 'EXCHANGE_OPEN',
  VALIDATING = 'VALIDATING',
  FILLING = 'FILLING',
  AWAITING_CONFIRM = 'AWAITING_CONFIRM',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
}

interface WhisperRequest {
  playerName: string;
  message: string;
  timestamp: number;
  matchedListing?: MerchantListing;
  requestedQuantity: number;
}

interface ExchangeState {
  targetId: number;
  targetName: string;
  theirItems: { name: string; sprite: number; index: number }[];
  theirGold: number;
  ourItems: { name: string; sprite: number; index: number }[];
  ourGold: number;
  theyAccepted: boolean;
  weAccepted: boolean;
  pendingQuantitySlot?: number;
}

export class MerchantEngine extends EventEmitter {
  private state: MerchantState = MerchantState.IDLE;
  private listings: MerchantListing[] = [];
  private whisperQueue: WhisperRequest[] = [];
  private currentExchange: ExchangeState | null = null;
  private transactions: Transaction[] = [];
  private inventoryTracker: InventoryTracker;
  private entityTracker: EntityTracker;
  private exchangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private characterName: string = '';
  // Track recently sent whispers to ignore server echoes
  private recentSentWhispers: Map<string, number> = new Map();

  constructor(inventoryTracker: InventoryTracker) {
    super();
    this.inventoryTracker = inventoryTracker;
    this.entityTracker = new EntityTracker();
  }

  getState(): MerchantState {
    return this.state;
  }

  getWhisperQueue(): WhisperRequest[] {
    return [...this.whisperQueue];
  }

  getListings(): MerchantListing[] {
    return [...this.listings];
  }

  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  setCharacterName(name: string): void {
    this.characterName = name;
  }

  recordSentWhisper(target: string, message: string): void {
    const key = `${target.toLowerCase()}|${message}`;
    this.recentSentWhispers.set(key, Date.now() + 5000);
  }

  private isSentEcho(sender: string, message: string): boolean {
    // Ignore whispers from our own character (outgoing echo)
    if (this.characterName && sender.toLowerCase() === this.characterName.toLowerCase()) {
      return true;
    }
    // Check recent sent whisper cache
    const key = `${sender.toLowerCase()}|${message}`;
    const expiry = this.recentSentWhispers.get(key);
    if (expiry) {
      this.recentSentWhispers.delete(key);
      return Date.now() < expiry;
    }
    return false;
  }

  setListings(listings: MerchantListing[]): void {
    this.listings = listings;
    this.emit('listingsUpdated', this.listings);
  }

  /**
   * Process a decoded server packet.
   */
  processServerPacket(opCode: number, data: Uint8Array): void {
    // Forward to inventory tracker and entity tracker
    this.inventoryTracker.processPacket(opCode, data);
    this.entityTracker.processPacket(opCode, data);

    switch (opCode) {
      case ServerOpCode.ServerMessage:
        this.handleWorldMessage(data);
        break;
      case ServerOpCode.Exchange:
        this.handleExchangePacket(data);
        break;
    }
  }

  private handleWorldMessage(data: Uint8Array): void {
    try {
      // ServerOpCode.ChatMessage (0x0A) is WorldMessage in DA protocol.
      // Format: [messageType u8][message string16]
      // Whisper = type 0, message contains "PlayerName> text"
      const reader = new BinaryReader(data);
      const messageType = reader.readUint8();
      const message = reader.readString16();

      this.emit('chatMessage', { messageType, message });

      // Type 0 = Whisper
      // Server sends two formats:
      //   SenderName" message   — incoming whisper (someone whispered you)
      //   TargetName> message   — outgoing echo (you whispered someone)
      // We only process incoming whispers (quote-terminated name format).
      if (messageType === 0) {
        if (!this.characterName) {
          console.warn(`[MerchantEngine] WARNING: characterName not set, echo detection will not work`);
        }
        console.log(`[MerchantEngine:${this.characterName}] Raw whisper (type 0): [${message}] (${message.length} chars)`);

        // Match incoming format: Name" message (name ends with closing quote, no opening quote)
        const incomingMatch = message.match(/^([A-Za-z][A-Za-z0-9 ]*)"\s+([\s\S]*)$/);
        if (incomingMatch) {
          const playerName = incomingMatch[1].trim();
          const content = incomingMatch[2].trim();

          // Skip if the "sender" is actually us (shouldn't happen but guard)
          if (this.isSentEcho(playerName, content)) {
            return;
          }
          console.log(`[MerchantEngine:${this.characterName}] Whisper from ${playerName}: ${content}`);
          this.handleWhisper(playerName, content);
        }
        // Arrow format (Name> message) is an outgoing echo — ignore it
        else if (message.includes('>')) {
          console.log(`[MerchantEngine:${this.characterName}] Outgoing echo ignored: [${message}]`);
        } else {
          console.log(`[MerchantEngine:${this.characterName}] Type-0 message did not match any format: [${message}]`);
        }
      }
    } catch {
      // Chat parse failed
    }
  }

  private handleWhisper(playerName: string, content: string): void {
    // Try to match against listings and extract requested quantity
    const match = this.matchListing(content);

    const request: WhisperRequest = {
      playerName,
      message: content,
      timestamp: Date.now(),
      matchedListing: match?.listing,
      requestedQuantity: match?.quantity ?? 1,
    };

    this.whisperQueue.push(request);
    this.emit('whisperReceived', request);

    if (this.state === MerchantState.IDLE && match?.listing) {
      this.state = MerchantState.WHISPER_QUEUED;
      this.emit('stateChanged', this.state);

      // Try to initiate exchange if we know the player's entity ID
      const entityId = this.entityTracker.getEntityId(playerName);
      if (entityId !== undefined) {
        console.log(`[MerchantEngine] Initiating exchange with ${playerName} (entity ${entityId}), qty=${request.requestedQuantity}`);
        this.emit('requestBeginExchange', entityId);
      }
    }
  }

  private matchListing(message: string): { listing: MerchantListing; quantity: number } | undefined {
    const lower = message.toLowerCase();

    for (const listing of this.listings) {
      if (listing.status !== 'ACTIVE') continue;
      if (listing.quantityRemaining <= 0) continue;

      if (lower.includes(listing.itemName.toLowerCase())) {
        // Extract quantity from the message — look for a number before or after the item name
        let quantity = 1;
        const itemNameLower = listing.itemName.toLowerCase();
        const itemIndex = lower.indexOf(itemNameLower);

        // Check for number before the item name: "buy 10 Goblin's Skull"
        const beforeText = message.substring(0, itemIndex).trim();
        const beforeMatch = beforeText.match(/(\d+)\s*$/);
        if (beforeMatch) {
          quantity = parseInt(beforeMatch[1], 10);
        }

        // Check for number after the item name: "Goblin's Skull 10"
        const afterText = message.substring(itemIndex + listing.itemName.length).trim();
        const afterMatch = afterText.match(/^\s*(\d+)/);
        if (afterMatch) {
          quantity = parseInt(afterMatch[1], 10);
        }

        // Clamp to available quantity
        quantity = Math.min(quantity, listing.quantityRemaining);
        if (quantity < 1) quantity = 1;

        return { listing, quantity };
      }
    }

    return undefined;
  }

  private handleExchangePacket(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const event = reader.readUint8();

      switch (event) {
        case ExchangeServerEvent.Started: {
          const targetId = reader.readUint32();
          const targetName = reader.readString8();
          this.onExchangeStarted(targetId, targetName);
          break;
        }
        case ExchangeServerEvent.QuantityPrompt: {
          const promptSlot = reader.readUint8();
          this.onQuantityPrompt(promptSlot);
          break;
        }
        case ExchangeServerEvent.ItemAdded: {
          const party = reader.readUint8();
          const itemIndex = reader.readUint8();
          const itemSprite = reader.readUint16();
          const itemColor = reader.readUint8();
          const itemName = reader.readString8();
          this.onExchangeItemAdded(party, itemIndex, itemSprite, itemName);
          break;
        }
        case ExchangeServerEvent.GoldAdded: {
          const party = reader.readUint8();
          const goldAmount = reader.readUint32();
          this.onExchangeGoldAdded(party, goldAmount);
          break;
        }
        case ExchangeServerEvent.Cancelled: {
          this.onExchangeCancelled();
          break;
        }
        case ExchangeServerEvent.Accepted: {
          const party = reader.readUint8();
          this.onExchangeAccepted(party);
          break;
        }
      }
    } catch (err) {
      console.error('[MerchantEngine] Failed to parse Exchange packet:', err);
    }
  }

  private onExchangeStarted(targetId: number, targetName: string): void {
    // Register this entity ID so we know it for future exchanges
    this.entityTracker.registerEntity(targetId, targetName);

    this.currentExchange = {
      targetId,
      targetName,
      theirItems: [],
      theirGold: 0,
      ourItems: [],
      ourGold: 0,
      theyAccepted: false,
      weAccepted: false,
    };

    this.state = MerchantState.EXCHANGE_OPEN;
    this.emit('stateChanged', this.state);
    this.emit('exchangeStarted', targetName);

    // Set timeout
    this.exchangeTimeout = setTimeout(() => {
      console.log('[MerchantEngine] Exchange timeout');
      this.emit('requestCancel', targetId);
      this.resetState();
    }, 60000);
  }

  private onQuantityPrompt(promptSlot: number): void {
    if (!this.currentExchange) return;

    console.log(`[MerchantEngine] QuantityPrompt received for slot=${promptSlot}`);

    // Server is asking how many of a stackable item to add.
    // Store the slot so the fill handler knows to respond with AddStackableItem.
    this.currentExchange.pendingQuantitySlot = promptSlot;

    // Emit event so the fill logic can respond with the quantity
    this.emit('quantityPrompt', promptSlot, this.currentExchange.targetId);
  }

  private onExchangeItemAdded(party: number, index: number, sprite: number, name: string): void {
    if (!this.currentExchange) return;

    const item = { name, sprite, index };

    if (party === ExchangeParty.Them) {
      this.currentExchange.theirItems.push(item);
      // They added an item — check if we should fill our side (BUY listing)
      this.tryAutoFill();
    } else {
      this.currentExchange.ourItems.push(item);
    }

    this.emit('exchangeUpdated', this.currentExchange);
  }

  private onExchangeGoldAdded(party: number, amount: number): void {
    if (!this.currentExchange) return;

    if (party === ExchangeParty.Them) {
      this.currentExchange.theirGold = amount;
      // They added gold — check if we should fill our side (SELL listing)
      this.tryAutoFill();
    } else {
      this.currentExchange.ourGold = amount;
    }

    this.emit('exchangeUpdated', this.currentExchange);
  }

  private onExchangeAccepted(party: number): void {
    if (!this.currentExchange) return;

    if (party === ExchangeParty.Them) {
      this.currentExchange.theyAccepted = true;
      // They clicked Accept — now check if we should fill our side
      this.tryAutoFill();
    } else {
      this.currentExchange.weAccepted = true;
    }

    // If both accepted, record the trade
    if (this.currentExchange.theyAccepted && this.currentExchange.weAccepted) {
      const queuedRequest = this.whisperQueue.find(
        (w) => w.playerName === this.currentExchange!.targetName && w.matchedListing,
      );
      if (queuedRequest?.matchedListing) {
        this.onTradeComplete(queuedRequest.matchedListing, queuedRequest.requestedQuantity);
      } else {
        // Manual or unmatched exchange completed — reset state
        this.resetState();
        this.emit('exchangeCompleted');
      }
      return;
    }

    this.emit('exchangeUpdated', this.currentExchange);
  }

  private onExchangeCancelled(): void {
    this.resetState();
    this.emit('exchangeCancelled');
  }

  /**
   * Called when the other party adds items or gold.
   * Checks if their offer matches a listing and fills our side automatically.
   */
  private tryAutoFill(): void {
    if (!this.currentExchange) return;
    // Don't fill twice
    if (this.state === MerchantState.FILLING || this.state === MerchantState.AWAITING_CONFIRM) return;

    // Wait until they've clicked Accept before we fill our side
    if (!this.currentExchange.theyAccepted) return;

    // Find the matching queued whisper/listing for this exchange partner
    const queuedRequest = this.whisperQueue.find(
      (w) => w.playerName === this.currentExchange!.targetName && w.matchedListing,
    );

    if (!queuedRequest?.matchedListing) {
      // No whisper match — try matching any active listing by what they offered
      return;
    }

    const listing = queuedRequest.matchedListing;
    const requestedQty = queuedRequest.requestedQuantity;
    const totalPrice = listing.price * requestedQty;

    if (listing.type === 'SELL') {
      // We're selling: they need to place enough gold for the total
      if (this.currentExchange.theirGold >= totalPrice) {
        console.log(`[MerchantEngine] Gold validated (${this.currentExchange.theirGold} >= ${totalPrice} for ${requestedQty}x) and they accepted, filling sell`);
        this.state = MerchantState.FILLING;
        this.emit('stateChanged', this.state);
        this.emit('requestFillSell', listing, this.currentExchange.targetId, requestedQty);
      }
    } else if (listing.type === 'BUY') {
      // We're buying: they need to place the item
      const hasItem = this.currentExchange.theirItems.some(
        (i) => i.name.toLowerCase() === listing.itemName.toLowerCase(),
      );
      if (hasItem) {
        console.log(`[MerchantEngine] Item validated and they accepted, filling buy`);
        this.state = MerchantState.FILLING;
        this.emit('stateChanged', this.state);
        this.emit('requestFillBuy', listing, this.currentExchange.targetId, requestedQty);
      }
    }
  }

  onFillComplete(): void {
    this.state = MerchantState.AWAITING_CONFIRM;
    this.emit('stateChanged', this.state);
    this.emit('requestAccept', this.currentExchange?.targetId ?? 0);
  }

  onTradeComplete(listing: MerchantListing, tradedQuantity: number = 1): void {
    if (this.exchangeTimeout) {
      clearTimeout(this.exchangeTimeout);
      this.exchangeTimeout = null;
    }

    // Update listing quantity
    listing.quantityRemaining -= tradedQuantity;
    if (listing.quantityRemaining <= 0) {
      listing.status = 'SOLD_OUT';
    }

    const totalPrice = listing.price * tradedQuantity;

    // Record transaction
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      listingId: listing.id,
      counterpartyName: this.currentExchange?.targetName ?? 'Unknown',
      type: listing.type,
      itemsGiven: listing.type === 'SELL' ? [{ name: listing.itemName, quantity: tradedQuantity }] : [],
      itemsReceived: listing.type === 'BUY' ? [{ name: listing.itemName, quantity: tradedQuantity }] : [],
      goldGiven: listing.type === 'BUY' ? totalPrice : 0,
      goldReceived: listing.type === 'SELL' ? totalPrice : 0,
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
    };

    this.transactions.push(transaction);
    this.emit('transactionCompleted', transaction);

    // Remove from whisper queue
    this.whisperQueue = this.whisperQueue.filter(
      (w) => w.playerName !== this.currentExchange?.targetName,
    );

    this.resetState();
  }

  private resetState(): void {
    if (this.exchangeTimeout) {
      clearTimeout(this.exchangeTimeout);
      this.exchangeTimeout = null;
    }
    this.currentExchange = null;
    this.state = MerchantState.IDLE;
    this.emit('stateChanged', this.state);
  }
}
