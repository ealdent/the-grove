#!/bin/bash
A="$(cd "$(dirname "$0")" && pwd)"; N=$1; ID=$2
[ -s "$A/3d/$N.glb" ] && { echo "skip $N"; exit 0; }
for i in $(seq 1 200); do
  R=$(higgsfield generate get "$ID" --json 2>/dev/null)
  ST=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); d=d[0] if isinstance(d,list) else d; print(d.get('status',''), d.get('result_url') or '')" 2>/dev/null)
  case "$ST" in
    completed*) URL=${ST#completed }; curl -sSL -o "$A/3d/$N.glb" "$URL" && echo "ok $N"; exit 0;;
    failed*|canceled*|nsfw*) echo "FAILED $N: $ST"; exit 1;;
  esac
  sleep 20
done
echo "TIMEOUT $N"
