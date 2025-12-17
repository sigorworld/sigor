import { corsHeaders, jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import type { ChatRow, EvmAddress, PlayerState, WsClientToServer, WsServerToClient } from "../types";
import { isValidEvmAddress } from "../utils/evm";

type Env = { DB: D1Database };

type ClientInfo = { account: EvmAddress; socket: WebSocket };

const MAX_CHAT_LEN = 10_000;
const MAX_INIT_MESSAGES = 50;

// (0,0) 주변 랜덤 스폰 범위 (원하면 조절)
const SPAWN_RADIUS = 2.5;

// 너무 겹치면 조금씩 더 벌리기 위한 간단한 재시도
const MAX_SPAWN_TRIES = 12;
const MIN_SPAWN_DISTANCE = 0.6;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSpawnNearOrigin(): { x: number; y: number } {
  // 원점 주변 균일하게: 반지름 r은 sqrt로
  const t = randBetween(0, Math.PI * 2);
  const r = Math.sqrt(Math.random()) * SPAWN_RADIUS;
  return { x: Math.cos(t) * r, y: Math.sin(t) * r };
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class WorldRoomDO {
  private readonly env: Env;

  // 메모리 상태
  private clients: ClientInfo[] = [];
  private players: Map<EvmAddress, PlayerState> = new Map();

  constructor(private state: DurableObjectState, env: Env) {
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade") || request.headers.get("upgrade");

    if (upgrade === "websocket") {
      return this.handleWebSocketUpgrade(request, url);
    }

    // 메인 워커에서 서버-서버로 브로드캐스트하고 싶을 때(옵션)
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.text().catch(() => "");
      if (!payload) return jsonWithCors({ error: "Bad Request" }, 400);
      this.broadcastRaw(payload);
      return jsonWithCors({ ok: true });
    }

    return jsonWithCors({ error: "Not Found" }, 404);
  }

  private async handleWebSocketUpgrade(request: Request, url: URL): Promise<Response> {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 401, headers: corsHeaders() });

    let account: EvmAddress;
    try {
      const payload: any = await verifyToken(token, this.env as any);
      if (!isValidEvmAddress(payload?.sub)) {
        return new Response("Invalid token", { status: 401, headers: corsHeaders() });
      }
      account = payload.sub as EvmAddress;
    } catch {
      return new Response("Invalid or expired token", { status: 401, headers: corsHeaders() });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.registerClient(server, account);

    // ✅ 접속 시 스폰(이미 있으면 기존 유지)
    if (!this.players.has(account)) {
      const spawned = this.allocateSpawn(account);
      this.players.set(account, spawned);
      this.broadcast({ type: "player_joined", player: spawned });
    }

    // hello + init
    server.send(JSON.stringify({ type: "hello", account } satisfies WsServerToClient));

    const recent = await this.loadRecentMessages(MAX_INIT_MESSAGES);
    const players = Array.from(this.players.values());

    server.send(
      JSON.stringify({
        type: "init",
        me: account,
        recentMessages: recent,
        players,
      } satisfies WsServerToClient),
    );

    server.addEventListener("message", (evt) => {
      this.onClientMessage(account, server, evt.data);
    });

    return new Response(null, { status: 101, webSocket: client, headers: corsHeaders() });
  }

  private allocateSpawn(account: EvmAddress): PlayerState {
    // 간단한 겹침 방지
    for (let i = 0; i < MAX_SPAWN_TRIES; i++) {
      const { x, y } = randomSpawnNearOrigin();
      let ok = true;

      for (const p of this.players.values()) {
        if (dist2(x, y, p.x, p.y) < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE) {
          ok = false;
          break;
        }
      }

      if (ok) {
        return { account, x, y, dir: "down", updatedAt: Date.now() };
      }
    }

    // 재시도 실패 시 그냥 랜덤
    const { x, y } = randomSpawnNearOrigin();
    return { account, x, y, dir: "down", updatedAt: Date.now() };
  }

  private registerClient(socket: WebSocket, account: EvmAddress) {
    const client: ClientInfo = { account, socket };
    this.clients.push(client);

    socket.addEventListener("close", () => {
      this.clients = this.clients.filter((c) => c !== client);

      // 동일 account 다중 접속 고려: 남은 소켓 없을 때만 제거
      const stillOnline = this.clients.some((c) => c.account === account);
      if (!stillOnline) {
        this.players.delete(account);
        this.broadcast({ type: "player_left", account });
      }
    });

    socket.addEventListener("error", () => {
      this.clients = this.clients.filter((c) => c !== client);
      try { socket.close(); } catch { }
    });
  }

  private async onClientMessage(account: EvmAddress, socket: WebSocket, data: any) {
    let msg: WsClientToServer | null = null;
    try {
      msg = typeof data === "string" ? JSON.parse(data) : null;
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies WsServerToClient));
      return;
    }

    if (!msg || typeof (msg as any).type !== "string") {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message" } satisfies WsServerToClient));
      return;
    }

    if (msg.type === "ping") {
      socket.send(JSON.stringify({ type: "pong" } satisfies WsServerToClient));
      return;
    }

    if (msg.type === "chat") {
      const text = (msg.text ?? "").toString().trim();
      if (!text) return;
      if (text.length > MAX_CHAT_LEN) {
        socket.send(JSON.stringify({ type: "error", message: "Chat too long" } satisfies WsServerToClient));
        return;
      }

      const row = await this.saveChatMessage(account, text);
      this.broadcast({ type: "chat", message: row, localId: msg.localId });
      return;
    }

    if (msg.type === "move") {
      if (!isFiniteNumber(msg.x) || !isFiniteNumber(msg.y)) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid coordinates" } satisfies WsServerToClient));
        return;
      }

      // 메모리 업데이트만
      const updatedAt = Date.now();
      const prev = this.players.get(account);

      // 접속 상태가 꼬였을 때를 대비해 없으면 스폰부터
      if (!prev) {
        const spawned = this.allocateSpawn(account);
        this.players.set(account, spawned);
        this.broadcast({ type: "player_joined", player: spawned });
      }

      this.players.set(account, {
        account,
        x: msg.x,
        y: msg.y,
        dir: msg.dir,
        updatedAt,
      });

      this.broadcast({
        type: "player_moved",
        account,
        x: msg.x,
        y: msg.y,
        dir: msg.dir,
        updatedAt,
      });

      return;
    }
  }

  private broadcast(event: WsServerToClient) {
    this.broadcastRaw(JSON.stringify(event));
  }

  private broadcastRaw(json: string) {
    for (const c of this.clients) {
      try {
        c.socket.send(json);
      } catch {
        try { c.socket.close(); } catch { }
      }
    }
    // 죽은 소켓 정리
    this.clients = this.clients.filter((c) => {
      try { return c.socket.readyState === WebSocket.OPEN; } catch { return false; }
    });
  }

  // -------------------------
  // Chat (D1)
  // -------------------------
  private async saveChatMessage(account: EvmAddress, text: string): Promise<ChatRow> {
    const timestamp = Date.now();
    const result = await this.env.DB.prepare(`
      INSERT INTO chat_messages (account, text, timestamp)
      VALUES (?, ?, ?)
    `).bind(account, text, timestamp).run();

    return {
      id: Number(result.meta.last_row_id),
      account,
      text,
      timestamp,
    };
  }

  private async loadRecentMessages(limit: number): Promise<ChatRow[]> {
    const { results } = await this.env.DB.prepare(`
      SELECT id, account, text, timestamp
      FROM chat_messages
      ORDER BY id DESC
      LIMIT ?
    `).bind(limit).all<{ id: number; account: string; text: string; timestamp: number }>();

    return results.reverse().map((r) => ({
      id: r.id,
      account: r.account as EvmAddress,
      text: r.text,
      timestamp: r.timestamp,
    }));
  }
}
