import { el } from "@webtaku/el";
import "./game-root.css";

import { Renderer } from "kiwiengine";
import { GrassField } from "../game-objects/grass-field"; // ✅ 추가
import { WorldInputController } from "../game-objects/input-controller";
import { globalWorld, globalWorldService } from "../game-objects/world";
import { createBottomChat, type BottomChatUI } from "./hud/bottom-chat";
import { createTopBar } from "./hud/top-bar";

let rootEl: HTMLElement | null = null;
let renderer: Renderer | null = null;
let input: WorldInputController | null = null;
let bottomChat: BottomChatUI | null = null;

export function mountGameRoot() {
  if (rootEl) return;

  globalWorldService.start();

  rootEl = el("div.game-root") as HTMLElement;
  const worldEl = el("div.game-world") as HTMLElement;

  renderer = new Renderer(worldEl, {
    layers: [
      { name: "bg", drawOrder: -10 },   // ✅ 배경 레이어
      { name: "world", drawOrder: 0 },
      { name: "hud", drawOrder: 10 },
    ],
  });

  // ✅ 잔디 평원 먼저
  renderer.add(new GrassField({ size: 8000, patches: 160 }));

  // ✅ 그 위에 월드(캐릭터들)
  renderer.add(globalWorld);

  input = new WorldInputController(globalWorldService, renderer, worldEl);
  input.attach();

  const topBar = createTopBar();
  bottomChat = createBottomChat(globalWorldService);

  rootEl.append(worldEl, topBar, bottomChat.el);
  document.body.appendChild(rootEl);
}

export function unmountGameRoot() {
  bottomChat?.remove();
  bottomChat = null;

  input?.detach();
  input = null;

  renderer?.remove();
  renderer = null;

  rootEl?.remove();
  rootEl = null;
}
