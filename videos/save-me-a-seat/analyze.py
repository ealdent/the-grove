#!/usr/bin/env python3
"""Timing data for the hand-drawn video: data.js (window.DATA). It comes from the unreleased song, so git ignores it.

    python3 analyze.py

From the song as it plays in the video (tmp/save-me-a-seat/song/mix_vm.wav: the answering-machine message over the intro, no ring),
the beat grid, the lyric timeline and the message's own word times. Envelopes are per output frame (24 fps).
"""
import json
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent / 'tmp' / 'save-me-a-seat'     # the song, voicemail and analysis: unreleased, outside git
FPS, SR = 24, 24000


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def envelope(a, n):
    hop = SR // FPS
    out = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    return np.round(out / (np.percentile(out, 99) + 1e-9), 3).clip(0, 1.5)


song = load(ROOT / 'song/mix_vm.wav')
dur = len(song) / SR
n = int(dur * FPS)
take = 'mabletoo-A1'
vm = load(ROOT / f'voicemail/v3/out/vm3-{take}.wav')
meta = json.loads((ROOT / f'voicemail/v3/out/vm3-{take}.json').read_text())
beats = json.loads((ROOT / 'analysis/out/beats.json').read_text())
lines = json.loads((ROOT / 'analysis/out/lyrics_timeline.json').read_text())['lines']
data = {
    'fps': FPS, 'dur': round(dur, 3), 'frames': n,
    'beats': [round(b, 4) for b in beats['beats']], 'downbeat_phase': beats['downbeat_phase'],
    'rms': envelope(song, n).tolist(),
    'vm': {'env': envelope(vm, int(len(vm) / SR * FPS)).tolist(), 'play': meta['play'], 'hang': meta['hang'],
           'stop': meta['stop'], 'words': meta['words']},
    'lines': [{'t': l['start'], 'end': l['end'], 'section': l['section']} for l in lines],
}
(HERE / 'data.js').write_text('window.DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print(f'wrote data.js: {n} frames, {len(data["beats"])} beats, {len(lines)} lines, message {len(data["vm"]["env"])} frames')
