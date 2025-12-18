import type { Atlas } from "kiwiengine";
import type { CharacterData } from "../types/character";

export type Dir4 = "up" | "down" | "left" | "right";

export const DEFAULT_CHARACTER_SHEET_SRC = "https://sigorworld.github.io/static-sigor-assets/characters/dogesoundclub-mates/0.png";

const dscMatesAtlas: Atlas = {
  frames: {
    "front-1": { x: 27, y: 3, w: 22, h: 32 },
    "front-2": { x: 49, y: 3, w: 22, h: 32 },
    "front-3": { x: 71, y: 3, w: 22, h: 32 },
    "back-1": { x: 27, y: 35, w: 22, h: 32 },
    "back-2": { x: 49, y: 35, w: 22, h: 32 },
    "back-3": { x: 71, y: 35, w: 22, h: 32 },
    "side-1": { x: 27, y: 67, w: 22, h: 32 },
    "side-2": { x: 49, y: 67, w: 22, h: 32 },
    "side-3": { x: 71, y: 67, w: 22, h: 32 },
  },
  animations: {
    "front-idle": { frames: ["front-1"], fps: 12, loop: false },
    "front-walk": { frames: ["front-1", "front-2", "front-3"], fps: 12, loop: true },
    "back-idle": { frames: ["back-1"], fps: 12, loop: false },
    "back-walk": { frames: ["back-1", "back-2", "back-3"], fps: 12, loop: true },
    "side-idle": { frames: ["side-1"], fps: 12, loop: false },
    "side-walk": { frames: ["side-1", "side-2", "side-3"], fps: 12, loop: true },
  },
};

const dscMatesActions = {
  sideIdle: "side-idle",
  sideWalk: "side-walk",
  frontIdle: "front-idle",
  frontWalk: "front-walk",
  backIdle: "back-idle",
  backWalk: "back-walk",
};

export const defaultCharacterData: CharacterData = {
  spriteType: "spritesheet",
  // @ts-expect-error: CharacterData에 src가 optional이 아닌 경우 프로젝트 타입에 맞춰 추가/수정하세요.
  src: DEFAULT_CHARACTER_SHEET_SRC,
  atlas: dscMatesAtlas,
  actions: dscMatesActions,
  scale: 2,
  pivotY: 10,
};

export function resolveCharacterAnimation(params: {
  actions: typeof dscMatesActions;
  dir?: string;
  moving: boolean;
}): { animation: string; loop: boolean; flipX: boolean } {
  const { actions, dir, moving } = params;

  const d = (dir ?? "down") as Dir4;

  // 좌/우는 side 애니메이션 + flip 으로 처리
  if (d === "left") {
    return {
      animation: moving ? actions.sideWalk : actions.sideIdle,
      loop: moving,
      flipX: true,
    };
  }
  if (d === "right") {
    return {
      animation: moving ? actions.sideWalk : actions.sideIdle,
      loop: moving,
      flipX: false,
    };
  }
  if (d === "up") {
    return {
      animation: moving ? actions.backWalk : actions.backIdle,
      loop: moving,
      flipX: false,
    };
  }

  // down
  return {
    animation: moving ? actions.frontWalk : actions.frontIdle,
    loop: moving,
    flipX: false,
  };
}
