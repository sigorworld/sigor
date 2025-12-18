import { el } from "@webtaku/el";
import "./game-root.css";

import { Renderer } from "kiwiengine";

import { WorldInputController } from "../game-objects/input-controller";
import { globalWorld, globalWorldService } from "../game-objects/world";

import { BottomChatUI, createBottomChat } from "./hud/bottom-chat";
import { createTopBar } from "./hud/top-bar";

let rootEl: HTMLElement | null = null;
let renderer: Renderer | null = null;
let input: WorldInputController | null = null;

let bottomChat: BottomChatUI | null = null;

export function mountGameRoot() {
  if (rootEl) return;

  rootEl = el("div.game-root") as HTMLElement;
  const worldEl = el("div.game-world") as HTMLElement;

  renderer = new Renderer(worldEl, {
    layers: [{ name: "hud", drawOrder: 1 }],
  });

  renderer.add(globalWorld);

  // ✅ 입력은 game-root에서만 생성/attach (렌더 트리에 add 하지 않음)
  input = new WorldInputController(globalWorldService, renderer);
  input.attach();

  const topBar = createTopBar();

  // ✅ 서비스 주입 (UI는 네트워크/토큰 몰라도 됨)
  bottomChat = createBottomChat(globalWorldService);

  rootEl.append(worldEl, topBar, bottomChat.el);
  document.body.appendChild(rootEl);
}

export function unmountGameRoot() {
  // ✅ UI 컴포넌트 정리
  bottomChat?.remove();
  bottomChat = null;

  // ✅ 입력 정리
  input?.detach();
  input = null;

  // ✅ 렌더러 정리
  renderer?.remove();
  renderer = null;

  rootEl?.remove();
  rootEl = null;
}
