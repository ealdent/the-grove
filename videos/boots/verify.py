#!/usr/bin/env python3
"""Check a rendered file: do the picture cuts land where edit.js says, and is the recitation where the cuts expect it?
    tmp/.venv-whisper/bin/python verify.py MEDIA OUT.mp4 SOURCE.wav
1. scene-change times from the video vs MEDIA/shots.json;  2. lag between the file's audio and the source voice."""
import json, re, subprocess, sys
import numpy as np
from scipy import signal
media, mp4, src = sys.argv[1], sys.argv[2], sys.argv[3]
meta = json.load(open(f'{media}/shots.json')); T0 = meta['T0']
shots = np.array([s['t'] for s in meta['shots']])
err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mp4, '-vf', "select='gt(scene,0.12)',showinfo", '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
cuts = np.array([float(m) for m in re.findall(r'pts_time:([0-9.]+)', err)])
near = np.array([np.min(np.abs(shots - c)) for c in cuts])
found = np.array([np.min(np.abs(cuts - s)) if len(cuts) else 9 for s in shots[1:]])
print(f'{len(cuts)} detected cuts; {np.mean(near < 0.035) * 100:.0f}% within one frame of a planned cut; '
      f'{np.mean(found < 0.035) * 100:.0f}% of {len(shots) - 1} planned cuts detected')
def audio(path, ss, t):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ss), '-t', str(t), '-i', path, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
band = signal.butter(4, [400, 3000], btype='band', fs=8000, output='sos')
for a in (5, 60, 120):
    x = signal.sosfilt(band, audio(mp4, a, 12)); y = signal.sosfilt(band, audio(src, T0 + a, 12))
    n = min(len(x), len(y)); c = signal.correlate(x[:n], y[:n], mode='full'); lag = (np.argmax(np.abs(c)) - (n - 1)) / 8000
    print(f'voice lag at {a:>3} s: {lag * 1000:+.1f} ms')
d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate', '-of', 'default=nw=1', mp4], capture_output=True, text=True).stdout
print(' '.join(d.split()))
l = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mp4, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('loudness:', ' '.join(x.strip() for x in l.splitlines()[-14:] if any(k in x for k in ('I:', 'LRA:', 'Peak:'))))
