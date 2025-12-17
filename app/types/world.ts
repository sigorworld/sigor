export type EvmAddress = `0x${string}`;

export interface ChatRow {
  id: number;
  account: EvmAddress;
  text: string;
  timestamp: number;
}

export interface PlayerState {
  account: EvmAddress;
  x: number;
  y: number;
  dir?: string;
  updatedAt: number;
}

/** Client -> Server */
export type WorldWsClientMessage =
  | { type: 'ping' }
  | { type: 'chat'; text: string; localId?: string }
  | { type: 'move'; x: number; y: number; dir?: string };

/** Server -> Client */
export type WorldWsServerMessage =
  | { type: 'hello'; account: EvmAddress }
  | { type: 'init'; me: EvmAddress; recentMessages: ChatRow[]; players: PlayerState[] }
  | { type: 'chat'; message: ChatRow; localId?: string }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; account: EvmAddress }
  | { type: 'player_moved'; account: EvmAddress; x: number; y: number; dir?: string; updatedAt: number }
  | { type: 'error'; message: string }
  | { type: 'pong' };
