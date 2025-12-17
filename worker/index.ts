import { corsHeaders, jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { WorldRoomDO } from "./durable-objects/world-room";
import type { EvmAddress } from "./types";
import { isValidEvmAddress } from "./utils/evm";

export { WorldRoomDO };

type Env = {
  DB: D1Database;
  WORLD_ROOM: DurableObjectNamespace;
};

function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

const GLOBAL_WORLD_NAME = "global";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return handleOptions();

    // ✅ WebSocket: GET /api/world/ws?token=...
    if (url.pathname === "/api/world/ws") {
      const upgrade = request.headers.get("Upgrade") || request.headers.get("upgrade");
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426, headers: corsHeaders() });
      }

      const id = env.WORLD_ROOM.idFromName(GLOBAL_WORLD_NAME);
      const stub = env.WORLD_ROOM.get(id);
      return stub.fetch(request);
    }

    // ✅ 메시지 리스트: GET /api/world/chat/messages?limit=&cursor=
    if (url.pathname === "/api/world/chat/messages" && request.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const cursor = Number(url.searchParams.get("cursor") || 0);

      const { results } = await env.DB.prepare(`
        SELECT id, account, text, timestamp
        FROM chat_messages
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `).bind(limit, cursor).all<{ id: number; account: string; text: string; timestamp: number }>();

      const messages = results.reverse();
      const nextCursor = messages.length < limit ? null : cursor + limit;

      return jsonWithCors({ messages, nextCursor });
    }

    // ✅ 메시지 전송(HTTP): POST /api/world/chat/send (Bearer token)
    if (url.pathname === "/api/world/chat/send" && request.method === "POST") {
      const auth = request.headers.get("authorization");
      if (!auth?.startsWith("Bearer ")) return jsonWithCors({ error: "Unauthorized" }, 401);

      const token = auth.slice(7);
      const payload: any = await verifyToken(token, env as any).catch(() => null);
      if (!payload?.sub || !isValidEvmAddress(payload.sub)) {
        return jsonWithCors({ error: "Unauthorized" }, 401);
      }
      const account = payload.sub as EvmAddress;

      const body: any = await request.json().catch(() => ({}));
      const text = (body.text || "").toString().trim();
      if (!text) return jsonWithCors({ error: "text is required" }, 400);

      const timestamp = Date.now();
      const result = await env.DB.prepare(`
        INSERT INTO chat_messages (account, text, timestamp)
        VALUES (?, ?, ?)
      `).bind(account, text, timestamp).run();

      const message = {
        id: Number(result.meta.last_row_id),
        account,
        text,
        timestamp,
      };

      // DO로 broadcast (옵션)
      try {
        const id = env.WORLD_ROOM.idFromName(GLOBAL_WORLD_NAME);
        const stub = env.WORLD_ROOM.get(id);
        await stub.fetch("https://world-room/broadcast", {
          method: "POST",
          body: JSON.stringify({ type: "chat", message }),
        });
      } catch (e) {
        console.error("[api/world/chat/send] broadcast failed", e);
      }

      return jsonWithCors(message, 201);
    }

    return jsonWithCors({ error: "Not Found" }, 404);
  },
};
