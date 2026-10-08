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

# Two-pass H.264 at ~7 Mbps keeps the file under 50 MB with no visible loss
# (SSIM 0.98 against CRF 17); colours are tagged BT.709 for correct playback.
VIDEO=(-vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
  -c:v libx264 -preset slow -profile:v high -tune film -b:v 7200k -maxrate 14M -bufsize 20M
  -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709"
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i build/frames.txt \
  "${VIDEO[@]}" -pass 1 -passlogfile build/x264 -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i build/frames.txt -i build/score.wav \
  -map 0:v -map 1:a "${VIDEO[@]}" -pass 2 -passlogfile build/x264 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  dist/polar-promo-1080p60.mp4

echo "dist/polar-promo-1080p60.mp4"
