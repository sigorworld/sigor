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

    // ✅ 채팅 오면 말풍선
    this.service.addEventListener("chat", (e: any) => {
      const m = e.detail as { account?: EvmAddress; text?: string } | null;
      if (!m?.account || !m.text) return;
      const ch = this.characters.get(m.account);
      ch?.showSpeech(m.text);
      void globalProfileStore.ensure([m.account]); // 닉네임도 같이
    });

    // ✅ 프로필 업데이트되면 캐릭터 닉네임 갱신
    globalProfileStore.addEventListener("update", () => {
      this.applyNicknames();
    });
  }

  private async syncFromPlayers() {
    // 캐릭터 생성/업데이트
    for (const [account, p] of this.service.players.entries()) {
      let ch = this.characters.get(account);
      if (!ch) {
        ch = new UserCharacter(account);
        this.characters.set(account, ch);
        this.add(ch);
      }
      ch.applyPlayerState(p as PlayerState);
    }

    // 제거
    for (const account of Array.from(this.characters.keys())) {
      if (!this.service.players.has(account)) {
        const ch = this.characters.get(account)!;
        this.characters.delete(account);
        ch.remove();
      }
    }

    // ✅ 닉네임 로드/적용
    const accounts = Array.from(this.service.players.keys());
    void globalProfileStore.ensure(accounts);
    this.applyNicknames();
  }

  private applyNicknames() {
    for (const [account, ch] of this.characters.entries()) {
      const nick = globalProfileStore.getNickname(account);
      ch.setNickname(nick ? nick : shorten(account));
    }
  }

  private clearAll() {
    for (const ch of this.characters.values()) ch.remove();
    this.characters.clear();
  }
}

export const globalWorld = new World(globalWorldService);
