import type { Renderer } from "kiwiengine";
import type { WorldService } from "../services/world-service";

function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  const he = el as HTMLElement;
  if (he.isContentEditable) return true;
  return false;
}

export class WorldInputController {
  private pressed = new Set<string>();
  private attached = false;

  // touch joystick
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  // 튜닝값
  private deadZone = 10;      // px
  private maxDistance = 70;   // px

  constructor(
    private service: WorldService,
    private renderer: Renderer,
    private targetEl: HTMLElement // ✅ world 영역
  ) { }

  attach() {
    if (this.attached) return;
    this.attached = true;

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: true });
    window.addEventListener("blur", this.onBlur, { passive: true });

    // ✅ 터치/마우스 드래그
    this.targetEl.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp, { passive: true });
    window.addEventListener("pointercancel", this.onPointerUp, { passive: true });
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;

    window.removeEventListener("keydown", this.onKeyDown as any);
    window.removeEventListener("keyup", this.onKeyUp as any);
    window.removeEventListener("blur", this.onBlur as any);

    this.targetEl.removeEventListener("pointerdown", this.onPointerDown as any);
    window.removeEventListener("pointermove", this.onPointerMove as any);
    window.removeEventListener("pointerup", this.onPointerUp as any);
    window.removeEventListener("pointercancel", this.onPointerUp as any);

    this.pressed.clear();
    this.pointerId = null;
    this.service.setInputDirection(0, 0);
  }

  private onBlur = () => {
    this.pressed.clear();
    this.pointerId = null;
    this.service.setInputDirection(0, 0);
  };

  // ---------------- keyboard ----------------
  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(document.activeElement)) return;

    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
      e.preventDefault();
      this.pressed.add(key);
      this.updateDirFromKeys();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      this.updateDirFromKeys();
    }
  };

  private updateDirFromKeys() {
    let dx = 0;
    let dy = 0;

    if (this.pressed.has("a") || this.pressed.has("arrowleft")) dx -= 1;
    if (this.pressed.has("d") || this.pressed.has("arrowright")) dx += 1;
    if (this.pressed.has("w") || this.pressed.has("arrowup")) dy -= 1;
    if (this.pressed.has("s") || this.pressed.has("arrowdown")) dy += 1;

    // 키보드 입력이 있으면 터치 입력 해제
    if (dx !== 0 || dy !== 0) this.pointerId = null;

    this.service.setInputDirection(dx, dy);
  }

  // ---------------- touch / pointer joystick ----------------
  private onPointerDown = (e: PointerEvent) => {
    if (isTypingTarget(document.activeElement)) return;

    // 스크롤 방지
    e.preventDefault();

    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.moved = false;

    // 기존 키보드 입력 제거
    this.pressed.clear();
    this.service.setInputDirection(0, 0);

    try {
      (this.targetEl as any).setPointerCapture?.(e.pointerId);
    } catch { }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;

    e.preventDefault();

    const dxPx = e.clientX - this.startX;
    const dyPx = e.clientY - this.startY;
    const dist = Math.hypot(dxPx, dyPx);

    if (dist < this.deadZone) {
      this.service.setInputDirection(0, 0);
      return;
    }

    this.moved = true;

    const clamped = Math.min(dist, this.maxDistance);
    const nx = (dxPx / dist) * (clamped / this.maxDistance);
    const ny = (dyPx / dist) * (clamped / this.maxDistance);

    this.service.setInputDirection(nx, ny);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;

    this.pointerId = null;
    this.service.setInputDirection(0, 0);
  };
}
