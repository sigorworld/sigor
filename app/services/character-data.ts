import { Atlas } from "kiwiengine";
import { CharacterData } from "../types/character";

const dscMatesAtlas: Atlas = {
  frames: {
    'front-1': { x: 27, y: 3, w: 22, h: 32 },
    'front-2': { x: 49, y: 3, w: 22, h: 32 },
    'front-3': { x: 71, y: 3, w: 22, h: 32 },
    'back-1': { x: 27, y: 35, w: 22, h: 32 },
    'back-2': { x: 49, y: 35, w: 22, h: 32 },
    'back-3': { x: 71, y: 35, w: 22, h: 32 },
    'side-1': { x: 27, y: 67, w: 22, h: 32 },
    'side-2': { x: 49, y: 67, w: 22, h: 32 },
    'side-3': { x: 71, y: 67, w: 22, h: 32 },
  },
  animations: {
    'front-idle': { frames: ['front-1'], fps: 12, loop: false },
    'front-walk': { frames: ['front-1', 'front-2', 'front-3'], fps: 12, loop: true },
    'back-idle': { frames: ['back-1'], fps: 12, loop: false },
    'back-walk': { frames: ['back-1', 'back-2', 'back-3'], fps: 12, loop: true },
    'side-idle': { frames: ['side-1'], fps: 12, loop: false },
    'side-walk': { frames: ['side-1', 'side-2', 'side-3'], fps: 12, loop: true },
  }
}

const dscMatesActions = {
  sideIdle: 'side-idle',
  sideWalk: 'side-walk',
  frontIdle: 'front-idle',
  frontWalk: 'front-walk',
  backIdle: 'back-idle',
  backWalk: 'back-walk'
}

const defaultCharacterData: CharacterData = {
  spriteType: 'spritesheet',
  atlas: dscMatesAtlas,
  actions: dscMatesActions
}
