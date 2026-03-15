import { EventEmitter } from 'events';
import { ClientOpCode, ServerOpCode } from '../network/packets/op-codes';
import { BinaryReader } from '../network/serialization/binary-reader';

export interface LocationState {
  mapName: string;
  x: number;
  y: number;
}

// Dark Ages directions: 0=Up(y-1), 1=Right(x+1), 2=Down(y+1), 3=Left(x-1)
const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];

export class LocationTracker extends EventEmitter {
  private state: LocationState = { mapName: '', x: 0, y: 0 };

  getLocation(): LocationState {
    return { ...this.state };
  }

  /**
   * Process a decoded server packet to update location state.
   */
  processServerPacket(opCode: number, data: Uint8Array): void {
    switch (opCode) {
      case ServerOpCode.MapInfo:
        this.handleMapInfo(data);
        break;
      case ServerOpCode.Location:
        this.handleLocation(data);
        break;
    }
  }

  /**
   * Process a decoded client packet (client -> server) to track walks.
   */
  processClientPacket(opCode: number, data: Uint8Array): void {
    if (opCode === ClientOpCode.ClientWalk) {
      this.handleClientWalk(data);
    }
  }

  private handleMapInfo(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      reader.readUint16(); // areaId
      reader.readUint8();  // width
      reader.readUint8();  // height
      reader.readUint8();  // flags
      reader.offset += 2;  // padding
      reader.readUint16(); // crc
      const mapName = reader.readString8();
      this.state.mapName = mapName;
      this.emit('locationChanged', this.getLocation());
    } catch (err) {
      console.error('[LocationTracker] Failed to parse MapInfo:', err);
    }
  }

  private handleLocation(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      this.state.x = reader.readUint16();
      this.state.y = reader.readUint16();
      this.emit('locationChanged', this.getLocation());
    } catch (err) {
      console.error('[LocationTracker] Failed to parse Location:', err);
    }
  }

  private handleClientWalk(data: Uint8Array): void {
    try {
      const reader = new BinaryReader(data);
      const direction = reader.readUint8();
      if (direction >= 0 && direction <= 3) {
        this.state.x += DIR_DX[direction];
        this.state.y += DIR_DY[direction];
        this.emit('locationChanged', this.getLocation());
      }
    } catch (err) {
      console.error('[LocationTracker] Failed to parse ClientWalk:', err);
    }
  }

  clear(): void {
    this.state = { mapName: '', x: 0, y: 0 };
  }
}
