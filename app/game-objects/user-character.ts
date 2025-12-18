import { getCharacterData } from "../services/character-data";
import type { EvmAddress } from "../types/world";
import { Character } from "./character";

type Appearance = {
  nftAddress: string;
  tokenId: number;
  parts?: any;
  image?: string;
};

function stableStringify(v: any): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const t = typeof v;
  if (t === "string") return JSON.stringify(v);
  if (t === "number" || t === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(v).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return String(v);
}

function appearanceKey(app: Appearance | null): string {
  if (!app) return "none";
  return [
    app.nftAddress ?? "",
    app.tokenId ?? 0,
    app.image ?? "",
    stableStringify(app.parts),
  ].join("|");
}

export class UserCharacter extends Character {
  private account: EvmAddress;

  private nicknameText = "";
  private appearance: Appearance | null = null;

  // ✅ 마지막 적용된 appearance 키(같으면 무시)
  private appearanceKey = "none";

  constructor(account: EvmAddress) {
    super();
    this.account = account;
    this.setNickname(account);
  }

  applyPlayerState(state: any) {
    super.applyPlayerState(state);
  }

  setNickname(n: string) {
    this.nicknameText = n;
    super.setNickname(n);
  }

  showSpeech(text: string) {
    super.showSpeech(text);
  }

  applyAppearance(app: Appearance | null | undefined) {
    if (app === undefined) return; // 아직 로드 전

    const nextKey = appearanceKey(app ?? null);
    if (nextKey === this.appearanceKey) return; // ✅ 동일 외형이면 아무것도 안 함

    this.appearanceKey = nextKey;
    this.appearance = app ?? null;

    if (!app) {
      this.setCharacterData(null);
      return;
    }

    const data = getCharacterData(app);

    this.setCharacterData(data);
  }
}
