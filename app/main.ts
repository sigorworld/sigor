import { tokenManager } from "@gaiaprotocol/client-common";
import { fetchGoogleMe, GoogleMe, linkGoogleWeb3Wallet, unlinkGoogleWeb3WalletBySession } from './api/google';
import { validateToken } from "./auth/validate";

async function tryAutoLinkIfNeeded(googleMe: GoogleMe | null): Promise<'ok' | 'to-link' | 'skip'> {
  const walletHasToken = tokenManager.has();

  // 1) Complete Google session → inject immediately
  if (googleMe?.ok && googleMe.wallet_address && googleMe.token) {
    tokenManager.set(googleMe.token, googleMe.wallet_address);
    return 'ok';
  }

  // 2) Google logged in but wallet token missing → go to link screen
  if (googleMe?.ok && !walletHasToken) {
    return 'to-link';
  }

  // 3) Wallet token exists & Google session present but incomplete → try server-side link using wallet auth
  if (walletHasToken && googleMe?.ok) {
    const authToken = tokenManager.getToken();
    if (!authToken) return 'to-link';
    try {
      const linkRes = await linkGoogleWeb3Wallet(authToken);
      if (linkRes?.ok) {
        if (linkRes.token && linkRes.wallet_address) {
          tokenManager.set(linkRes.token, linkRes.wallet_address);
        } else {
          const refreshed = await fetchGoogleMe();
          if (refreshed.ok && refreshed.token && refreshed.wallet_address) {
            tokenManager.set(refreshed.token, refreshed.wallet_address);
          }
        }
        return 'ok';
      }
      return 'to-link';
    } catch {
      return 'to-link';
    }
  }

  // 4) Other cases: do nothing special
  return 'skip';
}

async function determineFlow(): Promise<'ok' | 'to-login' | 'to-link'> {
  let walletHasToken = tokenManager.has();

  let googleMe: GoogleMe | null = null;
  try { googleMe = await fetchGoogleMe(); } catch { googleMe = null; }

  const linkResult = await tryAutoLinkIfNeeded(googleMe);

  // tokenManager may be mutated in tryAutoLinkIfNeeded
  walletHasToken = tokenManager.has();

  // If neither Google nor wallet auth exists, go to login
  if (!googleMe?.ok && !walletHasToken) return 'to-login';
  if (linkResult === 'to-link') return 'to-link';

  const valid = await validateToken();
  if (!valid) {
    if (walletHasToken && googleMe?.ok) {
      try { await unlinkGoogleWeb3WalletBySession(); } catch (err) { console.error(err); }
    }
    tokenManager.clear();
    return 'to-login';
  }

  const address = tokenManager.getAddress();
  if (!address) { tokenManager.clear(); return 'to-login'; }

  return 'ok';
}

async function runAuthFlow() {
  const next = await determineFlow();

  if (next === 'to-login') {
    //TODO
    console.log('to-login');
    return;
  }
  if (next === 'to-link') {
    //TODO
    console.log('to-link');
    return;
  }

  // Auth OK → decide content based on path
  //TODO
  console.log('ok');
}

(async () => {
  const ok = await validateToken();
  if (!ok) {
    tokenManager.clear();
    runAuthFlow()
    return;
  }

  const address = tokenManager.getAddress();
  if (!address) {
    tokenManager.clear();
    runAuthFlow()
    return;
  }

  runAuthFlow()
})();
