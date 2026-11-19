"""Loudness curve, percussion count and D-minor/D-major balance of a score take (find dropouts and the key turn).
usage: score_check.py take.mp3 [...]   (run with tmp/.venv-whisper/bin/python)"""
import subprocess, sys, tempfile, os
import numpy as np
from scipy.io import wavfile
from scipy import signal

for path in sys.argv[1:]:
    wav = path + '.16k.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ac', '1', '-ar', '16000', wav], check=True)
    sr, x = wavfile.read(wav); x = x.astype(np.float32) / 32768; os.remove(wav)
    hop = sr * 2
    db = [20 * np.log10(np.sqrt(np.mean(x[i:i + hop] ** 2)) + 1e-6) for i in range(0, len(x) - hop + 1, hop)]
    f, t, S = signal.stft(x, sr, nperseg=512, noverlap=384)
    mag = np.abs(S); flux = np.maximum(0, np.diff(np.log1p(30 * mag), axis=1)).sum(0); flux /= np.median(flux) + 1e-9
    def third(a, b):
        F, P = signal.welch(x[int(a * sr):int(b * sr)], sr, nperseg=16384)
        e = lambda base: sum(P[(F > base * o * 0.985) & (F < base * o * 1.015)].sum() for o in (0.5, 1, 2, 4))
        return round(float(10 * np.log10((e(185.0) + 1e-12) / (e(174.61) + 1e-12))), 1)
    print(os.path.basename(path), 'len', round(len(x) / sr, 1))
    print(' rms per 2 s:', ' '.join(f'{d:.0f}' for d in db))
    print(' quietest 2 s windows (s, dB):', sorted(((i * 2, round(d)) for i, d in enumerate(db)), key=lambda p: p[1])[:6])
    print(' hard onsets per 20 s:', [int((flux[int(k * sr / 128):int((k + 20) * sr / 128)] > 6).sum()) for k in range(0, 160, 20)])
    print(' F#-vs-F dB (major if >0):', {'60-115': third(60, 115), '115-132': third(115, 132), '134-152': third(134, 152), '152-158': third(152, 158)})
