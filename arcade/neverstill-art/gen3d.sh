#!/bin/bash
# usage: gen3d.sh <name> <polycount>
A="$(cd "$(dirname "$0")" && pwd)"; N=$1; PC=$2
[ -s "$A/3d/$N.glb" ] && { echo "skip $N"; exit 0; }
OUT=$(higgsfield generate create image_to_3d --image "$A/raw/c_$N.png" --should_texture true --should_remesh true --topology triangle \
  --target_polycount $PC --symmetry_mode auto --enable_animation false --enable_rigging false --enable_pbr false --json 2>&1)
ID=$(echo "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); d=d[0] if isinstance(d,list) else d; print(d if isinstance(d,str) else d.get('id',''))" 2>/dev/null)
[ -z "$ID" ] && { echo "SUBMIT FAIL $N: $OUT" | head -3; exit 1; }
echo "$ID" > "$A/3d/$N.id"
for i in $(seq 1 180); do
  sleep 20
  R=$(higgsfield generate get "$ID" --json 2>/dev/null)
  ST=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); d=d[0] if isinstance(d,list) else d; print(d.get('status',''), d.get('result_url') or '')" 2>/dev/null)
  case "$ST" in
    completed*) URL=${ST#completed }; curl -sSL -o "$A/3d/$N.glb" "$URL" && echo "ok $N $(( i * 20 ))s"; exit 0;;
    failed*|canceled*|nsfw*) echo "FAILED $N: $ST"; exit 1;;
  esac
done
echo "TIMEOUT $N"
