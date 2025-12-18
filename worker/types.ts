export type EvmAddress = `0x${string}`;

export type WsClientToServer =
  | { type: "ping" }
  | { type: "chat"; text: string; localId?: string }
  | { type: "move"; x: number; y: number; dir?: string }
  // (선택) 다른 클라에게도 갱신 전파하고 싶을 때 사용
  | { type: "profile_updated" };

export type WsServerToClient =
  // ✅ spectator 지원: null 가능
  | { type: "hello"; account: EvmAddress | null }
  | { type: "init"; me: EvmAddress | null; recentMessages: ChatRow[]; players: PlayerState[] }
  | { type: "chat"; message: ChatRow; localId?: string }
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; account: EvmAddress }
  | { type: "player_moved"; account: EvmAddress; x: number; y: number; dir?: string; updatedAt: number }
  // (선택) 다른 클라에게도 갱신 전파
  | { type: "profile_updated"; account: EvmAddress }
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
