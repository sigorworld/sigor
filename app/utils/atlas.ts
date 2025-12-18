import { Atlas } from 'kiwiengine'

export function buildAtlas(data: {
  imageWidth: number
  imageHeight: number
  framesPerRow: number
  framesPerCol: number
  fps: number
  animations: {
    [animation: string]: {
      startCol: number
      startRow: number
      frameCount: number
      loop: boolean
    }
  }
}): Atlas {

  const atlas: Atlas = {
    frames: {},
    animations: {}
  }

  // 프레임 크기 자동 계산
  const frameWidth = data.imageWidth / data.framesPerRow
  const frameHeight = data.imageHeight / data.framesPerCol

  let globalFrameIndex = 0

  for (const animName in data.animations) {
    const anim = data.animations[animName]

    const {
      startCol,
      startRow,
      frameCount
    } = anim

    const frameNames: string[] = []

    for (let i = 0; i < frameCount; i++) {
      // 시작 타일부터 i만큼 이동
      const indexFromStart = startCol + i

      // 전체 시트 기준 col / row
      const col = indexFromStart % data.framesPerRow
      const row = startRow + Math.floor(indexFromStart / data.framesPerRow)

      const x = col * frameWidth
      const y = row * frameHeight

      const frameName = `${animName}-${globalFrameIndex}`

      atlas.frames[frameName] = {
        x,
        y,
        w: frameWidth,
        h: frameHeight
      }

      frameNames.push(frameName)
      globalFrameIndex++
    }

    atlas.animations[animName] = {
      frames: frameNames,
      fps: data.fps,
      loop: anim.loop
    }
  }

  return atlas
}