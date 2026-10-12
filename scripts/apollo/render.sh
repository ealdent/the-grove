#!/usr/bin/env bash
set -euo pipefail

# Run from any directory. All generated intermediates stay outside the repository.
apollo_root="$(cd "$(dirname "$0")/../.." && pwd)"
apollo_work="$(mktemp -d /tmp/grove-apollo-render.XXXXXX)"
apollo_python="${APOLLO_PYTHON:-3.13}"
apollo_assets="$apollo_root/learn/apollo-assets"
export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/grove-apollo-uv-cache}"

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--audio-only" ) ]]; then
  echo "Usage: $0 [--audio-only]" >&2
  exit 1
fi
if [[ ! -f "$apollo_assets/apollo-narration.flac" ]]; then
  echo "Missing narration master; see scripts/apollo/README.md" >&2
  exit 1
fi

if [[ "${1:-}" == "--audio-only" ]]; then
  # Preserve the existing picture bit-for-bit when replacing its narration.
  ffmpeg -hide_banner -loglevel error -y -i "$apollo_assets/apollo-flight-plan.mp4" \
    -map 0:v:0 -c:v copy -an -t 55 -fs 15000000 "$apollo_work/picture.mp4"
else
uv venv --python "$apollo_python" "$apollo_work/venv"
uv pip install --python "$apollo_work/venv/bin/python" -r "$apollo_root/scripts/apollo/requirements.txt"
"$apollo_work/venv/bin/manimgx" render "$apollo_root/scripts/apollo/apollo_flight_plan.py" ApolloFlightPlan \
  -r 1600x900 --fps 30 -o "$apollo_work/master.mp4"

# Native ManimGX uses variable-duration still frames. Normalize the delivery file
# to constant 30 fps and preserve its final hold when remuxing for browser playback.
ffmpeg -hide_banner -loglevel error -y -i "$apollo_work/master.mp4" \
  -vf 'tpad=stop_mode=clone:stop_duration=2,fps=30' \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -t 55 -fs 15000000 \
  -movflags +faststart "$apollo_work/picture.mp4"
fi

# Bound both streams explicitly: AAC packet rounding must not trim the end card.
ffmpeg -hide_banner -loglevel error -y -i "$apollo_work/picture.mp4" \
  -i "$apollo_assets/apollo-narration.flac" -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 128k -ac 1 -metadata:s:a:0 language=eng \
  -t 55 -fs 15000000 -movflags +faststart "$apollo_work/narrated.mp4"
cp "$apollo_work/narrated.mp4" "$apollo_assets/apollo-flight-plan.mp4"
ffmpeg -hide_banner -loglevel error -y -ss 4.1 \
  -i "$apollo_assets/apollo-flight-plan.mp4" \
  -frames:v 1 -q:v 2 -fs 2000000 "$apollo_assets/apollo-flight-plan.jpg"
ffprobe -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,channels,sample_rate,duration \
  -of json "$apollo_assets/apollo-flight-plan.mp4"
