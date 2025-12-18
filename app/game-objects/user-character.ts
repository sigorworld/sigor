import { getCharacterData } from "../services/character-data";
import type { EvmAddress } from "../types/world";
import { Character } from "./character"; // 경로는 프로젝트에 맞게

type Appearance = {
  nftAddress: string;
  tokenId: number;
  parts?: any;
  image?: string;
};

export class UserCharacter extends Character {
  private account: EvmAddress;

  private nicknameText: string = "";
  private appearance: Appearance | null = null;

  constructor(account: EvmAddress) {
    super();
    this.account = account;

    // 초기 표시(원하면 주소로)
    this.setNickname(account);
  }

  applyPlayerState(state: any) {
    // 기존 코드 유지 (state -> PlayerState로 맞추면 더 좋음)
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
    if (app === undefined) return; // 아직 로드 전이면 무시

    this.appearance = app ?? null;

    // ✅ 없으면 fallback, 있으면 캐릭터 데이터 생성 후 적용
    if (!app) {
      this.setCharacterData(null);
      return;
    }

    const data = getCharacterData(app);
    this.setCharacterData(data);
  }
}
