#!/usr/bin/env bash
set -euo pipefail

# Run from any directory. All generated intermediates stay outside the repository.
apollo_root="$(cd "$(dirname "$0")/../.." && pwd)"
apollo_work="$(mktemp -d /tmp/grove-apollo-render.XXXXXX)"
apollo_python="${APOLLO_PYTHON:-3.13}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/grove-apollo-uv-cache}"

uv venv --python "$apollo_python" "$apollo_work/venv"
uv pip install --python "$apollo_work/venv/bin/python" -r "$apollo_root/scripts/apollo/requirements.txt"
"$apollo_work/venv/bin/manimgx" render "$apollo_root/scripts/apollo/apollo_flight_plan.py" ApolloFlightPlan \
  -r 1600x900 --fps 30 -o "$apollo_work/master.mp4"

# Native ManimGX uses variable-duration still frames. Normalize the delivery file
# to constant 30 fps and preserve its final hold when remuxing for browser playback.
ffmpeg -hide_banner -loglevel error -y -i "$apollo_work/master.mp4" \
  -vf 'tpad=stop_mode=clone:stop_duration=2,fps=30' \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -t 55 -fs 15000000 \
  -movflags +faststart "$apollo_root/learn/apollo-assets/apollo-flight-plan.mp4"
ffmpeg -hide_banner -loglevel error -y -ss 4.1 \
  -i "$apollo_root/learn/apollo-assets/apollo-flight-plan.mp4" \
  -frames:v 1 -q:v 2 -fs 2000000 "$apollo_root/learn/apollo-assets/apollo-flight-plan.jpg"
ffprobe -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt \
  -of json "$apollo_root/learn/apollo-assets/apollo-flight-plan.mp4"
