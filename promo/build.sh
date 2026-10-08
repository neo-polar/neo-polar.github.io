#!/usr/bin/env bash
# Builds the Polar promotion film end to end:
#   score (music.py) → frames (render.cjs) → promo/dist/polar-promo-1080p60.mp4
# Requirements: python3 + numpy, node + playwright (chromium), ffmpeg with libx264.
set -euo pipefail
cd "$(dirname "$0")"

FPS="${FPS:-60}"
WORKERS="${WORKERS:-4}"
mkdir -p build dist

python3 music.py build/score.wav
ffmpeg -hide_banner -loglevel error -y -i build/score.wav -c:a aac -b:a 192k assets/score.m4a

if [[ "${SKIP_FRAMES:-0}" != "1" ]]; then
  node render.cjs video --fps "$FPS" --workers "$WORKERS"
fi

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i build/frames.txt -i build/score.wav \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -tune film \
  -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  dist/polar-promo-1080p60.mp4

echo "dist/polar-promo-1080p60.mp4"
