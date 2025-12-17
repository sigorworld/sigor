import { BackButtonEvent, setupConfig } from '@ionic/core';
import { defineCustomElements } from '@ionic/core/loader';
import '@shoelace-style/shoelace';
import { sessionManager } from './auth/session-manager';
import { createRainbowKit } from './components/wallet';
import { initAuthOverlays } from "./ui/auth-overlays";
import { logout } from '@gaiaprotocol/client-common';

// =====================
//  Environment / Session / WebView
// =====================

const urlParams = new URLSearchParams(window.location.search);

// Handle ?session=... from backend
const sid = urlParams.get('session');
if (sid) {
  sessionManager.set(sid);
}

export const isWebView = urlParams.get('source') === 'webview';

// =====================
//    Ionic setup
// =====================

setupConfig({ hardwareBackButton: true, experimentalCloseWatcher: true });

const backHandler = (event: BackButtonEvent) => {
  event.detail.register(0, () => {
    const hasHistory = window.history.length > 1;
    const isFromExternal =
      document.referrer &&
      !document.referrer.startsWith(window.location.origin);
    if (!hasHistory || isFromExternal) {
      document.removeEventListener('ionBackButton' as any, backHandler);
    }
    window.history.back();
  });
};
document.addEventListener('ionBackButton' as any, backHandler);

defineCustomElements(window);
document.documentElement.setAttribute('mode', 'ios');
document.body.appendChild(createRainbowKit());

document.documentElement.classList.remove('app-loading');

initAuthOverlays();
