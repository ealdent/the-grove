#!/usr/bin/env python3
"""Build the soundtrack: the 1915 recitation up front, a score bed underneath, and marching hits locked to the cut list.

    tmp/.venv-whisper/bin/python mix.py MEDIA_DIR SOURCE.wav SCORE.mp3

Reads MEDIA/shots.json (export_shots.mjs) and writes MEDIA/audio/mix.wav (48 kHz stereo, about -14 LUFS).
Layers: voice (mono sum of the lateral-cut disc transfer) | score with its two silent gaps spliced out and the fader
ridden so the build only climbs | a synthesised D pedal so the bed never drops out | boot stomps on every spoken hit,
lighter steps on the in-between cuts, off-beat steps that double up as the film accelerates | risers into the booms.
"""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
media, src, score_path = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
meta = json.loads((media / 'shots.json').read_text())
T0, END, shots = meta['T0'], meta['END'], meta['shots']
N = int(END * SR)
rng = np.random.default_rng(1915)
DAWN = next(s['t'] for s in shots if s['colour'])            # first colour shot = the turn to major


def decode(path, ss=None, ch=2):
    cmd = ['ffmpeg', '-v', 'error', '-y'] + (['-ss', str(ss)] if ss else []) + ['-i', str(path), '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def db(x): return 20 * np.log10(np.sqrt(np.mean(np.square(x)) + 1e-12))
def gain(d): return 10 ** (d / 20)
def sos(kind, f, order=2): return signal.butter(order, f, btype=kind, fs=SR, output='sos')
def env(n, tau): return np.exp(-np.arange(n) / (tau * SR))


def place(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    a = max(0, -i); i = max(0, i)
    n = min(len(x) - a, len(buf) - i)
    buf[i:i + n] += x[a:a + n] * g


# ---------- voice ----------
v = decode(src, ss=T0).mean(axis=1)                          # lateral cut: L+R keeps the groove, cancels vertical noise
v = signal.sosfilt(sos('highpass', 95), v)
v = signal.sosfilt(sos('lowpass', 6200, 4), v)
tail = v[-int(1.6 * SR):].copy()                             # run-out groove crackle, looped under the end card
voice = np.zeros(N, np.float32)
voice[:min(N, len(v))] = v[:N]
k = len(v)
while k < N:
    seg = tail[::-1] if (k // len(tail)) % 2 else tail       # ping-pong so the loop has no click
    n = min(len(seg), N - k)
    voice[k:k + n] = seg[:n]; k += n
# gentle levelling: 3:1 above the slow RMS, so the shouted last stanza does not bury everything
w = int(0.25 * SR)
rms = np.sqrt(signal.fftconvolve(voice ** 2, np.ones(w) / w, mode='same') + 1e-9)
ref = np.percentile(rms[rms > 1e-4], 60)
voice *= np.clip((rms / ref) ** (-0.55), 0.35, 2.2)
voice *= gain(-17 - db(voice))

# ---------- score: splice out the silent gaps, land the major chord on DAWN, ride the fader ----------
sc = decode(score_path)
mono = sc.mean(axis=1)
hop = int(0.05 * SR)
lvl = np.array([db(mono[i:i + hop]) for i in range(0, len(mono) - hop, hop)])
quiet = lvl < -50
gaps = []                                                    # (start_s, end_s) of silences longer than 1 s, away from the ends
i = 0
while i < len(quiet):
    if quiet[i]:
        j = i
        while j < len(quiet) and quiet[j]:
            j += 1
        if (j - i) * 0.05 > 1.0 and i * 0.05 > 3 and j * 0.05 < len(mono) / SR - 4:
            gaps.append((i * 0.05, j * 0.05))
        i = j
    else:
        i += 1
print('score gaps', [(round(a, 2), round(b, 2)) for a, b in gaps])
head = np.argmax(np.abs(mono) > gain(-45)) / SR
turn = gaps[-1][1]                                           # the major entrance follows the last gap
parts, cursor = [], head
for a, b in gaps[:-1]:                                       # earlier gaps: cut the silence, overlap-add the re-entry onto the decay
    parts.append(sc[int(cursor * SR):int(a * SR)])
    cursor = b - 0.15
parts.append(sc[int(cursor * SR):])
xf = int(0.5 * SR)
out = parts[0]
for p in parts[1:]:
    ramp = np.linspace(0, 1, xf)[:, None]
    out = np.concatenate([out[:-xf], out[-xf:] * (1 - ramp) + p[:xf] * ramp, p[xf:]])
removed = sum(b - 0.15 - a for a, b in gaps[:-1]) + head - 0.5 * (len(parts) - 1)
turn_out = turn - removed                                    # where the major entrance sits in the spliced score
shift = DAWN - turn_out + 0.04                               # video time = spliced time + shift
print(f'major entrance at {turn_out:.2f} s in the spliced score; film DAWN {DAWN:.2f}; shift {shift:+.2f} s')
score = np.zeros((N, 2), np.float32)
a = int(round(shift * SR))
s0, d0 = max(0, -a), max(0, a)
n = min(len(out) - s0, N - d0)
score[d0:d0 + n] = out[s0:s0 + n]
# extend the final chord: a long synthetic reverb tail under the end card
last = score[d0 + n - int(4.0 * SR):d0 + n]
ir = (rng.standard_normal((int(5.0 * SR), 2)) * env(int(5.0 * SR), 1.4)[:, None]).astype(np.float32)
wet = np.stack([signal.fftconvolve(last[:, c], ir[:, c]) for c in range(2)], axis=1)
wet *= gain(db(last) - db(wet[:len(last)]) - 5)
for c in range(2):
    place(score[:, c], wet[:, c].astype(np.float32), (d0 + n) / SR - 4.0)
# ride: 1 s RMS toward a straight dB line that only climbs, then steps up at DAWN
w = SR
r = np.sqrt(signal.fftconvolve(score.mean(axis=1) ** 2, np.ones(w) / w, mode='same') + 1e-10)
t = np.arange(N) / SR
target = np.where(t < DAWN, -33 + 8.0 * np.clip(t / DAWN, 0, 1), -20.0)
g = np.clip(target - 20 * np.log10(r), -8, 14)
g = signal.fftconvolve(g, np.hanning(2 * SR) / np.hanning(2 * SR).sum(), mode='same')
g[t > END - 6.5] = np.minimum(g[t > END - 6.5], g[int((END - 6.5) * SR)])      # let the last chord decay naturally
score *= gain(g)[:, None]

# ---------- pedal drone: never lets the bed fall silent ----------
def pedal():
    ph = lambda f: np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.11 * t))
    low = 0.9 * ph(36.71) + 0.6 * ph(73.42) + 0.22 * ph(110.0)
    minor = 0.10 * ph(174.61) + 0.08 * ph(220.0)
    major = 0.16 * ph(185.0) + 0.14 * ph(220.0) + 0.10 * ph(293.66) + 0.07 * ph(369.99)
    dawn = np.clip((t - DAWN) / 0.15, 0, 1)
    x = np.tanh(1.4 * (low + minor * (1 - dawn) + major * dawn))
    level = np.where(t < DAWN, -30 + 8 * np.clip(t / DAWN, 0, 1), -24.0)
    x *= gain(level) * (1 + 0.12 * np.sin(2 * np.pi * 0.23 * t))
    x *= np.clip((END - t) / 3.0, 0, 1) ** 1.5
    return x.astype(np.float32)
drone = pedal()

# ---------- hits ----------
def thump(f0=118, f1=41, dur=0.34, tau=0.085):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.028)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, tau)
    x[:48] *= np.linspace(0, 1, 48)
    return np.tanh(2.2 * x)

