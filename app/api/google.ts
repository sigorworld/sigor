declare const API_BASE_URI: string;

const GOOGLE_ME_PATH = `${API_BASE_URI}/google-me/mateapp`;
const GOOGLE_ME_BY_WALLET_PATH = `${API_BASE_URI}/google-me-by-wallet/mateapp`;
const LINK_WALLET_PATH = `${API_BASE_URI}/google-link-web3-wallet/mateapp`;
const UNLINK_WALLET_BY_TOKEN_PATH = `${API_BASE_URI}/google-unlink-web3-wallet-by-token/mateapp`;
const UNLINK_WALLET_BY_SESSION_PATH = `${API_BASE_URI}/google-unlink-web3-wallet-by-session/mateapp`;
const GOOGLE_VERIFY_PATH = `${API_BASE_URI}/oauth2/verify/mateapp`;

export type GoogleProfile = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type GoogleMe = {
  ok?: boolean;
  token?: string;
  wallet_address?: `0x${string}` | null;
  profile?: GoogleProfile;
  error?: string;
};

export type GoogleMeByWallet = {
  ok?: boolean;
  wallet_address?: `0x${string}`;
  google_sub?: string;
  token?: string;
  linked_at?: number;
  // 프로필 확장 필드가 있다면 서버 응답에 맞춰 추가:
  profile?: GoogleProfile;
  error?: string;
};

export type LinkWalletResult = {
  ok?: boolean;
  wallet_address?: `0x${string}`;
  google_sub?: string;
  token?: string;
  linked_at?: number;
  profile?: GoogleProfile;
  error?: string;
};

export type UnlinkWalletResult = {
  ok?: boolean;
  error?: string;
};

// ─────────────────────────────────────────────────────────────
// Common fetch helpers
// ─────────────────────────────────────────────────────────────
async function parseError(res: Response, fallback: string) {
  let message = `${fallback}: ${res.status}`;
  try {
    const data = await res.json();
    if ((data as any)?.error) message = (data as any).error;
  } catch {
    try {
      const text = await res.text();
      if (text) message = text;
    } catch { /* ignore */ }
  }
  throw new Error(message);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  if (!res.ok) await parseError(res, `GET ${url} failed`);
  return (await res.json()) as T;
}

async function getJsonAuth<T>(url: string, authToken: string): Promise<T> {
  if (!authToken) throw new Error('Missing authorization token.');
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    credentials: 'include',
  });
  if (!res.ok) await parseError(res, `GET ${url} failed`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

async function postJsonAuth<T>(url: string, authToken: string, body?: unknown): Promise<T> {
  if (!authToken) throw new Error('Missing authorization token.');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

// ─────────────────────────────────────────────────────────────
// Public APIs
// ─────────────────────────────────────────────────────────────

/** 쿠키 세션 기반: 내 세션/토큰/지갑 상태 조회 */
export async function fetchGoogleMe(): Promise<GoogleMe> {
  return await getJson<GoogleMe>(GOOGLE_ME_PATH);
}

/** 지갑 JWT 기반: 지갑 주소로 연동된 Google 계정 조회 */
export async function fetchGoogleMeByWallet(authToken: string): Promise<GoogleMeByWallet> {
  return await getJsonAuth<GoogleMeByWallet>(GOOGLE_ME_BY_WALLET_PATH, authToken);
}

/** 지갑 JWT 기반: Google 계정과 Web3 지갑 주소 링크 */
export async function linkGoogleWeb3Wallet(authToken: string): Promise<LinkWalletResult> {
  // 서버는 바디를 사용하지 않으므로 빈 바디
  return await postJsonAuth<LinkWalletResult>(LINK_WALLET_PATH, authToken, {});
}

/** 지갑 JWT 기반: 링크 해제 */
export async function unlinkGoogleWeb3WalletByToken(authToken: string): Promise<UnlinkWalletResult> {
  return await postJsonAuth<UnlinkWalletResult>(UNLINK_WALLET_BY_TOKEN_PATH, authToken, {});
}

/** 쿠키 세션 기반: 링크 해제 */
export async function unlinkGoogleWeb3WalletBySession(): Promise<UnlinkWalletResult> {
  return await postJson<UnlinkWalletResult>(UNLINK_WALLET_BY_SESSION_PATH);
}

export type VerifyPayload = {
  provider: "google";
  idToken: string;
  nonce: string;
};

export type VerifyResult = {
  ok?: boolean;
  // 서버가 로그인과 동시에 세션/토큰을 내려줄 수도 있음
  token?: string;
  profile?: GoogleProfile;
  wallet_address?: `0x${string}` | null;
  error?: string;
};

async function postJsonWithCreds<T>(url: string, body?: unknown, credentials: RequestCredentials = "include"): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

/** ID 토큰 검증 전담: 서버가 ID 토큰/nonce 검증 및 세션 수립 */
export async function verifyGoogleLogin(payload: VerifyPayload): Promise<VerifyResult> {
  // 보안/쿠키 세팅 목적상 credentials: 'include' 유지
  return await postJsonWithCreds<VerifyResult>(GOOGLE_VERIFY_PATH, payload, "include");
}
