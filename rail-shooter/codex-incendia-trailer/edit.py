# Cut the Codex Incendia demo from the captured takes. One edit list (edl.json) drives picture and sound: every cut
# sits on the 146 bpm bar grid of the game's own score (score.json), and each segment's sfx (rendered frame-exact
# from its capture log) plays under its pictures. Overlays (title, captions, end card, flashes) come from
# overlays.mjs as a transparent PNG sequence.
# Usage: python3 edit.py [--preview]  ->  out/codex_incendia_demo.mp4 (+ out/review.jpg)
import io, json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw

FPS = 60
E = json.load(open('edl.json')); S = json.load(open('score.json'))
BAR = 60 / S['bpm'] * 4
END = E['end_bar'] * BAR + E['tail']
TOTAL = round(END * FPS)
fr = lambda b: round(b * BAR * FPS)
preview = '--preview' in sys.argv


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit('ffmpeg failed: ' + ' '.join(cmd[:6]))
    return r


os.makedirs('out', exist_ok=True)
# ---------------------------------------------------------------- picture: one symlinked frame sequence ---
seq = 'out/seq'
shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
segs = []
for s in E['segments']:
    F0 = fr(s['b0']); F1 = TOTAL if s['b1'] == 'end' else fr(s['b1'])
    segs.append(dict(s, F0=F0, F1=F1))
    for f in range(F0, F1):
        src = f"frames/{s['clip']}/f_{s['in'] + f - F0:05d}.jpg"
        assert os.path.exists(src), f"{s['clip']}: missing {src} (needs in {s['in']} + {F1 - F0} frames)"
        os.symlink(os.path.abspath(src), f'{seq}/f_{f:05d}.jpg')
assert segs[0]['F0'] == 0 and all(a['F1'] == b['F0'] for a, b in zip(segs, segs[1:])), 'segments must tile the timeline'
n_ovl = len([f for f in os.listdir('overlays') if f.startswith('o_')])
assert n_ovl == TOTAL, f'overlays has {n_ovl} frames, timeline needs {TOTAL}: rerun overlays.mjs'

# ------------------------------------------------------------------------------------------- sound ---
# (file, source start s, duration s, placed at s, gain)
sounds = [('wav/score.wav', S['lead'], END, 0.0, 1.0),
          ('wav/st_graze.wav', 0.05, 1.2, 0.0, 0.7)]          # a golden chime under the title on frame 1
for s in segs:
    sounds.append((f"wav/{s['clip']}.wav", s['in'] / FPS, (s['F1'] - s['F0']) / FPS, s['F0'] / FPS, 0.6))

# gentle crescendo across the sections (dB at bar lines, linear in between)
pts = [(b * BAR, db) for b, db in E['gain_db']] + [(END, E['gain_db'][-1][1])]
expr = f'{pts[-1][1]}'
for (ta, da), (tb, db) in reversed(list(zip(pts, pts[1:]))):
    expr = f'if(lt(t,{tb:.4f}),{da}+({db}-{da})*(t-{ta:.4f})/{tb - ta:.4f},{expr})'
ain, afx = [], []
for k, (f, a, d, T, g) in enumerate(sounds):
    ain += ['-i', f]
    ms = int(round(T * 1000))
    afx.append(f"[{k}:a]aresample=48000,atrim=start={a:.4f}:duration={d:.4f},asetpts=PTS-STARTPTS,"
               f"afade=t=in:d=0.004,afade=t=out:st={max(0, d - 0.012):.4f}:d=0.012,volume={g},adelay={ms}|{ms}[a{k}]")
afx.append(''.join(f'[a{k}]' for k in range(len(sounds))) + f"amix=inputs={len(sounds)}:normalize=0:dropout_transition=0:duration=longest,"
           f"volume='pow(10,({expr})/20)':eval=frame,apad=whole_dur={END:.4f}[aout]")      # bounded pad to the picture length
open('out/audio_graph.txt', 'w').write(';'.join(afx))
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *ain, '-/filter_complex', 'out/audio_graph.txt', '-map', '[aout]',
     '-t', f'{END:.4f}', '-fs', '64M', '-c:a', 'pcm_s16le', '-ar', '48000', 'out/mix_raw.wav'])
dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'out/mix_raw.wav']).stdout)
assert abs(dur - END) < 0.03, f'mix duration {dur} != {END}'
# two-pass EBU R128 loudness normalisation to -14 LUFS / -1 dBTP (the streaming target)
r = run(['ffmpeg', '-hide_banner', '-y', '-i', 'out/mix_raw.wav', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'])
m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'out/mix_raw.wav', '-af',
     f"loudnorm=I=-14:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000",
     '-t', f'{END:.4f}', '-fs', '64M', '-c:a', 'pcm_s16le', 'out/mix.wav'])
print('audio: in', m['input_i'], 'LUFS -> -14 target, true peak in', m['input_tp'])

# ------------------------------------------------------------------------------------------- video ---
out = 'out/codex_incendia_demo_preview.mp4' if preview else 'out/codex_incendia_demo.mp4'
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
     '-framerate', str(FPS), '-i', f'{seq}/f_%05d.jpg', '-framerate', str(FPS), '-i', 'overlays/o_%05d.png', '-i', 'out/mix.wav',
     '-filter_complex', '[0:v][1:v]overlay=format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '2:a',
     '-r', str(FPS), '-c:v', 'libx264', '-preset', 'veryfast' if preview else 'slow', '-crf', '24' if preview else '17',
     '-maxrate', '24M', '-bufsize', '48M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '120',
     '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart',
     '-frames:v', str(TOTAL), '-t', f'{END:.4f}', '-fs', '400M', out])
probe = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,nb_frames',
                        '-of', 'json', out]).stdout)
print(out, json.dumps(probe))

# review sheet: the middle frame of every segment, labelled with its time and source
cols, W, H = 6, 320, 180
rows = (len(segs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H))
for k, s in enumerate(segs):
    t = (s['F0'] + s['F1']) / 2 / FPS
    p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', out, '-frames:v', '1', '-vf', f'scale={W}:{H}',
                        '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
    im = Image.open(io.BytesIO(p.stdout)).convert('RGB')
    ImageDraw.Draw(im).text((4, 164), f"{t:.1f}s {s['clip']}@{s['in']}", fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save('out/review.jpg', quality=85)
print(f'{END:.2f}s, {TOTAL} frames, {len(segs)} segments')
