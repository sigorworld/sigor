import { el } from "@webtaku/el";
import "./game-root.css";

import { Renderer } from "kiwiengine";
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

  // ✅ 서비스 시작(여기서 한 번만)
  globalWorldService.start();

  rootEl = el("div.game-root") as HTMLElement;

  const worldEl = el("div.game-world") as HTMLElement;

  renderer = new Renderer(worldEl, {
    layers: [
      { name: "world", drawOrder: 0 },
      { name: "hud", drawOrder: 10 },
    ],
  });

  renderer.add(globalWorld);

  // ✅ 여기 중요: worldEl 전달
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
