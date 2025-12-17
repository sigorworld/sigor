import { getAddressAvatarDataUrl } from "@gaiaprotocol/address-avatar";
import { logout, tokenManager } from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import { getAddress, zeroAddress } from "viem";

import { fetchProfile } from "../../api/profile";
import { googleLogout } from "../../auth/google-login";
import { openProfileSetupOverlay } from "../profile-setup-overlay";

import "./game-settings-modal.css";

export function createGameSettingsModal(): HTMLIonModalElement {
  const modal = el("ion-modal.game-settings-modal") as HTMLIonModalElement;

  // ---------- Header ----------
  const closeBtn = el(
    "ion-button",
    {
      fill: "clear",
      "aria-label": "Close settings",
      onclick: () => modal.dismiss(),
    },
    el("ion-icon", { name: "close-outline", slot: "icon-only" })
  ) as HTMLIonButtonElement;

  const header = el(
    "ion-header",
    el(
      "ion-toolbar",
      el("ion-title", "설정"),
      el("ion-buttons", { slot: "end" }, closeBtn)
    )
  );

  // ---------- Body ----------
  const avatar = el("div.gs-avatar") as HTMLDivElement;
  const nameLine = el("div.gs-name", "Not signed in") as HTMLDivElement;
  const addrLine = el("div.gs-addr", "") as HTMLDivElement;

  const profileBtn = el(
    "ion-button",
    {
      expand: "block",
      strong: true,
      class: "gs-primary-btn",
      onclick: async () => {
        // 모달 닫고 프로필 설정 오버레이 강제 오픈
        modal.dismiss();
        await openProfileSetupOverlay(true);
      },
    },
    "프로필 설정"
  ) as HTMLIonButtonElement;

  const logoutBtn = el(
    "ion-button",
    {
      expand: "block",
      fill: "outline",
      class: "gs-logout-btn",
      onclick: async () => {
        try {
          await logout().catch(() => { });
          await googleLogout().catch(() => { });
        } finally {
          try {
            tokenManager.clear();
          } catch { }
          modal.dismiss();
        }
        location.reload()
      },
    },
    "로그아웃"
  ) as HTMLIonButtonElement;

  const infoCard = el(
    "div.gs-card",
    el("div.gs-user", avatar, el("div.gs-user-meta", nameLine, addrLine))
  );

  const actions = el("div.gs-actions", profileBtn, logoutBtn);

  const content = el("ion-content", {}, el("div.gs-body", infoCard, actions));

  modal.append(header, content);

  // ---------- Helpers ----------
  async function refreshUserInfo() {
    const hasToken = tokenManager.has();
    const rawAddr = hasToken ? tokenManager.getAddress() : undefined;

    if (!hasToken || !rawAddr) {
      avatar.innerHTML = "";
      nameLine.textContent = "Not signed in";
      addrLine.textContent = "";
      profileBtn.disabled = true;
      logoutBtn.disabled = true;
      return;
    }

    profileBtn.disabled = false;
    logoutBtn.disabled = false;

    const checksum = getAddress(rawAddr || zeroAddress);

    // Avatar
    avatar.innerHTML = "";
    try {
      const src = getAddressAvatarDataUrl(checksum as `0x${string}`);
      const img = document.createElement("img");
      img.src = src;
      img.alt = "avatar";
      avatar.appendChild(img);
    } catch {
      avatar.textContent = checksum.slice(2, 3).toUpperCase();
    }

    // Profile (optional)
    try {
      const p: any = await fetchProfile(checksum as `0x${string}`);
      const nickname = (p?.nickname || "").trim();
      nameLine.textContent = nickname ? nickname : "Signed in";
    } catch {
      nameLine.textContent = "Signed in";
    }

    addrLine.textContent = checksum;
  }

  // present 될 때마다 최신 정보 반영
  modal.addEventListener("ionModalWillPresent", () => {
    void refreshUserInfo();
  });

  // 로그인/로그아웃 이벤트 훅
  tokenManager.on("signedIn", () => void refreshUserInfo());
  tokenManager.on("signedOut", () => void refreshUserInfo());

  return modal;
}