def crunch(dur=0.13, lo=650, hi=5200, tau=0.03):
    n = int(dur * SR)
    x = rng.standard_normal(n) * (rng.random(n) > 0.55)          # grainy, like gravel
    x = signal.sosfilt(sos('bandpass', [lo, hi]), x) * env(n, tau)
    return x / (np.abs(x).max() + 1e-9)

def stomp(weight=1.0):
    a, b = thump(), crunch()
    x = np.zeros(max(len(a), len(b) + 300)); x[:len(a)] += a; x[240:240 + len(b)] += 0.55 * b * weight
    return x

def step(bright=1.0):
    b = crunch(0.07, 1400, 7000, 0.014)
    n = len(b); tt = np.arange(n) / SR
    return 0.8 * b * bright + 0.35 * np.sin(2 * np.pi * 190 * tt) * env(n, 0.02)

def boom(dur=3.6, warm=False):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * (34 + 14 * np.exp(-tt / 0.05)) * tt) * env(n, 0.95) + 0.5 * np.sin(2 * np.pi * 55 * tt) * env(n, 0.6)
    noise = signal.sosfilt(sos('lowpass', 180 if not warm else 120, 4), rng.standard_normal(n)) * env(n, 0.5) * 6
    crack = signal.sosfilt(sos('bandpass', [300, 3000]), rng.standard_normal(n)) * env(n, 0.05) * (0.0 if warm else 0.9)
    return np.tanh(1.6 * (x + noise + crack))

