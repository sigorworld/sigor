#!/usr/bin/env bash
set -e

# 출력 파일 이름 (기본: spritesheet.png)
OUTFILE="${1:-spritesheet.png}"

# PNG 파일 목록 (이미 만든 스프라이트는 제외)
shopt -s nullglob
files=()
for f in *.png *.PNG; do
  [[ "$f" == "$OUTFILE" ]] && continue
  files+=("$f")
done

count=${#files[@]}

if (( count == 0 )); then
  echo "PNG 파일이 없습니다."
  exit 1
fi

echo "이미지 개수: $count"

# n = ceil(sqrt(count))
n=$(echo "scale=0; sqrt($count)" | bc)
if (( n * n < count )); then
  n=$((n+1))
fi

total=$((n * n))
missing=$((total - count))

echo "그리드: ${n}x${n} (총 $total 칸, 패딩 $missing 개)"

pads=()

# 부족한 칸은 투명 1x1 PNG로 채움
if (( missing > 0 )); then
  for ((i=1; i<=missing; i++)); do
    pad="__pad_$i.png"
    magick -size 1x1 xc:none "$pad"
    pads+=("$pad")
  done
fi

# 투명 배경 스프라이트 생성
magick montage \
  "${files[@]}" "${pads[@]}" \
  -tile "${n}x${n}" \
  -geometry +0+0 \
  -background none -alpha on \
  "$OUTFILE"

# 패딩 삭제
if (( ${#pads[@]} > 0 )); then
  rm -- "${pads[@]}"
fi

echo "완료: $OUTFILE (투명 배경)"
