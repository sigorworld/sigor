import { tokenManager } from "@gaiaprotocol/client-common";
import { disconnect, getAccount, watchAccount } from "@wagmi/core";
import { el } from "@webtaku/el";

import { showErrorAlert } from "../components/alert";

import { googleLogin, googleLogout } from "../auth/google-login";
import { requestLogin } from "../auth/login";
import { signMessage } from "../auth/siwe";

import { oauth2Me, oauthLinkWallet } from "../auth/oauth2";
import { sessionManager } from "../auth/session-manager";
import { validateToken } from "../auth/validate";

import { openWalletConnectModal, wagmiConfig } from "../components/wallet";
import "./auth-overlays.css";
import { refreshProfileSetupOverlay } from "./profile-setup-overlay";

type OverlayType = "login" | "wallet-link";

let currentOverlay: HTMLElement | null = null;
let unwatchAccount: (() => void) | null = null;

function removeOverlay() {
  try {
    unwatchAccount?.();
  } catch { }
  unwatchAccount = null;

  currentOverlay?.remove();
  currentOverlay = null;
}

function mountOverlay(type: OverlayType) {
  if (currentOverlay?.getAttribute("data-overlay") === type) return;

  removeOverlay();

  const overlay = type === "login" ? createLoginOverlay() : createWalletLinkOverlay();

  overlay.setAttribute("data-overlay", type);
  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

async function ensureWalletConnected(): Promise<`0x${string}`> {
  const account = getAccount(wagmiConfig);
  if (!account.isConnected || !account.address) {
    throw new Error("지갑 연결이 필요합니다.");
  }
  return account.address;
}

async function loginWithWallet() {
  const address = await ensureWalletConnected();
  const signature = await signMessage(address);
  const token = await requestLogin(address, signature);
  tokenManager.set(token, address);
}

async function linkWalletToGoogleSession() {
  // 서버가 sessionManager(sid) 기반으로 google session을 인지하고,
  // X-Wallet-Auth(= tokenManager token)로 link-wallet 처리하는 구조라고 가정
  const res = await oauthLinkWallet();
  if (!res?.ok) throw new Error("지갑 연동에 실패했습니다.");

  // link 응답이 token, wallet_address를 주면 토큰 갱신
  if (res.token && res.wallet_address) {
    tokenManager.set(res.token, res.wallet_address);
  } else {
    // 아니면 me 재조회로 토큰/지갑 주소 획득
    const me = await oauth2Me();
    if (me.ok && me.token && me.wallet_address) {
      tokenManager.set(me.token, me.wallet_address);
    }
  }
}

function createOverlayShell(title: string, desc: string) {
  const backdrop = el("div.auth-overlay-backdrop");
  const card = el("div.auth-overlay-card");

  const h = el("div.auth-overlay-title", title);
  const p = el("div.auth-overlay-desc", desc);

  const body = el("div.auth-overlay-body");

  card.append(h, p, body);
  backdrop.append(card);

  return { backdrop, body };
}

function createLoginOverlay(): HTMLElement {
  const { backdrop, body } = createOverlayShell(
    "시고르에 접속",
    "지갑을 연결하고 메시지에 서명해 접속하거나,\n이미 연동된 계정은 Google로 바로 로그인할 수 있음"
  );

  const connectBtn = el("button.auth-btn.primary", { type: "button" }, "1. 지갑 연결") as HTMLButtonElement;

  const signBtn = el("button.auth-btn", { type: "button", disabled: true }, "2. 메시지 서명") as HTMLButtonElement;

  const googleBtn = el("button.auth-btn.google", { type: "button" }, "Google로 계속하기") as HTMLButtonElement;

  const hint = el("div.auth-overlay-hint", "※ 계정은 Mate App의 그것과 동일");

  function syncWalletButtons() {
    const account = getAccount(wagmiConfig);
    if (account.isConnected) {
      connectBtn.textContent = "지갑 연결 해제";
      connectBtn.classList.remove("primary");
      signBtn.disabled = false;
      signBtn.classList.add("primary");
    } else {
      connectBtn.textContent = "1. 지갑 연결";
      connectBtn.classList.add("primary");
      signBtn.disabled = true;
      signBtn.classList.remove("primary");
    }
  }

  connectBtn.onclick = async () => {
    try {
      const account = getAccount(wagmiConfig);
      if (account.isConnected) {
        await disconnect(wagmiConfig);
      } else {
        openWalletConnectModal();
      }
    } catch (e) {
      console.error(e);
    } finally {
      syncWalletButtons();
    }
  };

  signBtn.onclick = async () => {
    signBtn.setAttribute("data-loading", "1");
    try {
      await loginWithWallet();
      await refreshAuthOverlays();
    } catch (err) {
      console.error(err);
      showErrorAlert("오류", err instanceof Error ? err.message : String(err));
    } finally {
      signBtn.removeAttribute("data-loading");
    }
  };

  googleBtn.onclick = async () => {
    googleBtn.setAttribute("data-loading", "1");
    try {
      await googleLogin(); // webview면 native flow, web이면 oauth2Start로 이동
      // googleSignInComplete 이벤트에서 sessionManager.set 후 refreshAuthOverlays()가 호출되도록 아래 init에서 연결
    } catch (err) {
      console.error(err);
      showErrorAlert("오류", err instanceof Error ? err.message : String(err));
    } finally {
      googleBtn.removeAttribute("data-loading");
    }
  };

  body.append(connectBtn, signBtn, el("div.auth-overlay-divider"), googleBtn, hint);

  syncWalletButtons();
  unwatchAccount = watchAccount(wagmiConfig, { onChange: syncWalletButtons });

  return backdrop as HTMLElement;
}

function createWalletLinkOverlay(): HTMLElement {
  const { backdrop, body } = createOverlayShell(
    "지갑 연동 필요",
    "Google 로그인은 완료되었음\n지갑을 연결하고 메시지 서명을 완료하면 계정이 연동됨"
  );

  const connectBtn = el("button.auth-btn.primary", { type: "button" }, "1. 지갑 연결") as HTMLButtonElement;

  const linkBtn = el("button.auth-btn", { type: "button", disabled: true }, "2. 지갑 연동") as HTMLButtonElement;

  const logoutBtn = el("button.auth-btn", { type: "button" }, "Google 로그아웃") as HTMLButtonElement;

  function syncWalletButtons() {
    const account = getAccount(wagmiConfig);
    if (account.isConnected) {
      connectBtn.textContent = "지갑 연결 해제";
      connectBtn.classList.remove("primary");
      linkBtn.disabled = false;
      linkBtn.classList.add("primary");
    } else {
      connectBtn.textContent = "1. 지갑 연결";
      connectBtn.classList.add("primary");
      linkBtn.disabled = true;
      linkBtn.classList.remove("primary");
    }
  }

  connectBtn.onclick = async () => {
    try {
      const account = getAccount(wagmiConfig);
      if (account.isConnected) {
        await disconnect(wagmiConfig);
      } else {
        openWalletConnectModal();
      }
    } catch (e) {
      console.error(e);
    } finally {
      syncWalletButtons();
    }
  };

  linkBtn.onclick = async () => {
    linkBtn.setAttribute("data-loading", "1");
    try {
      // 1) 지갑 서명 로그인으로 토큰 확보
      await loginWithWallet();
      // 2) google session + wallet token 기반 링크 시도
      await linkWalletToGoogleSession();
      await refreshAuthOverlays();
    } catch (err) {
      console.error(err);
      showErrorAlert("오류", err instanceof Error ? err.message : String(err));
    } finally {
      linkBtn.removeAttribute("data-loading");
    }
  };

  logoutBtn.onclick = async () => {
    logoutBtn.setAttribute("data-loading", "1");
    try {
      await googleLogout();
    } catch (err) {
      console.error(err);
    } finally {
      try {
        tokenManager.clear();
      } catch { }
      try {
        sessionManager.clear();
      } catch { }
      try {
        await disconnect(wagmiConfig);
      } catch { }
      logoutBtn.removeAttribute("data-loading");
      await refreshAuthOverlays();
    }
  };

  body.append(connectBtn, linkBtn, el("div.auth-overlay-divider"), logoutBtn);

  syncWalletButtons();
  unwatchAccount = watchAccount(wagmiConfig, { onChange: syncWalletButtons });

  return backdrop as HTMLElement;
}

/**
 * 현재 상태를 보고 어떤 오버레이를 띄울지 결정
 * - 로그인 안됨: login overlay
 * - 구글 세션 있음 + 토큰 없음: wallet link overlay
 * - 토큰 유효: hide
 */
export async function refreshAuthOverlays() {
  // 0) 먼저 google session 기반 me 조회 (토큰 자동 복구 가능)
  const me = await oauth2Me().catch(() => null);

  // ✅ 이미 연동된 계정이면 me에 token/wallet_address가 올 수 있으니 즉시 주입
  if (me?.ok && me.token && me.wallet_address) {
    try {
      tokenManager.set(me.token, me.wallet_address);
    } catch { /* noop */ }
  }

  // 1) 토큰이 있으면 유효성 체크
  if (tokenManager.has()) {
    const ok = await validateToken().catch(() => false);
    if (ok) {
      removeOverlay();
      await refreshProfileSetupOverlay();
      return;
    }

    // 토큰이 있는데 invalid면 정리
    try { tokenManager.clear(); } catch { }
  }

  // 2) google session 존재 여부
  const hasGoogleSession = !!me?.ok || sessionManager.has();

  // 3) 상태별 오버레이 선택
  if (!hasGoogleSession && !tokenManager.has()) {
    mountOverlay("login");
    return;
  }

  if (hasGoogleSession && !tokenManager.has()) {
    mountOverlay("wallet-link");
    return;
  }

  removeOverlay();
}

/**
 * 앱 최초 1회 초기화:
 * - googleSignInComplete / SignOutComplete 등 이벤트 후에도 오버레이 갱신
 */
export function initAuthOverlays() {
  window.addEventListener("googleSignInComplete", () => {
    void refreshAuthOverlays();
  });
  window.addEventListener("googleSignOutComplete", () => {
    void refreshAuthOverlays();
  });

  // 첫 진입 갱신
  void refreshAuthOverlays();
}
