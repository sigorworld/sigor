import { tokenManager } from "@gaiaprotocol/client-common";
import { assertValidWorldChatText, buildWorldWsUrl } from "../api/world";
import type {
  ChatRow,
  EvmAddress,
  PlayerState,
  WorldWsClientMessage,
  WorldWsServerMessage,
} from "../types/world";

type InitDetail = {
  me: EvmAddress;
  players: Map<EvmAddress, PlayerState>;
  recentMessages: ChatRow[];
};

type TokenProvider = () => string | null;

/**
 * WorldService
 * - WebSocket 연결/재연결/토큰 변화 처리
 * - 플레이어 상태 유지 (players, me)
 * - client-side movement prediction + throttle move send
 * - UI는 이 서비스 이벤트만 구독
 */
export class WorldService extends EventTarget {
  // ws
  private socket: WebSocket | null = null;
  private desiredConnected = false;
  private connecting = false;

  // auto auth wiring
  private started = false;

  // reconnect
  private reconnectDelayMs = 1200;
  private reconnectTimer: number | null = null;

  // raf loop
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private runningLoop = false;

  // state
  public me: EvmAddress | null = null;
  public players = new Map<EvmAddress, PlayerState>();

  // movement prediction
  private inputDx = 0;
  private inputDy = 0;
  private moveSpeed = 3.2; // units/sec
  private lastMoveSentAt = 0;
  private moveSendIntervalMs = 60;

  constructor(opts?: { tokenProvider?: TokenProvider }) {
    super();

    this.loop = this.loop.bind(this);
  }

  /**
   * 서비스 자동 시작:
   * - signedIn/signedOut에 따라 자동 connect/disconnect
   * - 한 번만 호출되도록 idempotent
   */
  start() {
    if (this.started) return;
    this.started = true;

    // 최초 상태 반영
    this.#syncAuth();

    // tokenManager 이벤트에 반응 (UI가 아니라 서비스 레이어에서 처리)
    tokenManager.on("signedIn", () => this.#syncAuth());
    tokenManager.on("signedOut", () => this.#syncAuth());
  }

  stop() {
    // tokenManager.off가 없는 구조일 수 있어 stop은 최소 기능만 제공
    this.started = false;
    this.disconnect();
  }

  /** 명시적으로 연결하고 싶을 때(자동모드와 병행 가능) */
  connect() {
    this.desiredConnected = true;
    this.#ensureLoop();

    // 이미 열려있거나 여는 중이면 종료
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

    // state reset
    this.me = null;
    this.players.clear();
    this.dispatchEvent(new CustomEvent("disconnect"));
  }

  /** 채팅 전송 (WS) */
  sendChat(text: string) {
    assertValidWorldChatText(text);
    const localId = (crypto as any).randomUUID?.() ?? String(Date.now());
    this.send({ type: "chat", text, localId });
  }

  /** 이동 입력: -1~1 범위 권장 */
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

  /** 클릭 이동 등으로 좌표를 직접 지정해서 보내고 싶을 때 */
  moveTo(x: number, y: number, dir?: string) {
    if (!this.me) return;
    const updatedAt = Date.now();
    const next: PlayerState = { account: this.me, x, y, dir, updatedAt };
    this.players.set(this.me, next);
    this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
    this.send({ type: "move", x, y, dir });
  }

  /* --------------------------- internal --------------------------- */

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

    const onOpen = () => {
      this.connecting = false;
      this.reconnectDelayMs = 1200;
      this.dispatchEvent(new CustomEvent("connect"));
    };

    const onMessage = (ev: MessageEvent) => {
      this.#handleWsMessage(ev.data);
    };

    const onClose = () => {
      // socket 정리
      if (this.socket === socket) this.socket = null;
      this.connecting = false;

      this.dispatchEvent(new CustomEvent("disconnect"));

      // 원치 않는 상태면 재연결 안 함
      if (!this.desiredConnected) return;

      // 토큰 없으면 재연결 보류
      const t = tokenManager.getToken();
      if (!t) return;

      this.#scheduleReconnect();
    };

    const onError = (e: Event) => {
      this.dispatchEvent(new CustomEvent("error", { detail: e }));
      try {
        socket.close();
      } catch { }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
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
      this.me = msg.account;
      this.dispatchEvent(new CustomEvent("hello", { detail: msg }));
      return;
    }

    if (msg.type === "init") {
      this.me = msg.me;
      this.players.clear();
      for (const p of msg.players) this.players.set(p.account, p);

      const detail: InitDetail = {
        me: msg.me,
        players: this.players,
        recentMessages: msg.recentMessages,
      };

      this.dispatchEvent(new CustomEvent("init", { detail }));
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      this.dispatchEvent(new CustomEvent("chat_history", { detail: msg.recentMessages }));
      return;
    }

    if (msg.type === "chat") {
      this.dispatchEvent(new CustomEvent("chat", { detail: msg.message }));
      return;
    }

    if (msg.type === "player_joined") {
      this.players.set(msg.player.account, msg.player);
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      return;
    }

    if (msg.type === "player_left") {
      this.players.delete(msg.account);
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      return;
    }

    if (msg.type === "player_moved") {
      const next: PlayerState = {
        account: msg.account,
        x: msg.x,
        y: msg.y,
        dir: msg.dir,
        updatedAt: msg.updatedAt,
      };
      this.players.set(msg.account, next);
      this.dispatchEvent(new CustomEvent("players", { detail: this.players }));
      return;
    }

    if (msg.type === "error") {
      this.dispatchEvent(new CustomEvent("error", { detail: new Error(msg.message) }));
      return;
    }
  }

  private send(msg: WorldWsClientMessage) {
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
      // 백오프
      this.reconnectDelayMs = Math.min(Math.floor(this.reconnectDelayMs * 1.6), 15000);

      // 토큰 없으면 재시도 중단
      const token = tokenManager.getToken();
      if (!token) return;

      // 이미 연결됐으면 종료
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

  /** client-side movement loop (예측 이동 + 서버 move throttle) */
  private loop(now: number) {
    if (!this.runningLoop) return;

    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    // 예측 이동: 연결 중/끊김이어도 로컬 상태는 움직일 수 있는데,
    // 실사용에서는 me가 없으면(hello/init 전) 움직이지 않게 두는 게 안전.
    if (this.me) {
      const p = this.players.get(this.me);
      if (p && (this.inputDx !== 0 || this.inputDy !== 0)) {
        const nx = p.x + this.inputDx * this.moveSpeed * dt;
        const ny = p.y + this.inputDy * this.moveSpeed * dt;

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
        this.dispatchEvent(new CustomEvent("players", { detail: this.players }));

        // throttle send
        if (now - this.lastMoveSentAt >= this.moveSendIntervalMs) {
          this.lastMoveSentAt = now;
          this.send({ type: "move", x: nx, y: ny, dir });
        }
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  }
}
