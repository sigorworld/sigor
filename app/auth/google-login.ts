import { isWebView, platform } from "../platform";
import { oauth2LoginWithIdToken, oauth2Logout, oauth2Start } from "./oauth2";
import { sessionManager } from "./session-manager";

export function googleLogin() {
  if (isWebView && (window as any).Native?.signInWithGoogle) {
    (window as any).Native.signInWithGoogle()
  } else if (isWebView && (window as any).Android?.signInWithGoogle) {
    (window as any).Android.signInWithGoogle()
  } else {
    oauth2Start('google')
  }
}

let signOutResolve: (() => void) | undefined;
export async function googleLogout() {
  if (isWebView && (window as any).Native?.signOutFromGoogle) {
    (window as any).Native.signOutFromGoogle()
    return new Promise<void>(resolve => signOutResolve = resolve)
  } else if (isWebView && (window as any).Android?.signOutFromGoogle) {
    (window as any).Android.signOutFromGoogle()
    return new Promise<void>(resolve => signOutResolve = resolve)
  } else {
    await oauth2Logout()
    sessionManager.clear();
  }
}

if (isWebView) {
  window.addEventListener('googleSignInComplete', async (e: any) => {
    const { idToken, nonce } = e.detail
    try {
      // 서버에서 구글 공개키로 ID 토큰 검증 + nonce 검증 + aud(=WEB_CLIENT_ID) 검증 필수
      const { ok, sessionId } = await oauth2LoginWithIdToken('google', idToken, nonce)
      if (ok) {
        sessionManager.set(sessionId)
        location.href = `/?platform=${platform}&source=webview`
      }
      else {
        const toast = document.createElement("ion-toast");
        toast.message = `Google sign-in failed. ${e.detail.message}`;
        toast.duration = 1600;
        toast.position = "bottom";
        document.body.appendChild(toast);
        (toast as any).present();
      }
    } catch (error: any) {
      const toast = document.createElement("ion-toast");
      toast.message = `Google sign-in failed. ${error.message}`;
      toast.duration = 1600;
      toast.position = "bottom";
      document.body.appendChild(toast);
      (toast as any).present();
    }
  })

  window.addEventListener('googleSignInFailed', (e: any) => {
    console.warn('Google sign-in failed', e.detail)

    const toast = document.createElement("ion-toast");
    toast.message = `Google sign-in failed. ${e.detail.message}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  })

  window.addEventListener('googleSignOutComplete', () => {
    sessionManager.clear();
    signOutResolve?.()
  });

  window.addEventListener('googleSignOutFailed', (e: any) => {
    console.error('Sign-out failed:', e.detail?.message);

    const toast = document.createElement("ion-toast");
    toast.message = `Google sign-out failed. ${e.detail.message}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  });
}
