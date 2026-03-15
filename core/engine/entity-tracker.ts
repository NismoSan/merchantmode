import { EventEmitter } from 'events';
import { ServerOpCode } from '../network/packets/op-codes';
import { BinaryReader } from '../network/serialization/binary-reader';

/**
 * Tracks visible entities (players) on the map to resolve player names to entity IDs.
 * This is needed to initiate exchanges by name — the client exchange packet requires
 * a target entity ID, not a name.
 */
export class EntityTracker extends EventEmitter {
  // Map of entityId -> playerName
  private entities: Map<number, string> = new Map();
  // Reverse map: playerName (lowercase) -> entityId
  private nameToId: Map<string, number> = new Map();

  getEntityId(playerName: string): number | undefined {
    return this.nameToId.get(playerName.toLowerCase());
  }

  getPlayerName(entityId: number): string | undefined {
    return this.entities.get(entityId);
  }

  processPacket(opCode: number, data: Uint8Array): void {
    switch (opCode) {
      case ServerOpCode.DisplayVisibleEntities:
        this.handleVisibleEntities(data);
        break;
      case ServerOpCode.RemoveObject:
        this.handleRemoveObject(data);
        break;
    }
  }

  private handleVisibleEntities(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const count = reader.readUint16();

      for (let i = 0; i < count; i++) {
        const x = reader.readUint16();
        const y = reader.readUint16();
        const id = reader.readUint32();
        const sprite = reader.readUint16();
        reader.readUint32(); // unknown/padding
        const direction = reader.readUint8();
        reader.readUint8(); // unknown

        // Entity type indicator: 0x02 = player (Aisling)
        const entityType = reader.readUint8();

        if (entityType === 0x02) {
          // Player entity — has a name
          // Read through appearance data to get to name
          reader.readUint8(); // helmet style
          reader.readUint8(); // body style
          reader.readUint16(); // armor sprite
          reader.readUint8(); // boots
          reader.readUint8(); // armor color
          reader.readUint8(); // boots color
          reader.readUint8(); // helmet color
          reader.readUint8(); // shield style
          reader.readUint16(); // weapon sprite
          reader.readUint8(); // hair color
          reader.readUint8(); // face
          const nameLen = reader.readUint8();
          const nameBytes = reader.readBytes(nameLen);
          const name = Buffer.from(nameBytes).toString('ascii');

          // Skip group name if present
          if (reader.remaining() > 0) {
            try {
              reader.readString8(); // group name
            } catch {
              // May not be present
            }
          }

          this.entities.set(id, name);
          this.nameToId.set(name.toLowerCase(), id);
        } else {
          // Non-player entity — skip variable data
          // Monster/NPC entities have different formats; skip remaining fields
          try {
            reader.readUint16(); // sprite2 or padding
            reader.readUint8();  // color
            // Try to read name for NPCs
            const nameLen = reader.readUint8();
            if (nameLen > 0 && nameLen < 64) {
              reader.readBytes(nameLen);
            }
          } catch {
            // Entity format varies; best-effort parsing
            break;
          }
        }
      }
    } catch {
      // DisplayVisibleEntities has complex, version-dependent format
      // Partial parsing is acceptable — we'll get player IDs from exchange packets too
    }
  }

  private handleRemoveObject(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const id = reader.readUint32();
      const name = this.entities.get(id);
      if (name) {
        this.nameToId.delete(name.toLowerCase());
        this.entities.delete(id);
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Register an entity from an exchange Started event (guaranteed correct mapping).
   */
  registerEntity(entityId: number, playerName: string): void {
    this.entities.set(entityId, playerName);
    this.nameToId.set(playerName.toLowerCase(), entityId);
  }

  clear(): void {
    this.entities.clear();
    this.nameToId.clear();
  }
}
