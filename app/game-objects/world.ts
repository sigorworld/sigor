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

  constructor(public service: WorldService) {
    super({ layer: "world" } as any);

    this.service.addEventListener("init", () => this.syncFromPlayers());
    this.service.addEventListener("players", () => this.syncFromPlayers());
    this.service.addEventListener("disconnect", () => this.clearAll());

    // ✅ 채팅 오면 말풍선 + 그 유저 프로필 로드 트리거
    this.service.addEventListener("chat", (e: any) => {
      const m = e.detail as { account?: EvmAddress; text?: string } | null;
      if (!m?.account || !m.text) return;

      const ch = this.characters.get(m.account);
      ch?.showSpeech(m.text);

      void globalProfileStore.ensure([m.account]);
      this.applyProfileToCharacter(m.account);
    });

    // ✅ 프로필 업데이트되면 닉네임 + appearance 갱신
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

  private applyProfileToCharacter(account: EvmAddress) {
    const ch = this.characters.get(account);
    if (!ch) return;

    const nick = globalProfileStore.getNickname(account);
    ch.setNickname(nick ? nick : shorten(account));

    const app = globalProfileStore.getAppearance(account);
    ch.applyAppearance(app);
  }

  private async syncFromPlayers() {
    // 1) 캐릭터 생성/업데이트
    for (const [account, p] of this.service.players.entries()) {
      const ch = this.ensureCharacter(account);
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

    // 3) 프로필 로드 + 즉시 적용(캐시에 있는 값부터)
    const accounts = Array.from(this.service.players.keys());
    void globalProfileStore.ensure(accounts);

    for (const a of accounts) this.applyProfileToCharacter(a);
  }

  private clearAll() {
    for (const ch of this.characters.values()) ch.remove();
    this.characters.clear();
  }
}

export const globalWorld = new World(globalWorldService);
