#!/usr/bin/env python3
"""Encode the rendered Degauss intro: frames/ + wav/score.wav -> out/degauss-intro.mp4.

Two-pass loudnorm to -14 LUFS / -1 dBTP, H.264 High 4:2:0 in BT.709 with
AAC at 48 kHz, faststart for streaming. Also writes review aids: a contact
sheet (one frame every half second), a spectrogram and a waveform.
Every ffmpeg output is bounded by duration/frame count and file size.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FPS, FRAMES, SECONDS = 60, 900, 15
LUFS, TRUE_PEAK = -14.0, -1.0


def ffmpeg(*args, capture=False):
    cmd = ['ffmpeg', '-hide_banner', '-nostdin', '-y', *map(str, args)]
    run = subprocess.run(cmd, capture_output=True, text=True)
    if run.returncode:
        sys.exit(f'ffmpeg failed:\n{" ".join(cmd)}\n{run.stderr[-3000:]}')
    return run.stderr if capture else None


def main():
    frames = sorted((HERE / 'frames').glob('f_*.jpg'))
    wav = HERE / 'wav' / 'score.wav'
    if len(frames) != FRAMES or not wav.exists():
        sys.exit(f'need {FRAMES} frames and wav/score.wav (have {len(frames)} frames); run node render.mjs')
    out = HERE / 'out'
    out.mkdir(exist_ok=True)
    mp4 = out / 'degauss-intro.mp4'

    # Pass 1: measure the score.
    log = ffmpeg('-i', wav, '-af', f'loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json',
                 '-t', SECONDS, '-f', 'null', '-', capture=True)
    m = json.loads(log[log.rindex('{'):log.rindex('}') + 1])
    print(f"score as rendered: {m['input_i']} LUFS, {m['input_tp']} dBTP, LRA {m['input_lra']}")
    norm = (f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")

    # Pass 2: normalise and mux. JPEG frames are full-range BT.601; convert to
    # limited-range BT.709 and tag it, so players do not shift the amber.
    ffmpeg('-framerate', FPS, '-i', HERE / 'frames' / 'f_%05d.jpg', '-i', wav,
           '-filter_complex', f'[0:v]scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=tv,format=yuv420p[v];'
                              f'[1:a]{norm},aresample=48000,apad=whole_dur={SECONDS}[a]',
           '-map', '[v]', '-map', '[a]',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', 17, '-profile:v', 'high', '-g', FPS, '-bf', 2,
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-c:a', 'aac', '-b:a', '256k', '-ar', 48000, '-ac', 2,
           '-t', SECONDS, '-frames:v', FRAMES, '-fs', '200M', '-movflags', '+faststart', mp4)

    # Review aids.
    ffmpeg('-framerate', FPS, '-i', HERE / 'frames' / 'f_%05d.jpg',
           '-vf', "select='not(mod(n\\,30))',scale=270:270,tile=6x5:padding=4:color=0x303030",
           '-frames:v', 1, '-fs', '20M', out / 'contact-sheet.jpg')
    ffmpeg('-i', mp4, '-lavfi', 'showspectrumpic=s=1200x480:legend=1:scale=log', '-frames:v', 1, '-fs', '20M', out / 'spectrum.png')
    ffmpeg('-i', mp4, '-lavfi', 'showwavespic=s=1200x240:split_channels=1:colors=0xffb447|0xffe7bf', '-frames:v', 1, '-fs', '20M', out / 'waveform.png')

    # Report what was actually written.
    log = ffmpeg('-i', mp4, '-af', 'ebur128=peak=true', '-t', SECONDS, '-f', 'null', '-', capture=True)
    summary = log[log.rindex('Summary:'):]
    loud = re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1)
    peak = re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1)
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', mp4],
                                      capture_output=True, text=True, check=True).stdout)
    v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    size = mp4.stat().st_size
    print(f"{mp4.relative_to(HERE)}: {v['width']}x{v['height']} {v['codec_name']} {v['profile']} {v['pix_fmt']} "
          f"{v['r_frame_rate']} fps, {v['nb_frames']} frames, {v.get('color_space')} | {a['codec_name']} {a['sample_rate']} Hz "
          f"{a['channels']} ch | {float(probe['format']['duration']):.3f} s, {size / 1e6:.1f} MB, "
          f"{int(probe['format']['bit_rate']) / 1e6:.1f} Mbit/s | {loud} LUFS, true peak {peak} dBFS")


if __name__ == '__main__':
    main()
