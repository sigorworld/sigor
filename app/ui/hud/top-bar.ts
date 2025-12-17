import { tokenManager } from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import "./top-bar.css";

import { createGameSettingsModal } from "../modals/game-settings-modal";

let settingsModal: HTMLIonModalElement | null = null;

export function createTopBar(): HTMLElement {
  const wrap = el("div.top-bar");
  const right = el("div.top-bar-right");

  const settingsBtn = el(
    "button.top-bar-icon",
    {
      type: "button",
      title: "설정",
      onclick: async () => {
        // 모달 1회 생성
        if (!settingsModal) {
          settingsModal = createGameSettingsModal();
          document.body.appendChild(settingsModal);
        }
        await settingsModal.present();
      },
    },
    "⚙️"
  );

  right.append(settingsBtn);
  wrap.append(right);

  function syncVisibility() {
    const visible = tokenManager.has();
    wrap.style.display = visible ? "flex" : "none";
  }

  // 초기 반영
  syncVisibility();

  // 로그인/로그아웃 시 반영 
  tokenManager.on("signedIn", () => syncVisibility());
  tokenManager.on("signedOut", () => syncVisibility());

  return wrap;
}
