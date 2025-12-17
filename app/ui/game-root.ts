import { el } from "@webtaku/el";
import "./game-root.css";

import { createTopBar } from "./hud/top-bar";
import { createBottomChat } from "./hud/bottom-chat";

let rootEl: HTMLElement | null = null;

export function mountGameRoot() {
  if (rootEl) return;

  // 루트
  rootEl = el("div.game-root") as HTMLElement;

  // 월드(일단 빈 배경/캔버스 자리)
  const world = el("div.game-world") as HTMLElement;

  const topBar = createTopBar();
  const bottomChat = createBottomChat();

  rootEl.append(world, topBar, bottomChat);
  document.body.appendChild(rootEl);
}

export function unmountGameRoot() {
  rootEl?.remove();
  rootEl = null;
}
