"""Word timestamps + onset envelope for the 1915 Taylor Holmes "Boots" recording.

usage: analyze.py <source.wav> <out_dir>
Writes words.json (whisper word timings) and onsets.json (voice-band onset peaks).
Run with tmp/.venv-whisper/bin/python (mlx-whisper + scipy).
"""
import json, sys, subprocess, os
import numpy as np
from scipy import signal
from scipy.io import wavfile

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
mono = os.path.join(out, "mono16k.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", "-t", "200", mono], check=True)

sr, x = wavfile.read(mono)
x = x.astype(np.float32) / 32768.0
# voice-band onset envelope, 5 ms hop
sos = signal.butter(4, [250, 3400], btype="band", fs=sr, output="sos")
v = signal.sosfilt(sos, x)
hop = int(sr * 0.005)
win = int(sr * 0.020)
n = (len(v) - win) // hop
rms = np.array([np.sqrt(np.mean(v[i * hop:i * hop + win] ** 2)) for i in range(n)])
db = 20 * np.log10(rms + 1e-6)
sm = signal.savgol_filter(db, 9, 2)
flux = np.maximum(0, np.diff(sm, prepend=sm[0]))
flux = np.convolve(flux, np.hanning(7) / np.hanning(7).sum(), mode="same")
peaks, props = signal.find_peaks(flux, height=np.percentile(flux, 80), distance=int(0.12 / 0.005))
onsets = [{"t": round(float(p * 0.005), 3), "s": round(float(flux[p]), 3), "db": round(float(sm[min(p + 6, n - 1)]), 1)} for p in peaks]
json.dump({"hop": 0.005, "onsets": onsets}, open(os.path.join(out, "onsets.json"), "w"))
np.save(os.path.join(out, "env_db.npy"), sm.astype(np.float32))
print("onsets", len(onsets))

if "--no-whisper" not in sys.argv:
    import mlx_whisper
    r = mlx_whisper.transcribe(mono, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", word_timestamps=True,
                               language="en", condition_on_previous_text=False,
                               initial_prompt="Boots, boots, boots, boots, movin' up and down again. There's no discharge in the war. We're foot, slog, slog, slog, sloggin' over Africa.")
    words = [{"w": w["word"].strip(), "s": round(float(w["start"]), 3), "e": round(float(w["end"]), 3)} for seg in r["segments"] for w in seg.get("words", [])]
    json.dump({"text": r["text"], "words": words}, open(os.path.join(out, "words.json"), "w"), indent=0)
    print("words", len(words))
