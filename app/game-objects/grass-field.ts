import { GameObject, RectangleNode } from "kiwiengine";

/**
 * 간단한 "맵 느낌" 배경:
 * - 큰 잔디 바탕 + 잔디 패치(톤 변화)
 * - 중앙 광장(샌드) + 십자 길
 * - 꽃/돌/덤불 장식(덤불은 world layer + useYSort로 캐릭터 앞/뒤 자연스럽게)
 *
 * ※ 충돌은 없고 시각적 요소만 추가합니다.
 */

type Opts = {
  size?: number;        // 배경 평면 크기
  patches?: number;     // 잔디 패치 수
  flowers?: number;     // 꽃/작은 포인트 수
  rocks?: number;       // 돌 포인트 수
  bushes?: number;      // 덤불 오브젝트 수
  plazaSize?: number;   // 중앙 광장 크기
  pathWidth?: number;   // 길 두께
};

function makeSeededRng(seed0 = 123456789) {
  let seed = seed0 | 0;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10000) / 10000;
  };
}

function pick<T>(arr: T[], r: number) {
  return arr[Math.floor(r * arr.length) % arr.length];
}

export class GrassField extends GameObject {
  constructor(opts?: Opts) {
    super({ layer: "bg" } as any);

    this.scale = 0.25;

    const size = opts?.size ?? 8000;
    const half = size / 2;

    const patches = opts?.patches ?? 220;
    const flowers = opts?.flowers ?? 180;
    const rocks = opts?.rocks ?? 90;
    const bushes = opts?.bushes ?? 55;

    const plazaSize = opts?.plazaSize ?? 540;
    const pathWidth = opts?.pathWidth ?? 180;

    const rnd = makeSeededRng(20251218);

    // -----------------------------
    // 1) Base grass
    // -----------------------------
    this.add(
      new RectangleNode({
        width: size,
        height: size,
        fill: 0x2f8f3a, // 기본 잔디
        layer: "bg",
      } as any)
    );

    // -----------------------------
    // 2) Grass tone patches
    // -----------------------------
    const grassTones = [0x2a7b33, 0x338a3e, 0x276d2e, 0x3a9a46];

    for (let i = 0; i < patches; i++) {
      const w = 140 + rnd() * 820;
      const h = 140 + rnd() * 820;
      const x = (rnd() * 2 - 1) * (half - w);
      const y = (rnd() * 2 - 1) * (half - h);

      const node: any = new RectangleNode({
        width: w,
        height: h,
        fill: pick(grassTones, rnd()),
        layer: "bg",
      } as any);

      node.x = x;
      node.y = y;
      this.add(node);
    }

    // -----------------------------
    // 3) Central plaza + cross paths (sand)
    // -----------------------------
    const sandMain = 0xd9c59a;
    const sandEdge = 0xcdb585;

    // 길(가로/세로)
    const pathH: any = new RectangleNode({
      width: size,
      height: pathWidth,
      fill: sandEdge,
      layer: "bg",
    } as any);
    pathH.x = 0;
    pathH.y = 0;
    this.add(pathH);

    const pathV: any = new RectangleNode({
      width: pathWidth,
      height: size,
      fill: sandEdge,
      layer: "bg",
    } as any);
    pathV.x = 0;
    pathV.y = 0;
    this.add(pathV);

    // 중앙 광장
    const plaza: any = new RectangleNode({
      width: plazaSize,
      height: plazaSize,
      fill: sandMain,
      layer: "bg",
    } as any);
    plaza.x = 0;
    plaza.y = 0;
    this.add(plaza);

    // 광장 테두리 느낌(살짝 더 진한 프레임)
    const plazaFrame: any = new RectangleNode({
      width: plazaSize + 22,
      height: plazaSize + 22,
      fill: sandEdge,
      layer: "bg",
    } as any);
    plazaFrame.x = 0;
    plazaFrame.y = 0;
    this.add(plazaFrame);
    // 프레임 위에 다시 광장(중앙이 밝게 보이도록)
    this.add(plaza);

    // -----------------------------
    // 4) Flowers (tiny color dots)
    // -----------------------------
    const flowerColors = [0xf7f07a, 0xffb3c7, 0xc7b3ff, 0xffffff, 0xffe08a];

    for (let i = 0; i < flowers; i++) {
      // 길/광장 근처는 덜 배치 (너무 지저분해지지 않게)
      let x = (rnd() * 2 - 1) * (half - 50);
      let y = (rnd() * 2 - 1) * (half - 50);

      // 중앙 주변 회피
      const avoid = Math.max(plazaSize, pathWidth) * 0.7;
      if (Math.abs(x) < avoid && Math.abs(y) < avoid) {
        x = (Math.sign(x) || 1) * (avoid + rnd() * (half - avoid));
        y = (Math.sign(y) || -1) * (avoid + rnd() * (half - avoid));
      }

      const s = 6 + rnd() * 10;

      const f: any = new RectangleNode({
        width: s,
        height: s,
        fill: pick(flowerColors, rnd()),
        layer: "bg",
      } as any);
      f.x = x;
      f.y = y;
      this.add(f);
    }

    // -----------------------------
    // 5) Rocks (small gray points)
    // -----------------------------
    const rockColors = [0x7a7a7a, 0x8b8b8b, 0x6a6a6a];

    for (let i = 0; i < rocks; i++) {
      let x = (rnd() * 2 - 1) * (half - 80);
      let y = (rnd() * 2 - 1) * (half - 80);

      // 길/광장 중앙 회피
      const avoid = Math.max(plazaSize, pathWidth) * 0.55;
      if (Math.abs(x) < avoid && Math.abs(y) < avoid) {
        x = (rnd() * 2 - 1) * (half - 80);
        y = (rnd() * 2 - 1) * (half - 80);
      }

      const w = 10 + rnd() * 26;
      const h = 10 + rnd() * 22;

      const r: any = new RectangleNode({
        width: w,
        height: h,
        fill: pick(rockColors, rnd()),
        layer: "bg",
      } as any);
      r.x = x;
      r.y = y;
      this.add(r);
    }

    // -----------------------------
    // 6) Bushes (world layer + ysort => 캐릭터 앞/뒤 느낌)
    // -----------------------------
    for (let i = 0; i < bushes; i++) {
      let x = (rnd() * 2 - 1) * (half - 160);
      let y = (rnd() * 2 - 1) * (half - 160);

      // 중앙 길/광장 부근은 피해서 배치
      const avoid = Math.max(plazaSize, pathWidth) * 0.8;
      if (Math.abs(x) < avoid && Math.abs(y) < avoid) {
        x = (rnd() * 2 - 1) * (half - 160);
        y = (rnd() * 2 - 1) * (half - 160);
      }

      const scale = 0.8 + rnd() * 1.35;
      this.add(this.makeBush(x, y, scale, rnd));
    }
  }

  private makeBush(x: number, y: number, scale: number, rnd: () => number) {
    const bush = new GameObject({ layer: "world", useYSort: true } as any);
    (bush as any).x = x;
    (bush as any).y = y;

    // 그림자(뒤쪽)
    const shadow: any = new RectangleNode({
      width: 46 * scale,
      height: 16 * scale,
      fill: 0x1f5b2a,
      layer: "world",
    } as any);
    shadow.x = 0;
    shadow.y = 8 * scale;
    bush.add(shadow);

    const greens = [0x2b7a35, 0x2f8f3a, 0x276d2e, 0x3a9a46];
    const main: any = new RectangleNode({
      width: 54 * scale,
      height: 34 * scale,
      fill: pick(greens, rnd()),
      layer: "world",
    } as any);
    main.x = 0;
    main.y = -6 * scale;
    bush.add(main);

    const top: any = new RectangleNode({
      width: 40 * scale,
      height: 22 * scale,
      fill: pick(greens, rnd()),
      layer: "world",
    } as any);
    top.x = 0;
    top.y = -18 * scale;
    bush.add(top);

    return bush;
  }
}
