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

export type WorldWsClientMessage =
  | { type: "ping" }
  | { type: "chat"; text: string; localId?: string }
  | { type: "move"; x: number; y: number; dir?: string }
  | { type: "profile_updated" }; // ✅

export type WorldWsServerMessage =
  | { type: "hello"; account: EvmAddress | null } // ✅ null 허용 (당신 서버가 null 보냄)
  | { type: "init"; me: EvmAddress | null; recentMessages: ChatRow[]; players: PlayerState[] } // ✅
  | { type: "chat"; message: ChatRow; localId?: string }
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; account: EvmAddress }
  | { type: "player_moved"; account: EvmAddress; x: number; y: number; dir?: string; updatedAt: number }
  | { type: "profile_updated"; account: EvmAddress } // ✅
  | { type: "error"; message: string }
  | { type: "pong" };
