import { GameObject } from "kiwiengine";
import { globalProfileStore } from "../services/profile-store";
import { WorldService } from "../services/world-service";
import type { EvmAddress, PlayerState } from "../types/world";
import { UserCharacter } from "./user-character";

function shorten(addr: string) {
  if (!addr?.startsWith("0x") || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const globalWorldService = new WorldService();

class World extends GameObject {
  private characters = new Map<EvmAddress, UserCharacter>();

  // ✅ ensure 호출 과다 방지(간단한 디바운스/배치)
  private ensureQueue = new Set<EvmAddress>();
  private ensureTimer: number | null = null;

  constructor(public service: WorldService) {
    super({ layer: "world" } as any);

    // players 이벤트는 이동/동기화가 매우 자주 올 수 있음
    this.service.addEventListener("init", () => void this.syncFromPlayers());
    this.service.addEventListener("players", () => void this.syncFromPlayers());
    this.service.addEventListener("disconnect", () => this.clearAll());

    // ✅ 채팅: 말풍선 + 프로필 로드 트리거(외형 적용은 update 이벤트로)
    this.service.addEventListener("chat", (e: any) => {
      const m = e.detail as { account?: EvmAddress; text?: string } | null;
      if (!m?.account || !m.text) return;

      const ch = this.characters.get(m.account);
      ch?.showSpeech(m.text);

      // 프로필 로드 예약(즉시 applyProfileToCharacter는 "캐시 값만" 적용)
      this.queueEnsure([m.account]);
      this.applyProfileToCharacter(m.account);
    });

    // ✅ 프로필 업데이트 이벤트에서만 appearance 적용
    globalProfileStore.addEventListener("update", (e: any) => {
      const addrs: EvmAddress[] = e?.detail?.addresses ?? [];
      for (const a of addrs) this.applyProfileToCharacter(a);
    });
  }

  private ensureCharacter(account: EvmAddress): UserCharacter {
    let ch = this.characters.get(account);
    if (!ch) {
      ch = new UserCharacter(account);
      this.characters.set(account, ch);
      this.add(ch);
    }
    return ch;
  }

  /**
   * ✅ 캐시에 있는 닉/appearance만 반영
   * - appearance는 내부에서 key 비교로 “바뀐 경우만” setCharacterData 호출
   */
  private applyProfileToCharacter(account: EvmAddress) {
    const ch = this.characters.get(account);
    if (!ch) return;

    const nick = globalProfileStore.getNickname(account);
    ch.setNickname(nick ? nick : shorten(account));

    const app = globalProfileStore.getAppearance(account);
    ch.applyAppearance(app);
  }

  private async syncFromPlayers() {
    const newlyCreated: EvmAddress[] = [];

    // 1) 생성/이동 상태 적용(절대 appearance 건드리지 않음)
    for (const [account, p] of this.service.players.entries()) {
      let ch = this.characters.get(account);
      if (!ch) {
        ch = this.ensureCharacter(account);
        newlyCreated.push(account);
      }
      ch.applyPlayerState(p as PlayerState);
    }

    // 2) 제거
    for (const account of Array.from(this.characters.keys())) {
      if (!this.service.players.has(account)) {
        const ch = this.characters.get(account)!;
        this.characters.delete(account);
        ch.remove();
      }
    }

    // 3) 프로필 로드 요청만(배치)
    const accounts = Array.from(this.service.players.keys());
    this.queueEnsure(accounts);

    // ✅ 새로 등장한 애들만 "캐시 값" 즉시 반영
    for (const a of newlyCreated) this.applyProfileToCharacter(a);

    // ❌ 여기서 전원 applyProfileToCharacter 돌리면 이동때마다 스프라이트 갈림
  }

  private clearAll() {
    for (const ch of this.characters.values()) ch.remove();
    this.characters.clear();

    this.ensureQueue.clear();
    if (this.ensureTimer) window.clearTimeout(this.ensureTimer);
    this.ensureTimer = null;
  }

  /**
   * ✅ ensure를 주소별로 배치 호출 (연속 players 이벤트에 안전)
   */
  private queueEnsure(addrs: EvmAddress[]) {
    for (const a of addrs) this.ensureQueue.add(a);

    if (this.ensureTimer) return;

    this.ensureTimer = window.setTimeout(() => {
      this.ensureTimer = null;

      const list = Array.from(this.ensureQueue);
      this.ensureQueue.clear();

      if (list.length) void globalProfileStore.ensure(list);
    }, 50);
  }
}

export const globalWorld = new World(globalWorldService);
