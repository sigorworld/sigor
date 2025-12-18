import { GameObject } from "kiwiengine";
import type { EvmAddress } from "../types/world";

type Appearance = {
  style?: string;
  parts?: string;
  dialogue?: string;
  image?: string;
};

export class UserCharacter extends GameObject {
  private account: EvmAddress;

  private nicknameText: string = "";
  private appearance: Appearance | null = null;

  constructor(account: EvmAddress) {
    super({ layer: "world" } as any);
    this.account = account;

    // 기본 스프라이트/상태 초기화
    // this.initSprite();
  }

  applyPlayerState(state: any) {
    // 기존 코드 유지
  }

  setNickname(n: string) {
    this.nicknameText = n;
    // 실제 화면 반영
    // this.nameTag.setText(n)
  }

  showSpeech(text: string) {
    // 기존 말풍선 로직 유지
  }

  applyAppearance(app: Appearance | null | undefined) {
    if (app === undefined) return; // 아직 로드 전이면 무시
    this.appearance = app ?? null;

    // 1) style 반영
    if (app?.style) {
      // 예: this.setStyle(app.style)
    } else {
      // 예: this.resetStyleToDefault()
    }

    // 2) parts 반영 (JSON string일 가능성)
    if (app?.parts) {
      try {
        // parts가 JSON string이라면 파싱해서 사용
        const parsed = JSON.parse(app.parts);
        // 예: this.setParts(parsed)
      } catch {
        // 파싱 실패 시 string 기반 fallback
        // 예: this.setPartsRaw(app.parts)
      }
    } else {
      // 예: this.clearParts()
    }

    // 3) image 반영 (절대/상대 경로 모두 가능)
    if (app?.image) {
      // 예: this.setSpriteFromUrl(app.image)
    } else {
      // 예: this.resetImage()
    }

    // 4) dialogue 프리셋 등 (선택)
    if (app?.dialogue) {
      // 예: this.setDefaultDialogue(app.dialogue)
    }
  }
}
