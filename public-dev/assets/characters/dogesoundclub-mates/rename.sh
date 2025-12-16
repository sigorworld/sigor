for f in Mates_*.png; do
  num=${f#Mates_}      # Mates_ 제거 → 10007.png
  num=${num%.png}      # .png 제거 → 10007
  new=$((num - 10000)) # 10000 빼기
  mv "$f" "$new.png"
done