def riser(dur=2.3):
    n = int(dur * SR); tt = np.arange(n) / SR; u = tt / dur
    x = np.zeros(n)
    for k, (lo, hi) in enumerate([(180, 700), (700, 2400), (2400, 6000), (6000, 12000)]):
        band = signal.sosfilt(sos('bandpass', [lo, hi]), rng.standard_normal(n))
        x += band / (band.std() + 1e-9) * np.clip((u - 0.16 * k) / (1 - 0.16 * k), 0, 1) ** 2.2
    x += 0.5 * np.sin(2 * np.pi * np.cumsum(90 * 2 ** (2.2 * u)) / SR) * u ** 2
    x *= u ** 1.6
    x[-96:] *= np.linspace(1, 0, 96)
    return x / np.abs(x).max()

perc = np.zeros(N, np.float32)
low = np.zeros(N, np.float32)
hits = [s for s in shots if s['hit'] == 1]
for s in shots:
    tv = s['t']
    prog = min(1.0, tv / DAWN)
    if s['colour']:                                              # the last stanza marches softer and rounder
        if s['hit'] == 1:
            place(perc, thump(96, 46, 0.4, 0.11).astype(np.float32), tv - 0.012, 0.42)
        continue
    if s['hit'] == 1:
        place(perc, stomp(0.7 + 0.5 * prog).astype(np.float32), tv - 0.012, 0.36 + 0.16 * prog)
    elif s['hit'] >= 0.3:
        place(perc, step(0.8 + 0.4 * prog).astype(np.float32), tv - 0.006, (0.13 + 0.12 * prog) * min(1.0, s['hit'] + 0.3))
for a, b in zip(hits, hits[1:]):                                 # off-beat steps: the march doubles, then doubles again
    gap = b['t'] - a['t']
    if not 0.55 < gap < 1.3 or a['colour']:
        continue
    prog = a['t'] / DAWN
    if prog > 0.30:
        place(perc, step(0.7).astype(np.float32), a['t'] + gap / 2, 0.09 + 0.10 * prog)
    if prog > 0.58:
        for f in (0.25, 0.75):
            place(perc, step(0.5).astype(np.float32), a['t'] + gap * f, 0.04 + 0.08 * prog)
    if prog > 0.86:
        for f in (0.125, 0.375, 0.625, 0.875):
            place(perc, step(0.4).astype(np.float32), a['t'] + gap * f, 0.05)
fx = np.zeros(N, np.float32)
for s in shots:
    if not s.get('boom'):
        continue
    warm = s['boom'] == 2
    place(low, boom(4.2 if warm else 3.6, warm).astype(np.float32), s['t'] - 0.01, 0.5 if warm else 0.62)
    place(fx, riser(2.4).astype(np.float32), s['t'] - 2.4, 0.11 if warm else 0.16)

# ---------- sum, glue, loudness ----------
# the voice leads: wherever the bed (score + hits + drone) comes within MARGIN dB of it over a 3 s window, pull the bed down
MARGIN = 7.0
w3 = 3 * SR
pw = lambda x: signal.fftconvolve(x.astype(np.float64) ** 2, np.ones(w3) / w3, mode='same') + 1e-10
bed_db = 10 * np.log10(pw(perc + low + drone) + pw(score.mean(axis=1)))
voice_db = 10 * np.log10(pw(voice))
duck = np.clip(voice_db - MARGIN - bed_db, -9, 0)
duck[t > shots[-1]['t'] - 0.5] = 0                           # the end card belongs to the score
duck = signal.fftconvolve(duck, np.hanning(SR) / np.hanning(SR).sum(), mode='same')
dg = gain(duck).astype(np.float32)
perc *= dg; low *= dg; drone *= dg; score *= dg[:, None]
edges = [0, 21.6, 40.1, 58.7, 77.2, 95.7, 113.6, DAWN, END]
print('voice-minus-bed dB per stanza:', ' '.join(f"{db(voice[int(a * SR):int(b * SR)]) - db((perc + low + drone + score.mean(axis=1))[int(a * SR):int(b * SR)]):.1f}" for a, b in zip(edges, edges[1:])))
mid = voice + perc + low + drone
mix = np.stack([mid, mid], axis=1) + score
fxs = np.stack([fx, np.roll(fx, 211)], axis=1)                   # a little width on the risers
mix += fxs
mix = np.tanh(mix * 1.15) / 1.15
mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))[:, None]
tmp = media / 'audio' / 'mix_raw.wav'
wavfile.write(tmp, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(tmp), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float([l for l in m.splitlines() if l.strip().startswith('I:')][-1].split()[1])
g = gain(-14.0 - I)
final = np.tanh(mix * g * 0.98) if g > 1 else mix * g
final = final / max(1.0, np.abs(final).max() / gain(-1.0))
wavfile.write(media / 'audio' / 'mix.wav', SR, (final * 32767).astype(np.int16))
print(f'layers dB: voice {db(voice):.1f} score {db(score):.1f} drone {db(drone):.1f} perc {db(perc):.1f} low {db(low):.1f}; integrated {I:.1f} LUFS -> gain {20 * np.log10(g):+.1f} dB; {N / SR:.2f} s')
