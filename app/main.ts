// canvas 생성
const canvas = document.createElement("canvas");
canvas.width = 512;
canvas.height = 512;
document.body.appendChild(canvas);

// context 가져오기
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas context를 가져올 수 없습니다.");
}

// 이미지 로드
const img = new Image();
img.src =
  "https://sigorworld.github.io/static-sigor-assets/characters/babyping/cococalf/spritesheet.png";

img.onload = () => {
  // 전체 이미지 그대로 그리기
  ctx.drawImage(img, 0, 0);
};
