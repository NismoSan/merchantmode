export enum ConnectionPhase {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  REDIRECTING = 'redirecting',
  IN_GAME = 'in_game',
}

export class ConnectionState {
  phase: ConnectionPhase = ConnectionPhase.DISCONNECTED;
  seed: number = 0;
  characterName: string = '';
  isLoggedIn: boolean = false;
}
