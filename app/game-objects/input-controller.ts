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

// ✅ 폴백 변환(엔진 변환 함수가 없을 때만 사용)
// - 화면 중앙을 (0,0)으로 보고
// - 1 world unit = 32 CSS px 로 가정
const FALLBACK_PX_PER_UNIT = 32;

export class WorldInputController {
  private pressed = new Set<string>();
  private attached = false;

  // pointer
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startAt = 0;
  private moved = false;

  // 튜닝값
  private deadZone = 10;      // px (조이스틱 무시 구간)
  private maxDistance = 70;   // px (조이스틱 최대치)
  private tapMoveMaxTime = 260;   // ms (이 시간 안에 떼면 탭으로 간주)
  private tapMoveMaxDist = 8;     // px (이 거리 안이면 탭으로 간주)

  constructor(
    private service: WorldService,
    private renderer: Renderer,
    private targetEl: HTMLElement // world 영역
  ) { }

  attach() {
    if (this.attached) return;
    this.attached = true;

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: true });
    window.addEventListener("blur", this.onBlur, { passive: true });

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

    // 키보드 입력이 있으면 pointer 입력 해제
    if (dx !== 0 || dy !== 0) this.pointerId = null;

    this.service.setInputDirection(dx, dy);
  }

  // ---------------- pointer: tap-to-move + drag joystick ----------------
  private onPointerDown = (e: PointerEvent) => {
    if (isTypingTarget(document.activeElement)) return;

    // 스크롤/더블탭 줌 방지(모바일)
    e.preventDefault();

    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startAt = performance.now();
    this.moved = false;

    // pointer 시작 시점엔 일단 정지(조이스틱은 move에서 처리)
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

    // 탭 판정 거리 넘으면 "드래그"로 간주
    if (dist > this.tapMoveMaxDist) this.moved = true;

    // 드래그가 아니면(=탭 후보) 조이스틱 입력을 주지 않음
    if (!this.moved) return;

    // ---- 드래그 조이스틱 ----
    if (dist < this.deadZone) {
      this.service.setInputDirection(0, 0);
      return;
    }

    const clamped = Math.min(dist, this.maxDistance);
    const nx = (dxPx / dist) * (clamped / this.maxDistance);
    const ny = (dyPx / dist) * (clamped / this.maxDistance);

    this.service.setInputDirection(nx, ny);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;

    const elapsed = performance.now() - this.startAt;
    const dxPx = e.clientX - this.startX;
    const dyPx = e.clientY - this.startY;
    const dist = Math.hypot(dxPx, dyPx);

    // 조이스틱(드래그)이었다면 손 떼면 정지
    if (this.moved) {
      this.pointerId = null;
      this.service.setInputDirection(0, 0);
      return;
    }

    // ✅ 탭(클릭) 이동
    if (elapsed <= this.tapMoveMaxTime && dist <= this.tapMoveMaxDist) {
      const { x, y } = this.clientToWorld(e.clientX, e.clientY);
      this.service.setMoveTarget(x, y);
    }

    this.pointerId = null;
    this.service.setInputDirection(0, 0);
  };

  /** client 좌표 -> world 좌표 변환 */
  private clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.targetEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const r: any = this.renderer as any;

    // 1) 엔진에서 제공하는 변환 함수가 있으면 최우선 사용
    if (typeof r.screenToWorld === "function") {
      const p = r.screenToWorld(sx, sy);
      if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }
    if (r.camera && typeof r.camera.screenToWorld === "function") {
      const p = r.camera.screenToWorld(sx, sy);
      if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }

    // 2) 폴백: 화면 중앙 = (0,0), 1unit=32px 가정
    const cx = sx - rect.width / 2;
    const cy = sy - rect.height / 2;
    return { x: cx / FALLBACK_PX_PER_UNIT, y: cy / FALLBACK_PX_PER_UNIT };
  }
}
