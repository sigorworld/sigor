import { GameObject } from "kiwiengine";
import { PlayerState } from "../types/world";

export abstract class Character extends GameObject {
  private _dir: string | undefined;

  applyPlayerState(p: PlayerState) {
    this.x = p.x;
    this.y = p.y;
    this._dir = p.dir;
  }

  get dir() { return this._dir; }
}
