import { tokenManager } from "@gaiaprotocol/client-common";
import { assertValidWorldChatText, buildWorldWsUrl } from "../api/world";
import type {
  ChatRow,
  EvmAddress,
  PlayerState,
  WorldWsClientMessage,
  WorldWsServerMessage,
} from "../types/world";

type TokenProvider = () => string | null;

const MOVE_SEND_INTERVAL_MS = 60; // 서버로 move 보내는 최소 간격
const LOCAL_MOVE_SPEED = 3.2; // units/sec
const REMOTE_SMOOTH = 14; // 값이 클수록 타겟에 빨리 붙음(원격 보간)

function expLerp(current: number, target: number, dt: number, k: number) {
  const t = 1 - Math.exp(-k * dt);
  return current + (target - current) * t;
}

export class WorldService extends EventTarget {
  private socket: WebSocket | null = null;
  private connecting = false;
  private desiredConnected = false;

  private started = false;

  private reconnectDelayMs = 1200;
  private reconnectTimer: number | null = null;

  private rafId: number | null = null;
  private runningLoop = false;
  private lastFrameAt = 0;

  // ✅ render state (UI가 구독하는 맵)
  public players = new Map<EvmAddress, PlayerState>();
  public me: EvmAddress | null = null;

  // ✅ server targets (원격 보간용)
  private serverTargets = new Map<EvmAddress, PlayerState>();

  // input (예측 이동)
  private inputDx = 0;
  private inputDy = 0;
  private lastMoveSentAt = 0;

  // chat queue (WS open 전 전송한 메시지 보장)
  private pendingChat: WorldWsClientMessage[] = [];

  constructor(opts?: { tokenProvider?: TokenProvider }) {
    super();
    this.loop = this.loop.bind(this);
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.#syncAuth();

    tokenManager.on("signedIn", () => this.#syncAuth());
    tokenManager.on("signedOut", () => this.#syncAuth());
  }

  stop() {
    this.started = false;
    this.disconnect();
  }

  connect() {
    this.desiredConnected = true;
    this.#ensureLoop();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;

    const token = tokenManager.getToken();
    if (!token) {
      this.dispatchEvent(new CustomEvent("error", { detail: new Error("No token") }));
      return;
    }

    this.#connectWS(token);
  }

  disconnect() {
    this.desiredConnected = false;
    this.#clearReconnect();

    if (this.socket) {
      try {
        this.socket.close();
      } catch { }
    }

    this.socket = null;
    this.connecting = false;

    this.#stopLoop();

    this.me = null;
    this.players.clear();
    this.serverTargets.clear();
    this.pendingChat = [];

    this.dispatchEvent(new CustomEvent("disconnect"));
  }

  /** -1~1 */
  setInputDirection(dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      this.inputDx = dx / len;
      this.inputDy = dy / len;
    } else {
      this.inputDx = 0;
      this.inputDy = 0;
    }
  }

  /** 채팅 전송(연결 전이면 큐에 쌓았다가 open 후 flush) */
  sendChat(text: string) {
    assertValidWorldChatText(text);
    const localId = (crypto as any).randomUUID?.() ?? String(Date.now());
    const msg: WorldWsClientMessage = { type: "chat", text, localId } as any;

    const s = this.socket;
    if (!s || s.readyState !== WebSocket.OPEN) {
      this.pendingChat.push(msg);
      return;
    }
    this.#sendRaw(msg);
  }

  /** 클릭 이동 등 */
  moveTo(x: number, y: number, dir?: string) {
    if (!this.me) return;
    const updatedAt = Date.now();
    const next: PlayerState = { account: this.me, x, y, dir, updatedAt };
    this.players.set(this.me, next);
    this.serverTargets.set(this.me, next);
    this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
    this.#sendRaw({ type: "move", x, y, dir } as any);
  }

  /* ---------------- internal ---------------- */

  #syncAuth() {
    const has = !!tokenManager.getToken();
    if (has) this.connect();
    else this.disconnect();
  }

  #connectWS(token: string) {
    if (!this.desiredConnected) return;

    this.connecting = true;
    this.#clearReconnect();

