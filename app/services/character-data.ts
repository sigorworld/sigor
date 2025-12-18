import type { CharacterData } from "../types/character";
import { buildAtlas } from "../utils/atlas";

export type Dir4 = "up" | "down" | "left" | "right";

export const DEFAULT_CHARACTER_SHEET_SRC = "https://sigorworld.github.io/static-sigor-assets/characters/dogesoundclub-mates/0.png";

const dscCharacterData: CharacterData = {
  spriteType: "spritesheet",
  atlas: {
    frames: {
      "front-1": { x: 27, y: 3, w: 22, h: 32 },
      "front-2": { x: 49, y: 3, w: 22, h: 32 },
      "front-3": { x: 71, y: 3, w: 22, h: 32 },
      "back-1": { x: 27, y: 35, w: 22, h: 32 },
      "back-2": { x: 49, y: 35, w: 22, h: 32 },
      "back-3": { x: 71, y: 35, w: 22, h: 32 },
      "right-1": { x: 27, y: 67, w: 22, h: 32 },
      "right-2": { x: 49, y: 67, w: 22, h: 32 },
      "right-3": { x: 71, y: 67, w: 22, h: 32 },
    },
    animations: {
      "front-idle": { frames: ["front-1"], fps: 12, loop: false },
      "front-walk": { frames: ["front-1", "front-2", "front-3"], fps: 12, loop: true },
      "back-idle": { frames: ["back-1"], fps: 12, loop: false },
      "back-walk": { frames: ["back-1", "back-2", "back-3"], fps: 12, loop: true },
      "right-idle": { frames: ["right-1"], fps: 12, loop: false },
      "right-walk": { frames: ["right-1", "right-2", "right-3"], fps: 12, loop: true },
    },
  },
  actions: {
    frontIdle: "front-idle",
    frontWalk: "front-walk",
    rightIdle: "right-idle",
    rightWalk: "right-walk",
    backIdle: "back-idle",
    backWalk: "back-walk",
  },
  scale: 2,
  pivotY: 10,
}

const sigorSparrowCharacterData: CharacterData = {
  spriteType: "spritesheet",
  atlas: buildAtlas({
    imageWidth: 245,
    imageHeight: 432,
    framesPerRow: 3,
    framesPerCol: 4,
    animations: {
      'front-idle': { startRow: 0, startCol: 1, frameCount: 1, loop: false },
      'front-walk': { startRow: 0, startCol: 0, frameCount: 3, loop: true },
      'left-idle': { startRow: 1, startCol: 1, frameCount: 1, loop: false },
      'left-walk': { startRow: 1, startCol: 0, frameCount: 3, loop: true },
      'right-idle': { startRow: 2, startCol: 1, frameCount: 1, loop: false },
      'right-walk': { startRow: 2, startCol: 0, frameCount: 3, loop: true },
      'back-idle': { startRow: 3, startCol: 1, frameCount: 1, loop: false },
      'back-walk': { startRow: 3, startCol: 0, frameCount: 3, loop: true },
    },
    fps: 12
  }),
  actions: {
    frontIdle: 'front-idle',
    frontWalk: 'front-walk',
    leftIdle: 'left-idle',
    leftWalk: 'left-walk',
    rightIdle: 'right-idle',
    rightWalk: 'right-walk',
    backIdle: 'back-idle',
    backWalk: 'back-walk',
  },
  scale: 0.8,
  pivotX: -5,
  pivotY: 34,
}

const kcdKongzCharacterData: CharacterData = {
  spriteType: "spritesheet",
  atlas: buildAtlas({
    imageWidth: 1536,
    imageHeight: 1038,
    framesPerRow: 6,
    framesPerCol: 6,
    animations: {
      'left-idle': { startRow: 0, startCol: 0, frameCount: 20, loop: true },
      'left-walk': { startRow: 3, startCol: 2, frameCount: 12, loop: true },
    },
    fps: 12
  }),
  actions: {
    leftIdle: 'left-idle',
    leftWalk: 'left-walk',
  },
  scale: 0.6,
  pivotX: -5,
  pivotY: 34,
}

