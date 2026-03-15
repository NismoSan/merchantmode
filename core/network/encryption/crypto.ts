import { generateKeySalts } from './utils';

export abstract class Crypto {
  public get key(): string {
    return this._key;
  }

  public set key(value: string) {
    this._key = value;
    this.keyBuffer = Buffer.from(value);
  }

  public get keySalts(): string {
    return this._keySalts;
  }

  public set keySalts(value: string) {
    this._keySalts = value;
    this.keySaltsBuffer = generateKeySalts(value);
  }

  protected keyBuffer!: Uint8Array;
  private _key!: string;

  protected keySaltsBuffer!: Uint8Array;
  private _keySalts!: string;

  public currentOrdinal: number = 0;

  constructor(
    public seed: number,
    key: string = 'UrkcnItnI',
    keySalts: string = 'login',
  ) {
    this.key = key;
    this.keySalts = keySalts;
  }

  public abstract shouldEncrypt(opCode: number): boolean;
  public abstract encrypt(buffer: Uint8Array, opCode: number, sequence?: number): Uint8Array;
  public abstract decrypt(buffer: Uint8Array, opCode: number): Uint8Array;

  protected nextOrdinal(): number {
    return this.currentOrdinal++ % 255;
  }
}
