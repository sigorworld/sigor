import { el } from "@webtaku/el";
import "./game-root.css";

import { Renderer } from "kiwiengine";
import { globalWorld } from "../game-objects/world";
import { createBottomChat } from "./hud/bottom-chat";
import { createTopBar } from "./hud/top-bar";

let rootEl: HTMLElement | null = null;
let renderer: Renderer | null = null;

export function mountGameRoot() {
  if (rootEl) return;

  // 루트
  rootEl = el("div.game-root") as HTMLElement;

  // 월드(일단 빈 배경/캔버스 자리)
  const world = el("div.game-world") as HTMLElement;

  renderer = new Renderer(world, {
    layers: [{ name: 'hud', drawOrder: 1 }],
  });

  renderer.add(globalWorld);

  const topBar = createTopBar();
  const bottomChat = createBottomChat();

  rootEl.append(world, topBar, bottomChat);
  document.body.appendChild(rootEl);
}

export function unmountGameRoot() {
  renderer?.remove();
  rootEl?.remove();
  rootEl = null;
}
