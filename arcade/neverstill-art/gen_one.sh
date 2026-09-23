#!/bin/bash
# usage: gen_one.sh <index>   (reads jobs.json next to this script)
A="$(cd "$(dirname "$0")" && pwd)"
J=$(python3 -c "import json,sys; j=json.load(open('$A/jobs.json'))[int(sys.argv[1])]; print(json.dumps(j))" "$1")
ID=$(echo "$J" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
[ -s "$A/raw/$ID.png" ] && { echo "skip $ID"; exit 0; }
ARGS=$(echo "$J" | python3 -c "
import json,sys,shlex; j=json.load(sys.stdin)
a=['higgsfield','generate','create',j['model'],'--aspect_ratio',j['ar'],'--prompt',j['prompt']]
if j['model']=='gpt_image_2_5': a+=['--quality',j.get('quality','high'),'--resolution',j.get('res','1k')]
else: a+=['--resolution','1k']
if j['id']=='c_rider': a+=['--image','$A/keyart_ref.png']
a+=['--wait','--json','--wait-timeout','15m']
print(' '.join(shlex.quote(x) for x in a))")
eval "$ARGS" > "$A/raw/$ID.json" 2> "$A/raw/$ID.err"
URL=$(python3 -c "import json; d=json.load(open('$A/raw/$ID.json')); d=d[0] if isinstance(d,list) else d; print(d.get('result_url') or '')" 2>/dev/null)
if [ -n "$URL" ]; then curl -sSL -o "$A/raw/$ID.png" "$URL" && echo "ok $ID"; else echo "FAIL $ID"; fi
