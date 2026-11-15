#!/usr/bin/env bash
# Builds public/images/cards/*.webp from the Codex-generated PNGs in assets_src/cards_v2/.
# Colour = unlocked; *_locked = desaturated, darkened, teal-tinted version of the same image.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets_src/cards_v2; OUT=public/images/cards
LOCK="hue=s=0.12,eq=brightness=-0.10:contrast=0.92:gamma=0.9,colorbalance=bs=0.06:bm=0.04:rs=-0.03"
for f in "$SRC"/mission_*.png; do n=$(basename "$f" .png)
  ffmpeg -loglevel error -y -i "$f" -vf "scale=1280:-2:flags=lanczos" -c:v libwebp -quality 85 "$OUT/$n.webp"
  ffmpeg -loglevel error -y -i "$f" -vf "scale=1280:-2:flags=lanczos,$LOCK" -c:v libwebp -quality 82 "$OUT/${n}_locked.webp"
done
for f in "$SRC"/collection_*.png; do n=$(basename "$f" .png)
  ffmpeg -loglevel error -y -i "$f" -vf "scale=768:768:flags=lanczos" -c:v libwebp -quality 85 "$OUT/$n.webp"
  ffmpeg -loglevel error -y -i "$f" -vf "scale=768:768:flags=lanczos,$LOCK" -c:v libwebp -quality 82 "$OUT/${n}_locked.webp"
done
node tools/public_index.mjs
