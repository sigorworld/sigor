import type { Renderer } from "kiwiengine";
import { GameNode } from "kiwiengine";
import type { WorldService } from "../services/world-service";
import type { PlayerState } from "../types/world";

export class WorldInputController extends GameNode<{}> {
  private keys = new Set<string>();
  private target: { x: number; y: number } | null = null;
  private pointerDown = false;

  private enabled = true;
  private arriveDistance = 0.15;

  constructor(private service: WorldService, private renderer: Renderer) {
    super();
  }

  attach() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);

    const c = this.renderer.container;
    c.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    c.addEventListener("pointermove", this.onPointerMove, { passive: false });
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown as any);
    window.removeEventListener("keyup", this.onKeyUp as any);

    const c = this.renderer.container;
    c.removeEventListener("pointerdown", this.onPointerDown as any);
    c.removeEventListener("pointermove", this.onPointerMove as any);
    c.removeEventListener("pointerup", this.onPointerUp as any);
    c.removeEventListener("pointercancel", this.onPointerUp as any);

    this.keys.clear();
    this.target = null;
    this.pointerDown = false;
    this.service.setInputDirection(0, 0);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.target = null;
      this.pointerDown = false;
      this.service.setInputDirection(0, 0);
    }
  }

  /** game loop에서 호출 */
  update() {
    if (!this.enabled) return;

    const kb = this.getKeyboardDirection();
    if (kb) {
      this.target = null;
      this.service.setInputDirection(kb.dx, kb.dy);
      return;
    }

    if (!this.target) {
      this.service.setInputDirection(0, 0);
      return;
    }

    const me = this.service.me;
    if (!me) return;

    const p = this.service.players.get(me) as PlayerState | undefined;
    if (!p) return;

    const dx = this.target.x - p.x;
    const dy = this.target.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.arriveDistance) {
      this.target = null;
      this.service.setInputDirection(0, 0);
      return;
    }

    // normalize는 service 내부에서 함
    this.service.setInputDirection(dx, dy);
  }

  private getKeyboardDirection() {
    let dx = 0, dy = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;
    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();
    this.pointerDown = true;
    this.target = this.renderer.screenToWorld(e.clientX, e.clientY);

    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.enabled || !this.pointerDown) return;
    e.preventDefault();
    // 드래그로 목표 갱신(원치 않으면 제거)
    this.target = this.renderer.screenToWorld(e.clientX, e.clientY);
  };

  private onPointerUp = () => {
    this.pointerDown = false;
  };
}
