import { GameObject } from "kiwiengine";
import { WorldService } from "../services/world-service";
import type { EvmAddress, PlayerState } from "../types/world";
import { UserCharacter } from "./user-character";

export const globalWorldService = new WorldService();

class World extends GameObject {
  private characters = new Map<EvmAddress, UserCharacter>();

  constructor(public service: WorldService) {
    super({ layer: "world" } as any);

    this.service.addEventListener("init", () => this.syncFromPlayers());
    this.service.addEventListener("players", () => this.syncFromPlayers());
    this.service.addEventListener("disconnect", () => this.clearAll());
  }

  private syncFromPlayers() {
    // 생성/업데이트
    for (const [account, p] of this.service.players.entries()) {
      let ch = this.characters.get(account);
      if (!ch) {
        ch = new UserCharacter(account);
        this.characters.set(account, ch);
        this.add(ch); // ✅ 키위엔진은 add(...)
      }
      ch.applyPlayerState(p as PlayerState);
    }

    // 제거
    for (const account of Array.from(this.characters.keys())) {
      if (!this.service.players.has(account)) {
        const ch = this.characters.get(account)!;
        this.characters.delete(account);
        ch.remove(); // ✅ remove()로 트리에서 정리
      }
    }
  }

  private clearAll() {
    for (const ch of this.characters.values()) ch.remove();
    this.characters.clear();
  }
}

export const globalWorld = new World(globalWorldService);
