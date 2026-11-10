#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=320x568:rate=24" \
  -f lavfi -i "sine=frequency=880:sample_rate=48000" \
  -t 2.5 -shortest -c:v libx264 -pix_fmt yuv420p -preset ultrafast \
  -c:a aac -b:a 96k -movflags +faststart "$OUT/valid.mp4"

ffmpeg -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=320x568:rate=24" \
  -f lavfi -i "sine=frequency=660:sample_rate=48000" \
  -t 2.5 -shortest -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 250k \
  -c:a libopus -b:a 64k "$OUT/valid.webm"

node "$ROOT/validate-media.mjs" "$OUT/valid.mp4" --container mp4 --require-audio
node "$ROOT/validate-media.mjs" "$OUT/valid.webm" --container webm --require-audio

# Negative test: a text file with an MP4 extension must never pass as a media output.
printf 'not a video container' > "$OUT/invalid.mp4"
if node "$ROOT/validate-media.mjs" "$OUT/invalid.mp4" --container mp4 --require-audio; then
  echo 'Invalid fixture was incorrectly accepted' >&2
  exit 1
fi

# Negative test: a file with materially different audio and video durations must be rejected.
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=320x568:rate=24:duration=2" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 96k \
  "$OUT/mismatched-av.mp4"
if node "$ROOT/validate-media.mjs" "$OUT/mismatched-av.mp4" --container mp4 --require-audio; then
  echo 'Audio/video duration mismatch was incorrectly accepted' >&2
  exit 1
fi

# Negative test: a valid video-only MP4 must fail when the product requires narration/audio.
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=320x568:rate=24" -t 2 \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast "$OUT/silent.mp4"
if node "$ROOT/validate-media.mjs" "$OUT/silent.mp4" --container mp4 --require-audio; then
  echo 'Silent fixture was incorrectly accepted despite required audio' >&2
  exit 1
fi

node "$ROOT/workflow-guard.test.cjs"

echo 'LUNA media-integrity fixtures: all positive and negative cases passed.'
