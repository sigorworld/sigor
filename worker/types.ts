export type EvmAddress = `0x${string}`;

export type WsClientToServer =
  | { type: "ping" }
  | { type: "chat"; text: string; localId?: string }
  | { type: "move"; x: number; y: number; dir?: string };

export type WsServerToClient =
  | { type: "hello"; account: EvmAddress }
  | { type: "init"; me: EvmAddress; recentMessages: ChatRow[]; players: PlayerState[] }
  | { type: "chat"; message: ChatRow; localId?: string }
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; account: EvmAddress }
  | { type: "player_moved"; account: EvmAddress; x: number; y: number; dir?: string; updatedAt: number }
  | { type: "error"; message: string }
  | { type: "pong" };

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
