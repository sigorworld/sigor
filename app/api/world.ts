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
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return base;
}

/**
 * ✅ IMPORTANT:
 * new URL("world/..", base) 처럼 앞에 "/" 없이 붙여야 "/api/"가 유지됩니다.
 */

export async function fetchWorldChatMessages(params?: { limit?: number; cursor?: number }) {
  const limit = params?.limit ?? 50;
  const cursor = params?.cursor ?? 0;

  const base = apiBase();
  const url = new URL("world/chat/messages", base);
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

export function buildWorldWsUrl(token: string): string {
  const base = apiBase();
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";

  const wsUrl = new URL("world/ws", base);
  wsUrl.searchParams.set("token", token);
  return wsUrl.toString();
}
