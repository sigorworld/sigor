import { tokenManager } from "@gaiaprotocol/client-common";
import { sessionManager } from "./session-manager";

declare const MATE_API_BASE_URI: string;

export function oauth2Start(provider: string) {
  location.href = `${MATE_API_BASE_URI}/oauth2/start/sigor/${provider}`;
}

export async function oauth2LoginWithIdToken(provider: string, idToken: string, nonce: string): Promise<{ ok: boolean; sessionId: string }> {
  const response = await fetch(`${MATE_API_BASE_URI}/oauth2/login-with-idtoken/${provider}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken, nonce })
  });
  const data = await response.json();
  console.log(data);
  return data;
}

export type OAuth2MeResult = {
  ok?: boolean;
  user?: {
    sub?: string;
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  provider?: string;
  token_expires_in?: number;

  sub?: string;
  wallet_address?: `0x${string}`;
  token?: string;
  linked_at?: number;
  email?: string;
}

export async function oauth2Me(): Promise<OAuth2MeResult> {
  const response = await fetch(`${MATE_API_BASE_URI}/oauth2/me`, {
    headers: {
      'Authorization': `Bearer ${sessionManager.get()}`,
      'Content-Type': 'application/json',
    }
  });
  const data = await response.json();
  return data;
}

export async function oauth2MeByToken(provider: string): Promise<OAuth2MeResult> {
  const response = await fetch(`${MATE_API_BASE_URI}/oauth2/me-by-token/${provider}`, {
    headers: {
      'Authorization': `Bearer ${tokenManager.getToken()}`,
      'Content-Type': 'application/json',
    }
  });
  const data = await response.json();
  return data;
}

export async function oauth2Logout() {
  await fetch(`${MATE_API_BASE_URI}/oauth2/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionManager.get()}`,
      'Content-Type': 'application/json',
    }
  });
}

export async function oauthLinkWallet() {
  const response = await fetch(`${MATE_API_BASE_URI}/oauth2/link-wallet`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionManager.get()}`,
      'X-Wallet-Auth': `Bearer ${tokenManager.getToken()}`,  // 월렛 토큰/서명
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return data;
}

export async function oauthUnlinkWalletByToken() {
  await fetch(`${MATE_API_BASE_URI}/oauth2/unlink-wallet-by-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenManager.getToken()}`,
      'Content-Type': 'application/json',
    }
  });
}

export async function oauthUnlinkWalletBySession() {
  await fetch(`${MATE_API_BASE_URI}/oauth2/unlink-wallet-by-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionManager.get()}`,
      'Content-Type': 'application/json',
    }
  });
}

