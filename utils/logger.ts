const LOG_PREFIX = '[MerchantMode]';

export function log(module: string, message: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX} [${module}] ${message}`, ...args);
}

export function logError(module: string, message: string, ...args: unknown[]): void {
  console.error(`${LOG_PREFIX} [${module}] ${message}`, ...args);
}

export function logPacket(direction: string, opCode: number, dataLength: number): void {
  console.log(`${LOG_PREFIX} [Packet] ${direction} opCode=0x${opCode.toString(16).padStart(2, '0')} len=${dataLength}`);
}
