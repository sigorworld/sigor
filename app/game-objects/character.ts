import { AnimatedSpriteNode, DomContainerNode, GameObject, RectangleNode } from "kiwiengine";
import { defaultCharacterData, resolveCharacterAnimation } from "../services/character-data";
import type { CharacterData } from "../types/character";
import type { PlayerState } from "../types/world";

const MOVE_EPS = 0.25;          // 좌표 단위가 px에 가까우면 0.001은 너무 작습니다.
const IDLE_TIMEOUT_MS = 110;    // 마지막 움직임 이후 이 시간 지나면 idle로 전환

export abstract class Character extends GameObject {
  private data: CharacterData;

  // ✅ 스프라이트만 담는 컨테이너(여기만 flip)
  private spriteRoot: GameObject;
  private sprite: any | null = null;

  private lastX = 0;
  private lastY = 0;
  private lastDir: string | undefined;
  private lastAnim = "";

  // idle 강제 전환 타이머(“마지막 업데이트 이후 이벤트가 더 안 오는” 케이스 방지)
  private lastMotionAt = 0;
  private idleTimer: number | null = null;

  // UI
  private nameEl: HTMLDivElement;
  private bubbleEl: HTMLDivElement;
  private bubbleHideTimer: number | null = null;

  constructor(opts?: { data?: CharacterData }) {
    super({ layer: "world", useYSort: true } as any);

    this.data = opts?.data ?? defaultCharacterData;

    // ✅ (중요) 스프라이트 루트 먼저 추가
    this.spriteRoot = new GameObject({ layer: "world" } as any);
    this.add(this.spriteRoot);

    // ✅ 닉네임(아래) - 더 이상 flip 안됨
    this.nameEl = document.createElement("div");
    this.nameEl.className = "name-tag";
    this.nameEl.textContent = "";
    const nameNode = new DomContainerNode(this.nameEl, { x: 0, y: 26, layer: "hud" } as any);
    this.add(nameNode);

    // ✅ 말풍선(위) - 더 이상 flip 안됨
    this.bubbleEl = document.createElement("div");
    this.bubbleEl.className = "speech";
    this.bubbleEl.style.display = "none";
    const bubbleNode = new DomContainerNode(this.bubbleEl, { x: 0, y: -64, layer: "hud" } as any);
    this.add(bubbleNode);

    this.#buildVisual();
  }

  // ✅ 제거 시 타이머 정리
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

  applyPlayerState(p: PlayerState) {
    this.lastX = this.x;
    this.lastY = this.y;

    this.x = p.x;
    this.y = p.y;

    if (p.dir) this.lastDir = p.dir;

    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    const moving = Math.hypot(dx, dy) > MOVE_EPS;

    // ✅ 이동 중이면 마지막 움직임 시간 갱신 + idle 타이머 예약
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
      // 멈췄으면 예약된 타이머 제거
      if (this.idleTimer) window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.#applyAnimation({ dir: this.lastDir, moving });
  }

  #buildVisual() {
    const spriteType = (this.data as any).spriteType;
    const src = (this.data as any).src as string | undefined;
    const atlas = (this.data as any).atlas;

    if (spriteType === "spritesheet" && src && atlas) {
      const initial = resolveCharacterAnimation({
        actions: (this.data as any).actions,
        dir: "down",
        moving: false,
      });

      const node = new AnimatedSpriteNode({
        src,
        atlas,
        animation: initial.animation,
        fps: 12,
        loop: initial.loop,
        layer: "world",
        scale: this.data.scale,
        pivotX: this.data.pivotX,
        pivotY: this.data.pivotY,
      } as any);

      this.sprite = node;
      this.spriteRoot.add(node);

      // ✅ flip은 spriteRoot에만
      this.spriteRoot.scaleX = initial.flipX ? -1 : 1;

      this.lastAnim = initial.animation;
      return;
    }

    // fallback
    const box = new RectangleNode({
      width: 18,
      height: 26,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 1 },
      layer: "world",
    } as any);

    this.spriteRoot.add(box);
    this.sprite = null;
  }

  #applyAnimation(params: { dir?: string; moving: boolean }) {
    const actions = (this.data as any).actions;
    if (!actions) return;

    const { animation, loop, flipX } = resolveCharacterAnimation({
      actions,
      dir: params.dir,
      moving: params.moving,
    });

    // ✅ flip은 spriteRoot에만
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
}