    const wsUrl = buildWorldWsUrl(token);

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      this.connecting = false;
      this.dispatchEvent(new CustomEvent("error", { detail: err }));
      this.#scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.addEventListener("open", () => {
      this.connecting = false;
      this.reconnectDelayMs = 1200;
      this.dispatchEvent(new CustomEvent("connect"));
      this.#flushPendingChat();
    });

    socket.addEventListener("message", (ev: MessageEvent) => {
      this.#handleWsMessage(ev.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
      this.connecting = false;

      this.dispatchEvent(new CustomEvent("disconnect"));

      if (!this.desiredConnected) return;
      if (!tokenManager.getToken()) return;

      this.#scheduleReconnect();
    });

    socket.addEventListener("error", (e: Event) => {
      this.dispatchEvent(new CustomEvent("error", { detail: e }));
      try {
        socket.close();
      } catch { }
    });
  }

  #flushPendingChat() {
    const s = this.socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const pending = this.pendingChat;
    this.pendingChat = [];
    for (const msg of pending) this.#sendRaw(msg);
  }

  #handleWsMessage(raw: any) {
    let msg: WorldWsServerMessage | null = null;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : null;
    } catch {
      return;
    }
    if (!msg || typeof (msg as any).type !== "string") return;

    if (msg.type === "hello") {
      this.me = (msg as any).account;
      this.dispatchEvent(new CustomEvent("hello", { detail: msg }));
      return;
    }

    if (msg.type === "init") {
      this.me = (msg as any).me;

      this.players.clear();
      this.serverTargets.clear();

      const arr = (msg as any).players as PlayerState[];
      for (const p of arr) {
        this.players.set(p.account, { ...p });
        this.serverTargets.set(p.account, { ...p });
      }

      const recentMessages = ((msg as any).recentMessages ?? []) as ChatRow[];
      this.dispatchEvent(
        new CustomEvent("init", {
          detail: { me: this.me, players: this.players, recentMessages },
        })
      );
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      this.dispatchEvent(new CustomEvent("chat_history", { detail: recentMessages }));

      return;
    }

    if (msg.type === "chat") {
      this.dispatchEvent(new CustomEvent("chat", { detail: (msg as any).message }));
      return;
    }

    if (msg.type === "player_joined") {
      const p = (msg as any).player as PlayerState;
      this.players.set(p.account, { ...p });
      this.serverTargets.set(p.account, { ...p });
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      return;
    }

    if (msg.type === "player_left") {
      const account = (msg as any).account as EvmAddress;
      this.players.delete(account);
      this.serverTargets.delete(account);
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      return;
    }

    if (msg.type === "player_moved") {
      const account = (msg as any).account as EvmAddress;
      const next: PlayerState = {
        account,
        x: (msg as any).x,
        y: (msg as any).y,
        dir: (msg as any).dir,
        updatedAt: (msg as any).updatedAt,
      };

      const prev = this.serverTargets.get(account);
      // ✅ out-of-order 방지
      if (!prev || (prev.updatedAt ?? 0) <= (next.updatedAt ?? 0)) {
        this.serverTargets.set(account, next);
        if (!this.players.has(account)) this.players.set(account, { ...next });
      }
      return;
    }

    if (msg.type === "error") {
      this.dispatchEvent(new CustomEvent("error", { detail: new Error((msg as any).message) }));
      return;
    }
  }

  #sendRaw(msg: WorldWsClientMessage) {
    const s = this.socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    try {
      s.send(JSON.stringify(msg));
    } catch (err) {
      this.dispatchEvent(new CustomEvent("error", { detail: err }));
    }
  }

  #scheduleReconnect() {
    if (!this.desiredConnected) return;
    this.#clearReconnect();

    const delay = this.reconnectDelayMs;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectDelayMs = Math.min(Math.floor(this.reconnectDelayMs * 1.6), 15000);

      const token = tokenManager.getToken();
      if (!token) return;
      if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
      if (this.connecting) return;

      this.#connectWS(token);
    }, delay);
  }

  #clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  #ensureLoop() {
    if (this.runningLoop) return;
    this.runningLoop = true;
    this.lastFrameAt = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  #stopLoop() {
    this.runningLoop = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** ✅ 프레임 루프: (1) 내 이동 예측 (2) 원격 보간 (3) move throttle */
  private loop(now: number) {
    if (!this.runningLoop) return;

    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    // ---- 내 이동 예측 ----
    if (this.me) {
      const cur = this.players.get(this.me);
      if (cur && (this.inputDx !== 0 || this.inputDy !== 0)) {
        const nx = cur.x + this.inputDx * LOCAL_MOVE_SPEED * dt;
        const ny = cur.y + this.inputDy * LOCAL_MOVE_SPEED * dt;

        const dir =
          Math.abs(this.inputDx) > Math.abs(this.inputDy)
            ? this.inputDx > 0
              ? "right"
              : "left"
            : this.inputDy > 0
              ? "down"
              : "up";

        const updatedAt = Date.now();
        const next: PlayerState = { account: this.me, x: nx, y: ny, dir, updatedAt };

        this.players.set(this.me, next);
        this.serverTargets.set(this.me, next);

        if (now - this.lastMoveSentAt >= MOVE_SEND_INTERVAL_MS) {
          this.lastMoveSentAt = now;
          this.#sendRaw({ type: "move", x: nx, y: ny, dir } as any);
        }
      }
    }

    // ---- 원격 보간 ----
    let changed = false;
    for (const [account, target] of this.serverTargets.entries()) {
      if (this.me && account === this.me) continue;

      const cur = this.players.get(account);
      if (!cur) {
        this.players.set(account, { ...target });
        changed = true;
        continue;
      }

      const nx = expLerp(cur.x, target.x, dt, REMOTE_SMOOTH);
      const ny = expLerp(cur.y, target.y, dt, REMOTE_SMOOTH);

      const next: PlayerState = {
        ...cur,
        x: nx,
        y: ny,
        dir: target.dir ?? cur.dir,
        updatedAt: target.updatedAt ?? cur.updatedAt,
      };

      // 너무 자잘한 변동은 무시
      if (Math.abs(next.x - cur.x) > 1e-4 || Math.abs(next.y - cur.y) > 1e-4 || next.dir !== cur.dir) {
        this.players.set(account, next);
        changed = true;
      }
    }

    if (changed) this.dispatchEvent(new CustomEvent("players", { detail: this.players }));

    this.rafId = requestAnimationFrame(this.loop);
  }
}
