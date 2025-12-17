import { el } from "@webtaku/el";
import "./game-root.css";

import { createTopBar } from "./hud/top-bar";

let rootEl: HTMLElement | null = null;

export function mountGameRoot() {
  if (rootEl) return;

  // 루트
  rootEl = el("div.game-root") as HTMLElement;

  // 월드(일단 빈 배경/캔버스 자리)
  const world = el("div.game-world") as HTMLElement;

  // HUD
  const topBar = createTopBar();

  rootEl.append(world, topBar);
  document.body.appendChild(rootEl);
}

export function unmountGameRoot() {
  rootEl?.remove();
  rootEl = null;
}
