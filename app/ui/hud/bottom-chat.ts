import { el } from "@webtaku/el";
import "./bottom-chat.css";

import { showErrorAlert } from "../../components/alert";
import { globalProfileStore } from "../../services/profile-store";
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

  const note = el("div.bottom-chat-note", "WASD/방향키 이동 · 터치는 화면 드래그로 이동");

  const inputRow = el("div.bottom-chat-input-row", input, sendBtn);
  const body = el("div.bottom-chat-body", log, inputRow, note);

  inner.append(header, body);
  wrap.append(inner);

  // -----------------------------
  // IME (맥 한글) 조합 처리
  // -----------------------------
  let composing = false;
  input.addEventListener("compositionstart", () => (composing = true));
  input.addEventListener("compositionend", () => (composing = false));

  // -----------------------------
  // render helpers
  // -----------------------------
  function displayName(account: string) {
    if (account.startsWith("0x")) {
      return globalProfileStore.getDisplayName(account as any);
    }
    return account;
  }

  function appendMessage(m: { account: string; text: string }) {
    const shouldStick = isNearBottom(log);

    // 닉네임 프리로드
    if (m.account.startsWith("0x")) void globalProfileStore.ensure([m.account as any]);

    const whoEl = el("div.bottom-chat-who", displayName(m.account)) as HTMLElement;
    whoEl.setAttribute("data-account", m.account);

    const row = el(
      "div.bottom-chat-row",
      whoEl,
      el("div.bottom-chat-text", m.text)
    ) as HTMLElement;

    row.setAttribute("data-account", m.account);

    log.append(row);

    while (log.childElementCount > MAX_UI_MESSAGES) log.firstElementChild?.remove();

    if (shouldStick) requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
  }

  function clearLog() {
    log.innerHTML = "";
  }

  // ✅ 프로필 로드 후 기존 행 닉네임 갱신
  const onProfileUpdate = () => {
    const whoEls = log.querySelectorAll<HTMLElement>(".bottom-chat-who[data-account]");
    whoEls.forEach((el) => {
      const acc = el.getAttribute("data-account")!;
      if (acc.startsWith("0x")) el.textContent = displayName(acc);
      else el.textContent = acc;
    });
  };
  globalProfileStore.addEventListener("update", onProfileUpdate);

  // -----------------------------
  // send handlers
  // -----------------------------
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
    // ✅ 조합 중 Enter는 전송 금지 (맥 한글 마지막 글자 쪼개짐 방지)
    // - ev.isComposing: 크롬/엣지
    // - keyCode 229: 일부 사파리/IME 케이스
    const ime = (ev as any).isComposing || composing || (ev as any).keyCode === 229;

    if (ev.key === "Enter" && !ev.shiftKey) {
      if (ime) return; // 조합 중이면 줄바꿈/전송 모두 막고, 조합 완료 후 Enter로 전송
      ev.preventDefault();
      void sendCurrent();
    }
  });

  // -----------------------------
  // world events (UI only)
  // -----------------------------
  const ac = new AbortController();
  const sig = ac.signal;

  service.addEventListener(
    "init",
    (e: any) => {
      clearLog();
      const recent = (e.detail?.recentMessages ?? []) as any[];
      const accounts = recent.map((m) => m.account).filter((a) => typeof a === "string" && a.startsWith("0x"));
      if (accounts.length) void globalProfileStore.ensure(accounts as any);

      for (const m of recent) {
        appendMessage({
          account: m.account ?? "-",
          text: m.text ?? "",
        });
      }
    },
    { signal: sig } as any
  );

  service.addEventListener(
    "chat",
    (e: any) => {
      const m = e.detail;
      if (!m) return;
      appendMessage({
        account: m.account ?? "-",
        text: m.text ?? "",
      });
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

  // public api
  const setVisible = (visible: boolean) => {
    wrap.style.display = visible ? "flex" : "none";
  };

  const remove = () => {
    ac.abort();
    globalProfileStore.removeEventListener("update", onProfileUpdate);
    wrap.remove();
  };

  return { el: wrap, setVisible, remove };
}
