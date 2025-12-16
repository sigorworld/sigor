for f in ayias_pixel-*.png; do
  mv "$f" "${f#ayias_pixel-}"
done