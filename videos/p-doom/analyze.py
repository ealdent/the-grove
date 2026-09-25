#!/usr/bin/env python3
"""Analyse the song for the P(DOOM) C90 video. Needs only numpy and Pillow.

    python3 analyze.py <song.mp4|wav>

Writes, under analysis/:
  pcm.f32        48 kHz stereo float32, decoded by ffmpeg (gitignored)
  features.js    window.FEAT: per-video-frame loudness, bands and spectrum,
                 plus a 12 kHz int8 copy of the waveform for the oscilloscope
  summary.json   tempo, beat grid, downbeats, per-bar energy and novelty
  profile.png    energy/novelty strip with bar numbers, for choosing sections

The beat grid is one straight line (period and phase) searched against the
onset envelope. The song is machine-made and holds its tempo, and per-beat
tracking drifted half a beat onto the off-beats, so the fit is global.
"""
from __future__ import annotations

import base64
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'analysis'
SR, FPS = 48000, 60
HOP = 256            # onset/beat analysis hop (5.3 ms)
NFFT = 2048
VHOP = SR // FPS     # 800 samples per video frame
SCOPE_SR = 12000


def decode(src: Path) -> np.ndarray:
    pcm = OUT / 'pcm.f32'
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(src), '-vn', '-ac', '2', '-ar', str(SR),
                    '-f', 'f32le', '-t', '600', '-fs', '400M', str(pcm)], check=True)
    return np.fromfile(pcm, dtype='<f4').reshape(-1, 2)


