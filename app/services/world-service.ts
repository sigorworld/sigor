import { tokenManager } from '@gaiaprotocol/client-common';
import { assertValidWorldChatText, buildWorldWsUrl } from '../api/world';
import type {
  ChatRow,
  EvmAddress,
  PlayerState,
  WorldWsClientMessage,
  WorldWsServerMessage,
} from '../types/world';

type InitDetail = { me: EvmAddress; players: Map<EvmAddress, PlayerState>; recentMessages: ChatRow[] };

export class WorldService extends EventTarget {
  private socket: WebSocket | null = null;
  private stopped = false;

  private reconnectDelay = 1200;
  private reconnectTimer: number | null = null;

  // state
  public me: EvmAddress | null = null;
  public players = new Map<EvmAddress, PlayerState>();

  // client-side movement prediction
  private inputDx = 0;
  private inputDy = 0;
  private moveSpeed = 3.2; // units/sec
  private lastFrameAt = 0;

  // ws move send throttling
  private lastMoveSentAt = 0;
  private moveSendIntervalMs = 60;

  constructor() {
    super();
    this.loop = this.loop.bind(this);
  }

  /* -------------------------- public -------------------------- */

  connect() {
    this.stopped = false;
    this.#connectWS();
    this.lastFrameAt = performance.now();
    requestAnimationFrame(this.loop);
  }

  disconnect() {
    this.stopped = true;
    this.#clearReconnect();
    this.socket?.close();
    this.socket = null;

    this.me = null;
    this.players.clear();
    this.dispatchEvent(new CustomEvent('disconnect'));
  }

  /** 채팅 전송 (WS) */
  sendChat(text: string) {
    assertValidWorldChatText(text);
    const localId = crypto.randomUUID?.() ?? String(Date.now());
    this.send({ type: 'chat', text, localId });
  }

  /** 이동 입력(키보드/패드) : -1~1 범위 권장 */
  setInputDirection(dx: number, dy: number) {
    // normalize
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      this.inputDx = dx / len;
      this.inputDy = dy / len;
    } else {
      this.inputDx = 0;
      this.inputDy = 0;
    }
  }

  /** 옵션: 좌표를 직접 지정해서 보내고 싶을 때(클릭 이동 등) */
  moveTo(x: number, y: number, dir?: string) {
    if (!this.me) return;
    const p = this.players.get(this.me);
    const updatedAt = Date.now();
    const next: PlayerState = { account: this.me, x, y, dir, updatedAt };
    this.players.set(this.me, next);
    this.dispatchEvent(new CustomEvent('players', { detail: this.players }));

    this.send({ type: 'move', x, y, dir });
  }

  /* ---------------------- private helpers --------------------- */

  #connectWS() {
    if (this.stopped) return;

    const token = tokenManager.getToken?.() ?? tokenManager.getToken?.();
    if (!token) {
      this.dispatchEvent(new CustomEvent('error', { detail: new Error('No token') }));
      return;
    }

    const wsUrl = buildWorldWsUrl(token);

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
      this.#scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectDelay = 1200;
      this.dispatchEvent(new CustomEvent('connect'));
    });

    socket.addEventListener('message', (ev) => {
      this.#handleWsMessage(ev.data);
    });

    socket.addEventListener('close', () => {
      this.socket = null;
      this.dispatchEvent(new CustomEvent('disconnect'));
      if (!this.stopped) this.#scheduleReconnect();
    });

    socket.addEventListener('error', (e) => {
      this.dispatchEvent(new CustomEvent('error', { detail: e }));
      try { socket.close(); } catch { }
    });
  }

  #handleWsMessage(raw: any) {
    let msg: WorldWsServerMessage | null = null;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof (msg as any).type !== 'string') return;

    if (msg.type === 'hello') {
      this.me = msg.account;
      this.dispatchEvent(new CustomEvent('hello', { detail: msg }));
      return;
    }

    if (msg.type === 'init') {
      this.me = msg.me;
      this.players.clear();
      for (const p of msg.players) this.players.set(p.account, p);

      const detail: InitDetail = {
        me: msg.me,
        players: this.players,
        recentMessages: msg.recentMessages,
      };

      this.dispatchEvent(new CustomEvent('init', { detail }));
      this.dispatchEvent(new CustomEvent('players', { detail: this.players }));
      this.dispatchEvent(new CustomEvent('chat_history', { detail: msg.recentMessages }));
      return;
    }

    if (msg.type === 'chat') {
      this.dispatchEvent(new CustomEvent('chat', { detail: msg.message }));
      return;
    }

    if (msg.type === 'player_joined') {
      this.players.set(msg.player.account, msg.player);
      this.dispatchEvent(new CustomEvent('players', { detail: this.players }));
      return;
    }

    if (msg.type === 'player_left') {
      this.players.delete(msg.account);
      this.dispatchEvent(new CustomEvent('players', { detail: this.players }));
      return;
    }

    if (msg.type === 'player_moved') {
      const next: PlayerState = {
        account: msg.account,
        x: msg.x,
        y: msg.y,
        dir: msg.dir,
        updatedAt: msg.updatedAt,
      };
      this.players.set(msg.account, next);
      this.dispatchEvent(new CustomEvent('players', { detail: this.players }));
      return;
    }

    if (msg.type === 'error') {
      this.dispatchEvent(new CustomEvent('error', { detail: new Error(msg.message) }));
      return;
    }
  }

  private send(msg: WorldWsClientMessage) {
    const s = this.socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    try {
      s.send(JSON.stringify(msg));
    } catch (err) {
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    }
  }

  #scheduleReconnect() {
    if (this.stopped) return;
    this.#clearReconnect();

    const delay = this.reconnectDelay;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectDelay = Math.min(Math.floor(this.reconnectDelay * 1.6), 15000);
      this.#connectWS();
    }, delay);
  }

  #clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** client-side movement loop (예측 이동 + 서버 move throttle) */
  private loop(now: number) {
    if (this.stopped) return;

    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    if (this.me) {
      const p = this.players.get(this.me);
      if (p && (this.inputDx !== 0 || this.inputDy !== 0)) {
        const nx = p.x + this.inputDx * this.moveSpeed * dt;
        const ny = p.y + this.inputDy * this.moveSpeed * dt;

        const dir =
          Math.abs(this.inputDx) > Math.abs(this.inputDy)
            ? this.inputDx > 0
              ? 'right'
              : 'left'
            : this.inputDy > 0
              ? 'down'
              : 'up';

        const updatedAt = Date.now();
        const next: PlayerState = { account: this.me, x: nx, y: ny, dir, updatedAt };
        this.players.set(this.me, next);
        this.dispatchEvent(new CustomEvent('players', { detail: this.players }));

        // throttle send
        if (now - this.lastMoveSentAt >= this.moveSendIntervalMs) {
          this.lastMoveSentAt = now;
          this.send({ type: 'move', x: nx, y: ny, dir });
        }
      }
    }

    requestAnimationFrame(this.loop);
  }
}
