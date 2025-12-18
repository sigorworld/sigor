import { AnimatedSpriteNode, DomContainerNode, GameObject, RectangleNode } from "kiwiengine";
import { defaultCharacterData, resolveCharacterAnimation } from "../services/character-data";
import type { CharacterData } from "../types/character";
import type { PlayerState } from "../types/world";

export abstract class Character extends GameObject {
  private data: CharacterData;
  private sprite: any | null = null;

  private lastX = 0;
  private lastY = 0;
  private lastDir: string | undefined;
  private lastAnim = "";

  // UI
  private nameEl: HTMLDivElement;
  private bubbleEl: HTMLDivElement;
  private bubbleHideTimer: number | null = null;

  constructor(opts?: { data?: CharacterData }) {
    super({ layer: "world", useYSort: true } as any);

    this.data = opts?.data ?? defaultCharacterData;

    // ✅ 닉네임(아래)
    this.nameEl = document.createElement("div");
    this.nameEl.className = "name-tag";
    this.nameEl.textContent = "";
    const nameNode = new DomContainerNode(this.nameEl, { x: 0, y: 26, layer: "hud" } as any);
    this.add(nameNode);

    // ✅ 말풍선(위)
    this.bubbleEl = document.createElement("div");
    this.bubbleEl.className = "speech";
    this.bubbleEl.style.display = "none";
    const bubbleNode = new DomContainerNode(this.bubbleEl, { x: 0, y: -34, layer: "hud" } as any);
    this.add(bubbleNode);

    this.#buildVisual();
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
    const moving = Math.hypot(dx, dy) > 0.001;

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
      } as any);

      this.sprite = node;
      this.add(node);
      this.scaleX = initial.flipX ? -1 : 1;
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
    this.add(box);
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

    this.scaleX = flipX ? -1 : 1;

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