def stft_mag(x: np.ndarray, hop: int, nfft: int = NFFT) -> np.ndarray:
    pad = np.concatenate([np.zeros(nfft // 2), x, np.zeros(nfft // 2)])
    n = 1 + (len(pad) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(n)[:, None]
    win = np.hanning(nfft).astype(np.float32)
    frames = []
    for k in range(0, n, 4096):  # chunk to bound memory
        frames.append(np.abs(np.fft.rfft(pad[idx[k:k + 4096]] * win, axis=1)).astype(np.float32))
    return np.concatenate(frames)


def mel_bank(n_mels: int, fmin: float, fmax: float, nfft: int = NFFT) -> np.ndarray:
    hz2mel = lambda f: 2595 * np.log10(1 + f / 700)
    mel2hz = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = mel2hz(np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2))
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    bank = np.zeros((n_mels, len(freqs)), np.float32)
    for m in range(n_mels):
        lo, c, hi = pts[m], pts[m + 1], pts[m + 2]
        bank[m] = np.clip(np.minimum((freqs - lo) / (c - lo), (hi - freqs) / (hi - c)), 0, None)
    return bank


def onset_envelope(logmel: np.ndarray) -> np.ndarray:
    flux = np.maximum(0, np.diff(logmel, axis=0, prepend=logmel[:1])).mean(axis=1)
    k = int(0.4 * SR / HOP)
    local = np.convolve(flux, np.ones(k) / k, mode='same')
    env = np.maximum(0, flux - local)
    return env / (env.std() + 1e-9)


def tempo(env: np.ndarray) -> float:
    fr = SR / HOP
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(len(ac))
    bpm = np.where(lags > 0, 60 * fr / np.maximum(lags, 1), 0)
    ok = (bpm >= 70) & (bpm <= 190)
    prior = np.exp(-0.5 * (np.log2(np.maximum(bpm, 1) / 120) / 0.9) ** 2)
    score = np.where(ok, ac * prior, 0)
    lag = int(np.argmax(score))
    # Parabolic refinement of the peak.
    a, b, c = score[lag - 1], score[lag], score[lag + 1]
    lag_f = lag + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    return 60 * fr / lag_f


def fit_grid(env: np.ndarray, bpm0: float, dur: float) -> tuple[float, float]:
    """Best straight beat grid (period, first beat) near bpm0, scored on a lightly smoothed envelope."""
    fr = SR / HOP
    k = np.exp(-0.5 * (np.arange(-6, 7) / 2.0) ** 2)
    e = np.convolve(env, k / k.sum(), mode='same')

    def score(p, ph):
        ts = ph + p * np.arange(int(dur / p) + 1)
        return e[np.clip((ts * fr).round().astype(int), 0, len(e) - 1)].mean()

    best = (-1.0, 0.0, 0.0)
    for bpm in np.arange(bpm0 * 0.985, bpm0 * 1.015, 0.01):
        p = 60 / bpm
        for ph in np.arange(0, p, 0.002):
            s = score(p, ph)
            if s > best[0]:
                best = (s, p, ph)
    _, p, ph = best
    for ph2 in np.arange(ph - 0.002, ph + 0.002, 0.0002):  # final phase polish
        if score(p, ph2) > best[0]:
            best = (score(p, ph2), p, ph2)
    return best[1], best[2]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    OUT.mkdir(exist_ok=True)
    pcm = decode(Path(sys.argv[1]))
    dur = len(pcm) / SR
    mono = pcm.mean(axis=1)
    print(f'decoded {dur:.3f} s, peak {np.abs(pcm).max():.3f}')

    # --- beat grid -------------------------------------------------------------------------
    mag = stft_mag(mono, HOP)
    bank = mel_bank(64, 30, 16000)
    logmel = np.log1p(100 * (mag @ bank.T))
    env = onset_envelope(logmel)
    bpm0 = tempo(env)
    period, first = fit_grid(env, bpm0, dur)
    fr = SR / HOP
    grid = first + period * np.arange(int((dur - first) / period) + 1)
    # How steady is it? Refit each 20 s window's phase on the global period.
    drift = []
    for t0 in np.arange(0, dur - 10, 20):
        sel = grid[(grid >= t0) & (grid < t0 + 20)]
        offs = np.arange(-0.03, 0.0301, 0.002)
        sc = [env[np.clip(((sel + o) * fr).round().astype(int), 0, len(env) - 1)].mean() for o in offs]
        drift.append(round(float(offs[int(np.argmax(sc))]) * 1000))
    print(f'tempo {60 / period:.3f} bpm (autocorr {bpm0:.2f}); first beat {first:.4f} s; '
          f'per-20s phase offset (ms): {drift}')

    # Downbeat: the beat phase (mod 4) with the most low-end onset energy.
    low = np.log1p(100 * (mag @ mel_bank(8, 30, 180).T))
    low_env = onset_envelope(low)
    at = lambda e, ts: e[np.clip((ts * fr).round().astype(int), 0, len(e) - 1)]
    phase_score = [at(low_env, grid[p::4]).mean() + 0.5 * at(env, grid[p::4]).mean() for p in range(4)]
    down = int(np.argmax(phase_score))
    bars = grid[down::4]
    print('downbeat phase scores', np.round(phase_score, 3), '-> phase', down)

    # --- per-bar descriptors -----------------------------------------------------------------
    rms_hop = np.sqrt(np.convolve(mono ** 2, np.ones(HOP) / HOP, mode='same')[::HOP])[:len(env)]
    bands_def = {'sub': (30, 120), 'low': (120, 400), 'mid': (400, 2500), 'high': (2500, 8000), 'air': (8000, 16000)}
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    band_e = {k: (mag[:, (freqs >= a) & (freqs < b)] ** 2).sum(axis=1) for k, (a, b) in bands_def.items()}
    # MFCC-like timbre vectors for self-similarity.
    n = len(logmel)
    dct = np.cos(np.pi / 64 * (np.arange(64) + 0.5)[None, :] * np.arange(1, 14)[:, None])
    mfcc = logmel @ dct.T
    bar_rows = []
    feats = []
    edges = list(bars) + [min(dur, bars[-1] + 4 * period)]
    for b in range(len(bars)):
        a0, a1 = int(edges[b] * fr), int(edges[b + 1] * fr)
        a1 = max(a1, a0 + 1)
        row = {'bar': b, 't': round(float(edges[b]), 4),
               'rms_db': round(float(20 * np.log10(rms_hop[a0:a1].mean() + 1e-9)), 2),
               'onset': round(float(env[a0:a1].mean()), 3)}
        for k, e in band_e.items():
            row[k] = round(float(10 * np.log10(e[a0:a1].mean() + 1e-12)), 2)
        bar_rows.append(row)
        feats.append(np.concatenate([mfcc[a0:a1].mean(axis=0), mfcc[a0:a1].std(axis=0)]))
    F = np.array(feats)
    F = (F - F.mean(axis=0)) / (F.std(axis=0) + 1e-9)
    F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
    ssm = F @ F.T
    # Checkerboard novelty, 4-bar half-width.
    w = 4
    ker = np.kron(np.array([[1, -1], [-1, 1]]), np.ones((w, w)))
    nov = np.zeros(len(F))
    for i in range(w, len(F) - w):
        nov[i] = (ssm[i - w:i + w, i - w:i + w] * ker).sum()
    nov = np.maximum(0, nov) / (nov.max() + 1e-9)
    for r, v in zip(bar_rows, nov):
        r['novelty'] = round(float(v), 3)

    # --- per-video-frame features ------------------------------------------------------------
    vmag = stft_mag(mono, VHOP)
    nvf = int(np.ceil(dur * FPS))
    vmag = vmag[:nvf]
    spec_bank = mel_bank(48, 35, 15000)
    spec = np.log10(1e-6 + (vmag ** 2) @ spec_bank.T)
    spec = (spec - np.percentile(spec, 5)) / (np.percentile(spec, 99.7) - np.percentile(spec, 5))
    spec = np.clip(spec, 0, 1)
    vfreqs = np.fft.rfftfreq(NFFT, 1 / SR)

    def vband(a, b):
        e = 10 * np.log10((vmag[:, (vfreqs >= a) & (vfreqs < b)] ** 2).sum(axis=1) + 1e-12)
        lo, hi = np.percentile(e, 3), np.percentile(e, 99.5)
        return np.clip((e - lo) / (hi - lo), 0, 1)

    L, R = pcm[:, 0], pcm[:, 1]
    def vrms(x):
        pad = np.concatenate([x, np.zeros(nvf * VHOP - len(x) + VHOP)])
        return np.sqrt((pad[:nvf * VHOP].reshape(nvf, VHOP) ** 2).mean(axis=1))
    rl, rr = vrms(L), vrms(R)
    to_db = lambda r: np.clip((20 * np.log10(r + 1e-9) + 48) / 48, 0, 1)
    venv = np.interp(np.arange(nvf) / FPS, np.arange(len(env)) * HOP / SR, env)
    venv = np.clip(venv / 6, 0, 1)

    # 12 kHz scope copy: windowed-sinc low-pass then decimate by 4, int8 after peak-normalising.
    taps = 63
    h = np.sinc(np.arange(-(taps // 2), taps // 2 + 1) * (5000 * 2 / SR)) * np.hamming(taps)
    h /= h.sum()
    dec = SR // SCOPE_SR
    scope = np.stack([np.convolve(pcm[:, c], h, mode='same')[::dec] for c in range(2)], axis=1)
    scope = np.clip(np.round(scope / (np.abs(scope).max() + 1e-9) * 127), -127, 127).astype(np.int8)

    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    q8 = lambda a: np.clip(np.round(np.asarray(a) * 255), 0, 255).astype(np.uint8)
    feat = {
        'fps': FPS, 'frames': nvf, 'duration': round(dur, 4),
        'bpm': round(60 / period, 4), 'beat0': round(float(first), 5), 'period': round(float(period), 6),
        'downPhase': down, 'bar0': round(float(bars[0]), 5),
        'specBins': spec.shape[1],
        'spec': b64(q8(spec)), 'rmsL': b64(q8(to_db(rl))), 'rmsR': b64(q8(to_db(rr))),
        'sub': b64(q8(vband(30, 120))), 'low': b64(q8(vband(120, 400))), 'mid': b64(q8(vband(400, 2500))),
        'high': b64(q8(vband(2500, 9000))), 'onset': b64(q8(venv)),
        'scopeRate': SCOPE_SR, 'scope': b64(scope),
    }
    (OUT / 'features.js').write_text('window.FEAT = ' + json.dumps(feat) + ';\n')
    summary = {'duration': dur, 'bpm': 60 / period, 'beat0': first, 'period': period, 'downPhase': down,
               'beats': [round(float(t), 4) for t in grid], 'bars': bar_rows}
    (OUT / 'summary.json').write_text(json.dumps(summary, indent=1))

    # --- profile image -----------------------------------------------------------------------
    W, H = 1800, 520
    img = Image.new('RGB', (W, H), (14, 12, 10))
    d = ImageDraw.Draw(img)
    nb = len(bar_rows)
    xs = lambda b: 40 + (W - 80) * b / nb
    rms = np.array([r['rms_db'] for r in bar_rows])
    series = [('rms_db', (255, 180, 71)), ('sub', (227, 80, 44)), ('mid', (141, 255, 180)), ('high', (160, 190, 255))]
    for key, col in series:
        v = np.array([r[key] for r in bar_rows])
        v = (v - v.min()) / (v.max() - v.min() + 1e-9)
        pts = [(xs(b + 0.5), 330 - 280 * v[b]) for b in range(nb)]
        d.line(pts, fill=col, width=2)
    for b in range(nb):
        d.rectangle([xs(b) + 1, 500 - 120 * nov[b], xs(b + 1) - 1, 500], fill=(90, 70, 50))
        if b % 4 == 0:
            d.line([xs(b), 40, xs(b), 500], fill=(40, 36, 32))
            d.text((xs(b) + 2, 20), f'{b}', fill=(200, 170, 120))
            d.text((xs(b) + 2, 505), f'{bar_rows[b]["t"]:.0f}s', fill=(120, 100, 80))
    img.save(OUT / 'profile.png')
    print(f'{nb} bars; wrote analysis/features.js ({(OUT / "features.js").stat().st_size / 1e6:.1f} MB), summary.json, profile.png')


if __name__ == '__main__':
    main()
