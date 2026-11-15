#!/usr/bin/env bash
# Builds public/images/cards/*.webp from the Codex-generated PNGs in assets_src/cards_v2/.
# Colour = unlocked; *_locked = desaturated, darkened, teal-tinted version of the same image.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets_src/cards_v2; OUT=public/images/cards
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
# Space Apps rule: SI-generated images must carry a visible watermark (top-left, small, semi-transparent)
mark(){ echo "drawtext=fontfile=$FONT:text=SI-generated:fontsize=$1:fontcolor=white@0.72:shadowcolor=black@0.6:shadowx=1:shadowy=1:x=$2:y=$2"; }
LOCK="hue=s=0.12,eq=brightness=-0.10:contrast=0.92:gamma=0.9,colorbalance=bs=0.06:bm=0.04:rs=-0.03"
for f in "$SRC"/mission_*.png; do n=$(basename "$f" .png)
  ffmpeg -loglevel error -y -i "$f" -vf "scale=1280:-2:flags=lanczos,$(mark 20 16)" -c:v libwebp -quality 85 "$OUT/$n.webp"
  ffmpeg -loglevel error -y -i "$f" -vf "scale=1280:-2:flags=lanczos,$LOCK,$(mark 20 16)" -c:v libwebp -quality 82 "$OUT/${n}_locked.webp"
done
for f in "$SRC"/collection_*.png; do n=$(basename "$f" .png)
  ffmpeg -loglevel error -y -i "$f" -vf "scale=768:768:flags=lanczos,$(mark 18 14)" -c:v libwebp -quality 85 "$OUT/$n.webp"
  ffmpeg -loglevel error -y -i "$f" -vf "scale=768:768:flags=lanczos,$LOCK,$(mark 18 14)" -c:v libwebp -quality 82 "$OUT/${n}_locked.webp"
done
# menu images (team-supplied, SI-generated): same visible mark
ffmpeg -loglevel error -y -i assets_src/overview_bg.png -vf "scale=3344:1882:flags=lanczos,unsharp=5:5:0.9:5:5:0.0,drawtext=fontfile=$FONT:text=SI-generated:fontsize=40:fontcolor=white@0.6:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-40" -c:v libwebp -quality 92 public/images/bg/overview.webp
ffmpeg -loglevel error -y -i assets_src/continue_cubesat.png -vf "scale=512:-2:flags=lanczos,$(mark 20 12)" -c:v libwebp -quality 90 public/images/bg/continue_cubesat.webp
node tools/public_index.mjs
