import { tokenManager } from "@gaiaprotocol/client-common";
import { assertValidWorldChatText, buildWorldWsUrl } from "../api/world";
import type {
  ChatRow,
  EvmAddress,
  PlayerState,
  WorldWsClientMessage,
  WorldWsServerMessage,
} from "../types/world";

import { globalProfileStore } from "../services/profile-store"; // ✅ 추가

type TokenProvider = () => string | null;

const MOVE_SEND_INTERVAL_MS = 60; // 서버로 move 보내는 최소 간격(ms)
const LOCAL_MOVE_SPEED = 200;     // units/sec
const REMOTE_SMOOTH = 14;         // 값이 클수록 타겟에 빨리 붙음(원격 보간)

// ✅ 클릭/탭 이동 튜닝
const AUTO_STOP_DISTANCE = 0.12;   // 이 거리 이내면 도착 처리 (world unit)
const AUTO_SLOW_RADIUS = 0.9;      // 이 거리 이내에선 감속 시작
const AUTO_MIN_SPEED_RATIO = 0.18; // 감속 시 최소 속도 비율(너무 기어가지 않게)

function expLerp(current: number, target: number, dt: number, k: number) {
  const t = 1 - Math.exp(-k * dt);
  return current + (target - current) * t;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
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
  public me: EvmAddress | null = null; // ✅ spectator면 null

  // ✅ server targets (원격 보간용)
  private serverTargets = new Map<EvmAddress, PlayerState>();

  // manual input (키보드/드래그 조이스틱)
  private inputDx = 0;
  private inputDy = 0;
  private lastMoveSentAt = 0;

  // ✅ 클릭/탭 이동 타겟
  private autoTarget: { x: number; y: number } | null = null;

  // chat queue (WS open 전 전송한 메시지 보장)
  private pendingChat: WorldWsClientMessage[] = [];

  // ✅ profile-updated 이벤트 핸들러(바인딩 유지)
  private onProfileUpdatedEvent = (e: Event) => {
    const ce = e as CustomEvent;
    const account = ce?.detail?.account as EvmAddress | undefined;
    if (!account) return;

    // 로그인 상태에서만 전파
    if (!tokenManager.getToken()) return;

    this.sendProfileUpdated();
  };

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

    // ✅ 오버레이에서 dispatch한 이벤트를 받아서 서버로 알림
    window.addEventListener("world:profile-updated", this.onProfileUpdatedEvent as any);
  }

  stop() {
    this.started = false;
    window.removeEventListener("world:profile-updated", this.onProfileUpdatedEvent as any); // ✅
    this.disconnect();
  }

  connect() {
    this.desiredConnected = true;
    this.#ensureLoop();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;

    // ✅ token 없어도 spectator로 연결
    const token = tokenManager.getToken(); // string | null
    this.#connectWS(token ?? undefined);
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
    this.autoTarget = null;
    this.inputDx = 0;
    this.inputDy = 0;

    this.dispatchEvent(new CustomEvent("disconnect"));
  }

  /** -1~1 (키보드/조이스틱). 입력이 들어오면 auto-move 취소 */
  setInputDirection(dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      this.inputDx = dx / len;
      this.inputDy = dy / len;
      this.autoTarget = null; // ✅ 수동 입력이 있으면 자동 이동 취소
    } else {
      this.inputDx = 0;
      this.inputDy = 0;
    }
  }

  /** ✅ 화면 클릭/탭 이동: 로그인 유저만 */
  setMoveTarget(x: number, y: number) {
    if (!this.me) return;
    this.autoTarget = { x, y };
    this.#ensureLoop();
  }

  /** ✅ 채팅 전송: 로그인 유저만 */
  sendChat(text: string) {
    if (!tokenManager.getToken()) return;

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

  /** ✅✅✅ 프로필 변경 전파(서버 → 전체 브로드캐스트 용) */
  sendProfileUpdated() {
    const s = this.socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    this.#sendRaw({ type: "profile_updated" } as any);
  }

  /* ---------------- internal ---------------- */

  #syncAuth() {
    // ✅ 로그인 여부와 관계없이 항상 connect해서 관전 가능
    this.connect();
  }

  #connectWS(token?: string) {
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

      if (tokenManager.getToken()) this.#flushPendingChat();
    });

    socket.addEventListener("message", (ev: MessageEvent) => {
      this.#handleWsMessage(ev.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
      this.connecting = false;

      this.dispatchEvent(new CustomEvent("disconnect"));

      if (!this.desiredConnected) return;
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
      this.me = ((msg as any).account ?? null) as any;
      this.dispatchEvent(new CustomEvent("hello", { detail: msg }));
      return;
    }

    if (msg.type === "init") {
      this.me = ((msg as any).me ?? null) as any;

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
      if (!prev || (prev.updatedAt ?? 0) <= (next.updatedAt ?? 0)) {
        this.serverTargets.set(account, next);
        if (!this.players.has(account)) this.players.set(account, { ...next });
      }
      return;
    }

    // ✅✅✅ 핵심: 누가 프로필을 바꿨다는 서버 신호를 받으면
    // 해당 account만 force refresh → 월드에서 update 이벤트로 appearance 적용됨
    if ((msg as any).type === "profile_updated") {
      const account = (msg as any).account as EvmAddress;
      void globalProfileStore.ensure([account] as any, { force: true });
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

      if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
      if (this.connecting) return;

      const token = tokenManager.getToken();
      this.#connectWS(token ?? undefined);
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

  /** ✅ 프레임 루프: (1) 내 이동(수동/자동) (2) 원격 보간 (3) move throttle */
  private loop(now: number) {
    if (!this.runningLoop) return;

    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    // ---- 내 이동 (로그인 유저만) ----
    if (this.me) {
      const cur = this.players.get(this.me);
      if (cur) {
        let mdx = this.inputDx;
        let mdy = this.inputDy;
        let speed = LOCAL_MOVE_SPEED;

        // ✅ 수동 입력이 없고 autoTarget이 있으면 그쪽으로 이동
        if (mdx === 0 && mdy === 0 && this.autoTarget) {
          const tx = this.autoTarget.x;
          const ty = this.autoTarget.y;
          const vx = tx - cur.x;
          const vy = ty - cur.y;
          const dist = Math.hypot(vx, vy);

          if (dist <= AUTO_STOP_DISTANCE) {
            this.autoTarget = null;
            mdx = 0;
            mdy = 0;
          } else {
            mdx = vx / dist;
            mdy = vy / dist;

            const slowT = clamp01(dist / AUTO_SLOW_RADIUS);
            const ratio = Math.max(AUTO_MIN_SPEED_RATIO, slowT);
            speed = LOCAL_MOVE_SPEED * ratio;

            const step = speed * dt;
            if (step >= dist) {
              const dir =
                Math.abs(mdx) > Math.abs(mdy)
                  ? mdx > 0 ? "right" : "left"
                  : mdy > 0 ? "down" : "up";

              const updatedAt = Date.now();
              const next: PlayerState = { account: this.me!, x: tx, y: ty, dir, updatedAt };

              this.players.set(this.me!, next);
              this.serverTargets.set(this.me!, next);
              this.autoTarget = null;

              if (now - this.lastMoveSentAt >= MOVE_SEND_INTERVAL_MS) {
                this.lastMoveSentAt = now;
                this.#sendRaw({ type: "move", x: tx, y: ty, dir } as any);
              }
            }
          }
        }

        if (mdx !== 0 || mdy !== 0) {
          const nx = cur.x + mdx * speed * dt;
          const ny = cur.y + mdy * speed * dt;

          const dir =
            Math.abs(mdx) > Math.abs(mdy)
              ? mdx > 0 ? "right" : "left"
              : mdy > 0 ? "down" : "up";

          const updatedAt = Date.now();
          const next: PlayerState = { account: this.me, x: nx, y: ny, dir, updatedAt };

          this.players.set(this.me, next);
          this.serverTargets.set(this.me, next);

          this.dispatchEvent(new CustomEvent("players", { detail: this.players }));

          if (now - this.lastMoveSentAt >= MOVE_SEND_INTERVAL_MS) {
            this.lastMoveSentAt = now;
            this.#sendRaw({ type: "move", x: nx, y: ny, dir } as any);
          }
        }
      }
    }

    // ---- 원격 보간 (관전자도 수행) ----
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

      if (
        Math.abs(next.x - cur.x) > 1e-4 ||
        Math.abs(next.y - cur.y) > 1e-4 ||
        next.dir !== cur.dir
      ) {
        this.players.set(account, next);
        changed = true;
      }
    }

    if (changed) this.dispatchEvent(new CustomEvent("players", { detail: this.players }));

    this.rafId = requestAnimationFrame(this.loop);
  }
}
