import type { ChatRow } from "../types/world";

declare const API_BASE_URI: string; // "/api" 형태

const MAX_CHAT_LEN = 10_000;

export function assertValidWorldChatText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("text is empty");
  if (trimmed.length > MAX_CHAT_LEN) throw new Error(`text exceeds maximum length of ${MAX_CHAT_LEN}.`);
}

function apiBase(): URL {
  const base = new URL(API_BASE_URI, window.location.origin);

  // "/api" 처럼 끝에 / 없으면, new URL("world/ws", base) 가 "/world/ws"로 붙을 수 있어
  // 반드시 "/api/"로 보정
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return base;
}

/**
 * GET /api/world/chat/messages?limit=&cursor=
 */
export async function fetchWorldChatMessages(params?: { limit?: number; cursor?: number }) {
  const limit = params?.limit ?? 50;
  const cursor = params?.cursor ?? 0;

  const base = apiBase();
  const url = new URL("/world/chat/messages", base);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("cursor", String(cursor));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    let message = `Failed to fetch world chat messages: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { }
    throw new Error(message);
  }

  return (await res.json()) as { messages: ChatRow[]; nextCursor: number | null };
}

/**
 * POST /api/world/chat/send
 */
export async function sendWorldChatMessageHttp(params: { token: string; text: string }) {
  const { token, text } = params;
  if (!token) throw new Error("Missing authorization token.");
  assertValidWorldChatText(text);

  const base = apiBase();
  const url = new URL("/world/chat/send", base);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    let message = `Failed to send world chat: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { }
    throw new Error(message);
  }

  return (await res.json()) as ChatRow;
}

/**
 * WS: wss://host/api/world/ws?token=...
 */
export function buildWorldWsUrl(token: string): string {
  const base = apiBase();
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";

  // ✅ 상대경로로 붙여야 "/api/" 유지됨
  const wsUrl = new URL("world/ws", base);
  wsUrl.searchParams.set("token", token);
  return wsUrl.toString();
}
