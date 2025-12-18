import { GameObject, RectangleNode } from "kiwiengine";

// 큰 평원(원점 중심) + 랜덤 패치들로 잔디 느낌
export class GrassField extends GameObject {
  constructor(opts?: { size?: number; patches?: number }) {
    super({ layer: "bg" });

    const size = opts?.size ?? 8000;
    const half = size / 2;

    // 바탕 잔디
    const base = new RectangleNode({
      width: size,
      height: size,
      fill: 0x2e7d32, // 잔디 초록
      layer: "bg",
    });
    this.add(base);

    // 잔디 패치(조금 밝고 어두운 것 섞기)
    const patches = opts?.patches ?? 140;
    const colors = [0x2f8f3a, 0x2a7b33, 0x338a3e, 0x276d2e];

    // 간단한 시드 랜덤(매번 동일하게 보이게)
    let seed = 123456789;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 10000) / 10000;
    };

    for (let i = 0; i < patches; i++) {
      const w = 120 + rnd() * 520;
      const h = 120 + rnd() * 520;
      const x = (rnd() * 2 - 1) * (half - w);
      const y = (rnd() * 2 - 1) * (half - h);
      const fill = colors[(i + Math.floor(rnd() * 10)) % colors.length];

      const patch = new RectangleNode({
        width: w,
        height: h,
        fill,
        layer: "bg",
      });

      // 대부분의 노드는 x/y를 갖고 있습니다.
      patch.x = x;
      patch.y = y;

      this.add(patch);
    }
  }
}
