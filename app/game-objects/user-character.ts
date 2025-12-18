import type { EvmAddress } from "../types/world";
import { Character } from "./character";

export class UserCharacter extends Character {
  public readonly account: EvmAddress;

  constructor(account: EvmAddress) {
    super();
    this.account = account;
  }
}
