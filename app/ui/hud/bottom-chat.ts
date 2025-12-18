import { el } from "@webtaku/el";
import "./bottom-chat.css";

import { showErrorAlert } from "../../components/alert";
import type { WorldService } from "../../services/world-service";

const MAX_UI_MESSAGES = 120;

function shorten(addr: string) {
  if (!addr?.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isNearBottom(container: HTMLElement, thresholdPx = 40) {
  return container.scrollTop + container.clientHeight >= container.scrollHeight - thresholdPx;
}

export type BottomChatUI = {
  el: HTMLElement;
  setVisible: (visible: boolean) => void;
  remove: () => void;
};

export function createBottomChat(service: WorldService): BottomChatUI {
  const wrap = el("div.bottom-chat") as HTMLElement;
  const inner = el("div.bottom-chat-inner") as HTMLElement;

  const title = el("div.bottom-chat-title", "쑥덕쑥덕");
  const actions = el("div.bottom-chat-actions");

  let collapsed = false;
  const collapseBtn = el(
    "button.bottom-chat-icon",
    {
      type: "button",
      title: "접기/펼치기",
      onclick: () => {
        collapsed = !collapsed;
        wrap.setAttribute("data-collapsed", collapsed ? "1" : "0");
      },
    },
    "▁"
  ) as HTMLButtonElement;

  actions.append(collapseBtn);
  const header = el("div.bottom-chat-header", title, actions);

  const log = el("div.bottom-chat-log") as HTMLElement;

  const input = el("textarea.bottom-chat-input", {
    placeholder: "메시지를 입력하쇼… (Enter 전송, Shift+Enter 줄바꿈)",
    rows: 1,
  }) as HTMLTextAreaElement;

  const sendBtn = el("button.bottom-chat-send", { type: "button" }, "전송") as HTMLButtonElement;

  const note = el("div.bottom-chat-note", "WASD/방향키로 이동 · 채팅창 포커스 중에는 이동 입력이 막힘");

  const inputRow = el("div.bottom-chat-input-row", input, sendBtn);
  const body = el("div.bottom-chat-body", log, inputRow, note);

  inner.append(header, body);
  wrap.append(inner);

  function appendMessage(m: { account: string; text: string }) {
    const shouldStick = isNearBottom(log);

    const row = el(
      "div.bottom-chat-row",
      el("div.bottom-chat-who", shorten(m.account)),
      el("div.bottom-chat-text", m.text)
    );

    log.append(row);

    while (log.childElementCount > MAX_UI_MESSAGES) log.firstElementChild?.remove();

    if (shouldStick) requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
  }

  function clearLog() {
    log.innerHTML = "";
  }

  async function sendCurrent() {
    const text = input.value.trim();
    if (!text) return;

    try {
      service.sendChat(text);
      input.value = "";
      input.focus();
    } catch (err: any) {
      console.error("[bottom-chat] send failed", err);
      showErrorAlert("전송 실패", err?.message ?? "메시지를 전송하지 못했습니다.");
    }
  }

  sendBtn.onclick = () => void sendCurrent();

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      void sendCurrent();
    }
  });

  const ac = new AbortController();
  const sig = ac.signal;

  service.addEventListener(
    "init",
    (e: any) => {
      clearLog();
      const recent = (e.detail?.recentMessages ?? []) as any[];
      for (const m of recent) appendMessage({ account: m.account ?? "-", text: m.text ?? "" });
    },
    { signal: sig } as any
  );

  service.addEventListener(
    "chat",
    (e: any) => {
      const m = e.detail;
      if (!m) return;
      appendMessage({ account: m.account ?? "-", text: m.text ?? "" });
    },
    { signal: sig } as any
  );

  service.addEventListener(
    "disconnect",
    () => {
      clearLog();
    },
    { signal: sig } as any
  );

  const setVisible = (visible: boolean) => {
    wrap.style.display = visible ? "flex" : "none";
  };

  const remove = () => {
    ac.abort();
    wrap.remove();
  };

  return { el: wrap, setVisible, remove };
}