const babypingCharacterData: CharacterData = {
  spriteType: "spritesheet",
  atlas: buildAtlas({
    imageWidth: 360,
    imageHeight: 324,
    framesPerRow: 4,
    framesPerCol: 3,
    animations: {
      'front-idle': { startRow: 1, startCol: 0, frameCount: 1, loop: false },
      'front-walk': { startRow: 0, startCol: 2, frameCount: 3, loop: true },
      'left-idle': { startRow: 1, startCol: 3, frameCount: 1, loop: false },
      'left-walk': { startRow: 1, startCol: 2, frameCount: 3, loop: true },
      'right-idle': { startRow: 0, startCol: 1, frameCount: 1, loop: false },
      'right-walk': { startRow: 0, startCol: 0, frameCount: 3, loop: true },
      'back-idle': { startRow: 2, startCol: 2, frameCount: 1, loop: false },
      'back-walk': { startRow: 2, startCol: 1, frameCount: 3, loop: true },
    },
    fps: 12
  }),
  actions: {
    frontIdle: 'front-idle',
    frontWalk: 'front-walk',
    leftIdle: 'left-idle',
    leftWalk: 'left-walk',
    rightIdle: 'right-idle',
    rightWalk: 'right-walk',
    backIdle: 'back-idle',
    backWalk: 'back-walk',
  },
  scale: 0.6,
  pivotY: 28,
}

export const defaultCharacterData: CharacterData = {
  // @ts-expect-error: CharacterData에 src가 optional이 아닌 경우 프로젝트 타입에 맞춰 추가/수정하세요.
  src: DEFAULT_CHARACTER_SHEET_SRC,
  ...dscCharacterData,
};

export function resolveCharacterAnimation(params: {
  actions: {
    frontIdle?: string;
    frontWalk?: string;
    leftIdle?: string;
    leftWalk?: string;
    rightIdle?: string;
    rightWalk?: string;
    backIdle?: string;
    backWalk?: string;
  };
  dir?: string;
  moving: boolean;
}): { animation: string; loop: boolean; flipX: boolean } {
  const { actions, dir = "down", moving } = params;

  const pick = (idle?: string, walk?: string) => ({
    animation: moving ? (walk ?? idle) : (idle ?? walk),
    loop: moving,
  });

  const hasLeft = !!(actions.leftIdle || actions.leftWalk);
  const hasRight = !!(actions.rightIdle || actions.rightWalk);
  const hasFront = !!(actions.frontIdle || actions.frontWalk);
  const hasBack = !!(actions.backIdle || actions.backWalk);

  // 방향별 우선순위 + 미러링 규칙
  if (dir === "left") {
    if (hasLeft) {
      const { animation, loop } = pick(actions.leftIdle, actions.leftWalk);
      return { animation: animation!, loop, flipX: false };
    }
    if (hasRight) {
      const { animation, loop } = pick(actions.rightIdle, actions.rightWalk);
      return { animation: animation!, loop, flipX: true }; // right를 flip해서 left
    }
  }

  if (dir === "right") {
    if (hasRight) {
      const { animation, loop } = pick(actions.rightIdle, actions.rightWalk);
      return { animation: animation!, loop, flipX: false };
    }
    if (hasLeft) {
      const { animation, loop } = pick(actions.leftIdle, actions.leftWalk);
      return { animation: animation!, loop, flipX: true }; // left를 flip해서 right
    }
  }

  if (dir === "up") {
    if (hasBack) {
      const { animation, loop } = pick(actions.backIdle, actions.backWalk);
      return { animation: animation!, loop, flipX: false };
    }
    // back 없으면 front로 대체
    if (hasFront) {
      const { animation, loop } = pick(actions.frontIdle, actions.frontWalk);
      return { animation: animation!, loop, flipX: false };
    }
  }

  // down (default)
  if (hasFront) {
    const { animation, loop } = pick(actions.frontIdle, actions.frontWalk);
    return { animation: animation!, loop, flipX: false };
  }
  // front 없으면 back으로 대체
  if (hasBack) {
    const { animation, loop } = pick(actions.backIdle, actions.backWalk);
    return { animation: animation!, loop, flipX: false };
  }

  // 최후의 수단: 좌/우 아무거나 있으면 그걸로
  if (hasRight) {
    const { animation, loop } = pick(actions.rightIdle, actions.rightWalk);
    return { animation: animation!, loop, flipX: false };
  }
  if (hasLeft) {
    const { animation, loop } = pick(actions.leftIdle, actions.leftWalk);
    return { animation: animation!, loop, flipX: false };
  }

  // 정말 아무것도 없으면 (타입상 string을 반환해야 해서) 빈 문자열
  return { animation: "", loop: false, flipX: false };
}
