import {
  AnimatedSpriteNode,
  DomContainerNode,
  GameObject,
  RectangleNode,
} from "kiwiengine";
import { resolveCharacterAnimation } from "../services/character-data";
import type { CharacterData } from "../types/character";
import type { PlayerState } from "../types/world";

const MOVE_EPS = 0.25;
const IDLE_TIMEOUT_MS = 110;

export abstract class Character extends GameObject {
  private data: CharacterData | null = null;

  // 스프라이트만 담는 컨테이너(여기만 flip)
  private spriteRoot: GameObject;
  private sprite: any | null = null;

  private lastX = 0;
  private lastY = 0;
  private lastDir: string | undefined;
  private lastAnim = "";

  private lastMotionAt = 0;
  private idleTimer: number | null = null;

  // UI
  private nameEl: HTMLDivElement;
  private bubbleEl: HTMLDivElement;
  private bubbleHideTimer: number | null = null;

  // ✅ “현재 비주얼 리소스가 무엇인지”를 나타내는 키 (같으면 rebuild 금지)
  private visualKey = "fallback";

  constructor() {
    super({ layer: "world", useYSort: true } as any);

    this.spriteRoot = new GameObject({ layer: "world" } as any);
    this.add(this.spriteRoot);

    // 닉네임(아래)
    this.nameEl = document.createElement("div");
    this.nameEl.className = "name-tag";
    this.nameEl.textContent = "";
    const nameNode = new DomContainerNode(this.nameEl, { x: 0, y: 26, layer: "hud" } as any);
    this.add(nameNode);

    // 말풍선(위)
    this.bubbleEl = document.createElement("div");
    this.bubbleEl.className = "speech";
    this.bubbleEl.style.display = "none";
    const bubbleNode = new DomContainerNode(this.bubbleEl, { x: 0, y: -64, layer: "hud" } as any);
    this.add(bubbleNode);

    // ✅ 초기 fallback
    this.#buildFallback();
  }

  override remove() {
    if (this.bubbleHideTimer) window.clearTimeout(this.bubbleHideTimer);
    this.bubbleHideTimer = null;

    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.idleTimer = null;

    super.remove();
  }

  setNickname(nicknameOrAddress: string) {
    this.nameEl.textContent = nicknameOrAddress;
  }

  showSpeech(text: string, ms = 2200) {
    this.bubbleEl.textContent = text;
    this.bubbleEl.style.display = "block";

    if (this.bubbleHideTimer) window.clearTimeout(this.bubbleHideTimer);
    this.bubbleHideTimer = window.setTimeout(() => {
      this.bubbleEl.style.display = "none";
      this.bubbleHideTimer = null;
    }, ms);
  }

  /**
   * ✅ 외형(리소스) 바뀔 때만 rebuild
   * - 같은 리소스면 절대 rebuild 안 함
   */
  setCharacterData(next: CharacterData | null | undefined) {
    const nextData = next ?? null;
    const nextKey = this.#calcVisualKey(nextData);

    // ✅ 같은 비주얼이면 rebuild 금지
    if (nextKey === this.visualKey) {
      this.data = nextData;
      return;
    }

    this.visualKey = nextKey;
    this.data = nextData;
    this.#rebuildVisual();
  }

  applyPlayerState(p: PlayerState) {
    this.lastX = this.x;
    this.lastY = this.y;

    this.x = p.x;
    this.y = p.y;

    if (p.dir) this.lastDir = p.dir;

    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    const moving = Math.hypot(dx, dy) > MOVE_EPS;

    if (moving) {
      this.lastMotionAt = performance.now();
      if (this.idleTimer) window.clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => {
        const since = performance.now() - this.lastMotionAt;
        if (since >= IDLE_TIMEOUT_MS) {
          this.#applyAnimation({ dir: this.lastDir, moving: false });
        }
      }, IDLE_TIMEOUT_MS + 5);
    } else {
      if (this.idleTimer) window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.#applyAnimation({ dir: this.lastDir, moving });
  }

  // ---------------------------
  // Visual Build / Rebuild
  // ---------------------------

  #rebuildVisual() {
    this.#clearSpriteRoot();

    if (this.data) this.#buildFromData(this.data);
    else this.#buildFallback();

    // 데이터 교체 직후 애니메이션 재적용
    this.lastAnim = "";
    this.#applyAnimation({ dir: this.lastDir ?? "down", moving: false });
  }

  #clearSpriteRoot() {
    try {
      const children: any[] = (this.spriteRoot as any).children ?? [];
      for (const c of children) {
        if (typeof c.remove === "function") c.remove();
      }
    } catch {
      // ignore
    }

    this.sprite = null;
    this.spriteRoot.scaleX = 1;
  }

  #buildFromData(data: CharacterData) {
    const spriteType = (data as any).spriteType;
    const src = (data as any).src as string | undefined;
    const atlas = (data as any).atlas;
    const actions = (data as any).actions;

    if (spriteType === "spritesheet" && src && atlas && actions) {
      const initial = resolveCharacterAnimation({
        actions,
        dir: this.lastDir ?? "down",
        moving: false,
      });

      const node = new AnimatedSpriteNode({
        src,
        atlas,
        animation: initial.animation,
        fps: 12,
        loop: initial.loop,
        layer: "world",
        scale: (data as any).scale,
        pivotX: (data as any).pivotX,
        pivotY: (data as any).pivotY,
      } as any);

      this.sprite = node;
      this.spriteRoot.add(node);

      this.spriteRoot.scaleX = initial.flipX ? -1 : 1;
      this.lastAnim = initial.animation;
      return;
    }

    this.#buildFallback();
  }

  #buildFallback() {
    const box = new RectangleNode({
      width: 18,
      height: 26,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 1 },
      layer: "world",
    } as any);

    this.spriteRoot.add(box);
    this.sprite = null;
    this.spriteRoot.scaleX = 1;
    this.lastAnim = "";
  }

  #applyAnimation(params: { dir?: string; moving: boolean }) {
    const data = this.data;
    const actions = data ? (data as any).actions : null;
    if (!actions) return; // fallback은 애니메이션 없음

    const { animation, loop, flipX } = resolveCharacterAnimation({
      actions,
      dir: params.dir,
      moving: params.moving,
    });

    this.spriteRoot.scaleX = flipX ? -1 : 1;

    if (!this.sprite) return;
    if (this.lastAnim === animation) return;
    this.lastAnim = animation;

    const s: any = this.sprite;
    if (typeof s.setAnimation === "function") return void s.setAnimation(animation, loop);
    if (typeof s.play === "function") return void s.play(animation, loop);
    s.animation = animation;
    if ("loop" in s) s.loop = loop;
  }

  /**
   * ✅ “이 데이터가 같은 리소스냐?”를 판단하는 키 생성
   * - getCharacterData가 atlasKey 같은 안정 키를 넣어주면 베스트
   */
  #calcVisualKey(data: CharacterData | null) {
    if (!data) return "fallback";
    const d: any = data;

    const atlasKey =
      d.atlasKey ??
      d.atlas?.meta?.image ??
      d.atlas?.image ??
      JSON.stringify(d.atlas ?? {})?.slice(0, 200); // 최후 수단 (너무 커지는 걸 방지)

    return [
      d.spriteType ?? "",
      d.src ?? "",
      atlasKey ?? "",
      d.scale ?? 1,
      d.pivotX ?? 0,
      d.pivotY ?? 0,
    ].join("|");
  }
}
