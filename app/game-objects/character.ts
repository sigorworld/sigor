import { AnimatedSpriteNode, GameObject, RectangleNode } from "kiwiengine";
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

  constructor(opts?: { data?: CharacterData }) {
    super({
      layer: "world",
      useYSort: true,
    } as any);

    this.data = opts?.data ?? defaultCharacterData;
    this.#buildVisual();
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
    // spritesheet 있으면 사용, 없으면 fallback 도형
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

    // 다양한 엔진 구현 차이를 견디도록 "있으면 쓰고, 없으면 대입"
    const s: any = this.sprite;
    if (typeof s.setAnimation === "function") {
      s.setAnimation(animation, loop);
      return;
    }
    if (typeof s.play === "function") {
      s.play(animation, loop);
      return;
    }
    s.animation = animation;
    if ("loop" in s) s.loop = loop;
  }
}
