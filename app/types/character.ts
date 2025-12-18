import { Atlas } from "kiwiengine"

export type AnimationConfig = {
  name: string
  pivotX?: number
  pivotY?: number
}

export type AnimationEntry = string | AnimationConfig

type BaseCharacterData = {
  actions: {
    frontIdle?: AnimationEntry | AnimationEntry[]
    frontWalk?: AnimationEntry | AnimationEntry[]
    leftIdle?: AnimationEntry | AnimationEntry[]
    leftWalk?: AnimationEntry | AnimationEntry[]
    rightIdle?: AnimationEntry | AnimationEntry[]
    rightWalk?: AnimationEntry | AnimationEntry[]
    backIdle?: AnimationEntry | AnimationEntry[]
    backWalk?: AnimationEntry | AnimationEntry[]
  }

  flippedAnimations?: string[]

  scale?: number
  scaleX?: number
  scaleY?: number
  pivotX?: number
  pivotY?: number
}

type SpritesheetCharacterData = {
  spriteType: 'spritesheet',
  atlas: Atlas
} & BaseCharacterData

type SpineCharacterData = {
  spriteType: 'spine'
} & BaseCharacterData

type CharacterData = SpritesheetCharacterData | SpineCharacterData

export { CharacterData }
