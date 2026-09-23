#!/bin/bash
A="$(cd "$(dirname "$0")" && pwd)"; cd "$A"
python3 - <<'PY'
import json, subprocess
cfg = json.load(open('models_cfg.json'))
import os
for name, c in cfg.items():
    glb = f'3d/{name}.glb'
    if not os.path.exists(glb): print('missing', name); continue
    r = subprocess.run(['python3', 'glb2nvm.py', glb, name, json.dumps(c), 'models', 'qc'], capture_output=True, text=True)
    print((r.stdout or r.stderr).strip()[-300:])
PY
