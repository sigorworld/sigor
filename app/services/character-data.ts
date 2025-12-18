import type { AnimationConfig, AnimationEntry, CharacterData, SpritesheetCharacterData } from "../types/character";
import { buildAtlas } from "../utils/atlas";

export type Dir4 = "up" | "down" | "left" | "right";

export const DEFAULT_CHARACTER_SHEET_SRC = "https://sigorworld.github.io/static-sigor-assets/characters/dogesoundclub-mates/0.png";

const dscCharacterData: Omit<SpritesheetCharacterData, 'src'> = {
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

const sigorSparrowCharacterData: Omit<SpritesheetCharacterData, 'src'> = {
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

const kcdKongzCharacterData: Omit<SpritesheetCharacterData, 'src'> = {
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

const babypingCharacterData: Omit<SpritesheetCharacterData, 'src'> = {
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

const defaultCharacterData: CharacterData = {
  src: DEFAULT_CHARACTER_SHEET_SRC,
  ...dscCharacterData,
};

export function getCharacterData(app: {
  nftAddress: string;
  tokenId: number;
  parts?: any;
  image?: string;
}): CharacterData {
  if (app.nftAddress === '0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae') {
    return {
      src: `https://sigorworld.github.io/static-sigor-assets/characters/dogesoundclub-mates/${app.tokenId}.png`,
      ...dscCharacterData,
    }
  } else if (app.nftAddress === '0xDeDd727ab86bce5D416F9163B2448860BbDE86d4') {
    const imageSrc = app.image ?? "";
    const parts = imageSrc.split("/");
    const imagesIndex = parts.indexOf("images");
    const type = imagesIndex !== -1 ? parts[imagesIndex + 1] : null;
    return {
      src: `https://sigorworld.github.io/static-sigor-assets/characters/dogesoundclub-biased-mates/${type}/${app.tokenId}.png`,
      ...dscCharacterData,
    }
  } else if (app.nftAddress === '0xF967431fb8F5B4767567854dE5448D2EdC21a482') {
    return {
      src: "https://sigorworld.github.io/static-sigor-assets/characters/kingcrowndao-kongz/temp-character.png",
      ...kcdKongzCharacterData,
    }
  } else if (app.nftAddress === '0x7340a44AbD05280591377345d21792Cdc916A388') {
    return {
      src: "https://sigorworld.github.io/static-sigor-assets/characters/sigor-sparrows/temp-character.png",
      ...sigorSparrowCharacterData,
    }
  } else if (app.nftAddress === '0x595b299Db9d83279d20aC37A85D36489987d7660') {
    const bodyType = (app.parts?.Body ?? "").replace(/\s+/g, "").toLowerCase();
    return {
      src: `https://sigorworld.github.io/static-sigor-assets/characters/babyping/${bodyType}/spritesheet.png`,
      ...babypingCharacterData,
    }
  } else {
    return defaultCharacterData
  }
}

export function resolveCharacterAnimation(params: {
  actions: {
    frontIdle?: AnimationEntry | AnimationEntry[];
    frontWalk?: AnimationEntry | AnimationEntry[];
    leftIdle?: AnimationEntry | AnimationEntry[];
    leftWalk?: AnimationEntry | AnimationEntry[];
    rightIdle?: AnimationEntry | AnimationEntry[];
    rightWalk?: AnimationEntry | AnimationEntry[];
    backIdle?: AnimationEntry | AnimationEntry[];
    backWalk?: AnimationEntry | AnimationEntry[];
  };
  dir?: string;
  moving: boolean;
}): { animation: string; loop: boolean; flipX: boolean; pivotX?: number; pivotY?: number } {
  const { actions, dir = "down", moving } = params;

  const toList = (entry?: AnimationEntry | AnimationEntry[]): AnimationEntry[] => {
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  };

  const pickOne = (list: AnimationEntry[]): AnimationEntry | undefined => {
    if (list.length === 0) return undefined;
    if (list.length === 1) return list[0];
    return list[Math.floor(Math.random() * list.length)];
    // 항상 첫 번째를 쓰고 싶으면 위 줄 대신: return list[0];
  };

  const toConfig = (entry: AnimationEntry): AnimationConfig =>
    typeof entry === "string" ? { name: entry } : entry;

  const pick = (
    idle?: AnimationEntry | AnimationEntry[],
    walk?: AnimationEntry | AnimationEntry[]
  ): { animation: string; loop: boolean; pivotX?: number; pivotY?: number } => {
    const idleList = toList(idle);
    const walkList = toList(walk);

    const chosenEntry = moving
      ? (pickOne(walkList) ?? pickOne(idleList))
      : (pickOne(idleList) ?? pickOne(walkList));

    if (!chosenEntry) return { animation: "", loop: false };

    const cfg = toConfig(chosenEntry);
    return {
      animation: cfg.name,
      loop: moving, // 기존 동작 유지 (walk가 없어 idle을 쓰더라도 moving이면 loop=true)
      pivotX: cfg.pivotX,
      pivotY: cfg.pivotY,
    };
  };

  const hasLeft = toList(actions.leftIdle).length > 0 || toList(actions.leftWalk).length > 0;
  const hasRight = toList(actions.rightIdle).length > 0 || toList(actions.rightWalk).length > 0;
  const hasFront = toList(actions.frontIdle).length > 0 || toList(actions.frontWalk).length > 0;
  const hasBack = toList(actions.backIdle).length > 0 || toList(actions.backWalk).length > 0;

  // 방향별 우선순위 + 미러링 규칙
  if (dir === "left") {
    if (hasLeft) {
      const r = pick(actions.leftIdle, actions.leftWalk);
      return { ...r, flipX: false };
    }
    if (hasRight) {
      const r = pick(actions.rightIdle, actions.rightWalk);
      return { ...r, flipX: true }; // right를 flip해서 left
    }
  }

  if (dir === "right") {
    if (hasRight) {
      const r = pick(actions.rightIdle, actions.rightWalk);
      return { ...r, flipX: false };
    }
    if (hasLeft) {
      const r = pick(actions.leftIdle, actions.leftWalk);
      return { ...r, flipX: true }; // left를 flip해서 right
    }
  }

  if (dir === "up") {
    if (hasBack) {
      const r = pick(actions.backIdle, actions.backWalk);
      return { ...r, flipX: false };
    }
    if (hasFront) {
      const r = pick(actions.frontIdle, actions.frontWalk);
      return { ...r, flipX: false };
    }
  }

  // down (default)
  if (hasFront) {
    const r = pick(actions.frontIdle, actions.frontWalk);
    return { ...r, flipX: false };
  }
  if (hasBack) {
    const r = pick(actions.backIdle, actions.backWalk);
    return { ...r, flipX: false };
  }

  // 최후의 수단
  if (hasRight) {
    const r = pick(actions.rightIdle, actions.rightWalk);
    return { ...r, flipX: false };
  }
  if (hasLeft) {
    const r = pick(actions.leftIdle, actions.leftWalk);
    return { ...r, flipX: false };
  }

  return { animation: "", loop: false, flipX: false };
}
