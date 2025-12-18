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

  constructor(private service: WorldService, private renderer: Renderer) { }

  attach() {
    if (this.attached) return;
    this.attached = true;

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: true });
    window.addEventListener("blur", this.onBlur, { passive: true });
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;

    window.removeEventListener("keydown", this.onKeyDown as any);
    window.removeEventListener("keyup", this.onKeyUp as any);
    window.removeEventListener("blur", this.onBlur as any);

    this.pressed.clear();
    this.service.setInputDirection(0, 0);
  }

  private onBlur = () => {
    this.pressed.clear();
    this.service.setInputDirection(0, 0);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(document.activeElement)) return;

    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
      e.preventDefault();
      this.pressed.add(key);
      this.updateDir();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      this.updateDir();
    }
  };

  private updateDir() {
    let dx = 0;
    let dy = 0;

    if (this.pressed.has("a") || this.pressed.has("arrowleft")) dx -= 1;
    if (this.pressed.has("d") || this.pressed.has("arrowright")) dx += 1;
    if (this.pressed.has("w") || this.pressed.has("arrowup")) dy -= 1;
    if (this.pressed.has("s") || this.pressed.has("arrowdown")) dy += 1;

    this.service.setInputDirection(dx, dy);
  }
}
