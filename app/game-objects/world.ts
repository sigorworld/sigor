import { GameObject } from "kiwiengine";
import { WorldService } from "../services/world-service";
import { EvmAddress, PlayerState } from "../types/world";
import { UserCharacter } from "./user-character";

export const globalWorldService = new WorldService();

class World extends GameObject {
  constructor(public service: WorldService) {
    super();

    this.service.addEventListener("init", () => this.syncCharactersFromPlayers());
    this.service.addEventListener("players", () => this.syncCharactersFromPlayers());
    this.service.addEventListener("disconnect", () => this.clearAllCharacters());
  }

  private characters = new Map<EvmAddress, UserCharacter>();

  private syncCharactersFromPlayers() {
    for (const [account, p] of this.service.players.entries()) {
      let ch = this.characters.get(account);
      if (!ch) {
        ch = new UserCharacter(account);
        this.characters.set(account, ch);
        (this as any).addChild?.(ch);
      }
      ch.applyPlayerState(p as PlayerState);
    }

    for (const account of Array.from(this.characters.keys())) {
      if (!this.service.players.has(account)) {
        const ch = this.characters.get(account)!;
        this.characters.delete(account);
        (ch as any).destroy?.();
        (this as any).removeChild?.(ch);
      }
    }
  }

  private clearAllCharacters() {
    for (const ch of this.characters.values()) {
      (ch as any).destroy?.();
      (this as any).removeChild?.(ch);
    }
    this.characters.clear();
  }
}

export const globalWorld = new World(globalWorldService);
