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

      // For TRADE listings, match on the WANTED item name (what the whisperer has).
      // For BUY/SELL, match on itemName as before.
      const matchName = listing.type === 'TRADE'
        ? listing.wantedItems?.[0]?.name
        : listing.itemName;
      if (!matchName) continue;

      if (lower.includes(matchName.toLowerCase())) {
        // For TRADE, quantities are fixed by the listing — always 1 trade per match
        if (listing.type === 'TRADE') {
          return { listing, quantity: 1 };
        }

        // Extract quantity from the message — look for a number before or after the item name
        let quantity = 1;
        const itemNameLower = matchName.toLowerCase();
        const itemIndex = lower.indexOf(itemNameLower);

        // Check for number before the item name: "buy 10 Goblin's Skull"
        const beforeText = message.substring(0, itemIndex).trim();
        const beforeMatch = beforeText.match(/(\d+)\s*$/);
        if (beforeMatch) {
          quantity = parseInt(beforeMatch[1], 10);
        }

        // Check for number after the item name: "Goblin's Skull 10"
        const afterText = message.substring(itemIndex + matchName.length).trim();
        const afterMatch = afterText.match(/^\s*(\d+)/);
        if (afterMatch) {
          quantity = parseInt(afterMatch[1], 10);
        }

        // Clamp to available quantity
        quantity = Math.min(quantity, listing.quantityRemaining);
        if (quantity < 1) quantity = 1;

        // If stackSize is set, round quantity to nearest multiple of stackSize
        if (listing.stackSize && listing.stackSize > 0) {
          quantity = Math.round(quantity / listing.stackSize) * listing.stackSize;
          if (quantity < listing.stackSize) quantity = listing.stackSize;
          quantity = Math.min(quantity, listing.quantityRemaining);
        }

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
    console.log(`[MerchantEngine] Exchange started with "${targetName}" (id=${targetId}), current state=${this.state}`);
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
    console.log(`[MerchantEngine] Exchange item added: party=${party === ExchangeParty.Them ? 'THEM' : 'US'}, name="${name}", sprite=${sprite}, index=${index}`);

    const item = { name, sprite, index };

    if (party === ExchangeParty.Them) {
      this.currentExchange.theirItems.push(item);
      // They added an item — check if we should fill our side (BUY listing)
      this.tryAutoFill();
    } else {
      this.currentExchange.ourItems.push(item);
      // Adding an item on our side resets their accept in the game server
      this.currentExchange.theyAccepted = false;
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
      // Adding gold on our side resets their accept in the game server
      this.currentExchange.theyAccepted = false;
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
   * Called when the other party adds items/gold or accepts.
   * Checks if their offer matches a listing and fills our side automatically.
   *
   * For BUY listings, we fill (place gold) as soon as the item is validated,
   * WITHOUT waiting for them to accept first. This is because adding gold to the
   * exchange resets the other party's accept — if we waited for their accept and
   * then added gold, they'd need to re-accept but the engine would already be in
   * AWAITING_CONFIRM state and would never re-trigger the fill.
   *
   * For SELL listings, we wait for them to accept first since we need to validate
   * the gold amount they placed. Our item placement will reset their accept, and
   * they'll need to re-accept after seeing our items.
   */
  private tryAutoFill(): void {
    if (!this.currentExchange) return;
    // Don't fill twice
    if (this.state === MerchantState.FILLING || this.state === MerchantState.AWAITING_CONFIRM) return;

    console.log(`[MerchantEngine] tryAutoFill: state=${this.state}, target="${this.currentExchange.targetName}", theirItems=${this.currentExchange.theirItems.length}, theirGold=${this.currentExchange.theirGold}, theyAccepted=${this.currentExchange.theyAccepted}`);

    // Find the matching queued whisper/listing for this exchange partner
    const queuedRequest = this.whisperQueue.find(
      (w) => w.playerName === this.currentExchange!.targetName && w.matchedListing,
    );

    if (!queuedRequest?.matchedListing) {
      // No whisper match — try matching any active listing by what they offered
      console.log(`[MerchantEngine] tryAutoFill: no matching whisper/listing for "${this.currentExchange.targetName}" in queue (${this.whisperQueue.length} entries: ${this.whisperQueue.map(w => `${w.playerName}:${!!w.matchedListing}`).join(', ')})`);
      return;
    }

    const listing = queuedRequest.matchedListing;
    const requestedQty = queuedRequest.requestedQuantity;

    // If stackSize is set, price covers the whole stack; otherwise price is per-unit
    const totalPrice = listing.stackSize
      ? listing.price * Math.ceil(requestedQty / listing.stackSize)
      : listing.price * requestedQty;

    if (listing.type === 'SELL') {
      // We're selling: wait for their accept, then validate gold and place item
      if (!this.currentExchange.theyAccepted) return;

      if (this.currentExchange.theirGold >= totalPrice) {
        console.log(`[MerchantEngine] Gold validated (${this.currentExchange.theirGold} >= ${totalPrice} for ${requestedQty}x, stackSize=${listing.stackSize ?? 'none'}) and they accepted, filling sell`);
        this.state = MerchantState.FILLING;
        this.emit('stateChanged', this.state);
        this.emit('requestFillSell', listing, this.currentExchange.targetId, requestedQty);
      } else {
        console.log(`[MerchantEngine] Gold insufficient: ${this.currentExchange.theirGold} < ${totalPrice} needed for ${requestedQty}x at ${listing.price} each (stackSize=${listing.stackSize ?? 'none'})`);
      }
    } else if (listing.type === 'BUY') {
      // We're buying: validate item presence, then place gold immediately.
      // Don't wait for their accept — placing gold would reset it anyway.
      const listingName = listing.itemName.toLowerCase();
      const hasItem = this.currentExchange.theirItems.some(
        (i) => i.name.toLowerCase() === listingName || i.name.toLowerCase().startsWith(listingName),
      );
      if (hasItem) {
        console.log(`[MerchantEngine] Item validated, filling buy (placing ${totalPrice} gold for ${requestedQty}x)`);
        console.log(`[MerchantEngine] Their items: ${JSON.stringify(this.currentExchange.theirItems.map(i => i.name))}`);
        this.state = MerchantState.FILLING;
        this.emit('stateChanged', this.state);
        this.emit('requestFillBuy', listing, this.currentExchange.targetId, requestedQty);
      } else {
        console.log(`[MerchantEngine] BUY item not found in their offer. Looking for "${listing.itemName}", they have: ${JSON.stringify(this.currentExchange.theirItems.map(i => i.name))}`);
      }
    } else if (listing.type === 'TRADE') {
      // We're trading: validate they placed the wanted item, then place our offered item.
      // Don't wait for their accept — placing our item would reset it anyway.
      const wantedName = listing.wantedItems?.[0]?.name?.toLowerCase();
      if (!wantedName) return;

      const hasWanted = this.currentExchange.theirItems.some(
        (i) => i.name.toLowerCase() === wantedName || i.name.toLowerCase().startsWith(wantedName),
      );
      if (hasWanted) {
        // Use the listing's offered quantity, not the whisper quantity
        const offeredQty = listing.quantity;
        console.log(`[MerchantEngine] Trade item validated, filling trade (placing ${offeredQty}x "${listing.itemName}" for their "${wantedName}")`);
        console.log(`[MerchantEngine] Their items: ${JSON.stringify(this.currentExchange.theirItems.map(i => i.name))}`);
        this.state = MerchantState.FILLING;
        this.emit('stateChanged', this.state);
        this.emit('requestFillTrade', listing, this.currentExchange.targetId, offeredQty);
      } else {
        console.log(`[MerchantEngine] TRADE wanted item not found in their offer. Looking for "${wantedName}", they have: ${JSON.stringify(this.currentExchange.theirItems.map(i => i.name))}`);
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
    // For TRADE, decrement by 1 (one trade completed); for BUY/SELL, by traded quantity
    const decrementBy = listing.type === 'TRADE' ? 1 : tradedQuantity;
    listing.quantityRemaining -= decrementBy;
    if (listing.quantityRemaining <= 0) {
      listing.status = 'SOLD_OUT';
    }

    const totalPrice = listing.stackSize
      ? listing.price * Math.ceil(tradedQuantity / listing.stackSize)
      : listing.price * tradedQuantity;

    // Record transaction
    let itemsGiven: { name: string; quantity: number }[] = [];
    let itemsReceived: { name: string; quantity: number }[] = [];
    let goldGiven = 0;
    let goldReceived = 0;

    if (listing.type === 'SELL') {
      itemsGiven = [{ name: listing.itemName, quantity: tradedQuantity }];
      goldReceived = totalPrice;
    } else if (listing.type === 'BUY') {
      itemsReceived = [{ name: listing.itemName, quantity: tradedQuantity }];
      goldGiven = totalPrice;
    } else if (listing.type === 'TRADE') {
      // We gave our offered item (listing.quantity per trade), received their wanted item
      itemsGiven = [{ name: listing.itemName, quantity: listing.quantity }];
      itemsReceived = listing.wantedItems?.map(w => ({ name: w.name, quantity: w.quantity })) ?? [];
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      listingId: listing.id,
      counterpartyName: this.currentExchange?.targetName ?? 'Unknown',
      type: listing.type,
      itemsGiven,
      itemsReceived,
      goldGiven,
      goldReceived,
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
