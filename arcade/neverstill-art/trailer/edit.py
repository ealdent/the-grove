# Cut the Neverstill trailer from the captured clips. Every cut sits on the beat grid of the game's own music
# (main theme 148 bpm, boss theme 166 bpm, clear jingle 150 bpm). One edit list drives picture and sound, so
# each segment's SFX (rendered frame-exact from the capture log) lands under its pictures.
# Usage: python3 edit.py [--preview]   ->  out/neverstill_trailer.mp4 (+ out/edl.json, out/review.jpg)
import json, os, subprocess, sys
from PIL import Image, ImageDraw

FPS = 60
MB, BB, CB = 60 / 148 * 4, 60 / 166 * 4, 60 / 150 * 4     # bar lengths: main, boss, clear
LEAD = 0.08                                                 # the game schedules the first note 80 ms after playSong
fr = lambda t: int(round(t * FPS))
nframes = lambda clip: len([f for f in os.listdir(f'frames/{clip}') if f.endswith('.jpg')])

segs = []   # dicts: T0, T1 (trailer seconds), clip or card, t_in, fade_white (s)
def add(T0, T1, src, t_in=0.0, **kw): segs.append(dict(T0=T0, T1=T1, src=src, t_in=t_in, **kw))

# ---- act 1: main theme, 16 bars ----------------------------------------------------------------------------
M = lambda b: b * MB
add(M(0), M(2), 'card:title')
add(M(2), M(3), 'flight', 0.9, fade_white=0.10)
add(M(3), M(4), 'flight', 2.75)
add(M(4), M(5), 'skimside', 0.05)
add(M(5), M(6), 'flight', 5.0)
add(M(6), M(8), 'rings', 0.95)
for k in range(5): add(M(8 + k * 0.5), M(8.5 + k * 0.5), f'zone{k}', 0.35)
add(M(10.5), M(11.5), 'combat1', 3.0)
add(M(11.5), M(12.5), 'combat2', 2.9)
add(M(12.5), M(13.5), 'combat1', 9.35)
add(M(13.5), M(14.5), 'combat2', 8.35)
add(M(14.5), M(15), 'combat1', 4.62)
add(M(15), M(16), 'flight', 7.5)
# ---- act 2: WARNING (music stops, siren + announcer), then the boss theme lands on the WYRM breaking out ---------
Tw = fr(M(16)) / FPS
Tb = (fr(Tw) + 183) / FPS
add(Tw, Tb, 'wyrm', 0.0)
B = lambda b: Tb + b * BB
add(B(0), B(2), 'wyrmlow', 0.9, fade_white=0.14)
add(B(2), B(3), 'wyrm', 7.55)
add(B(3), B(4), 'wyrm', 9.25)
add(B(4), B(5), 'halo', 1.0)
add(B(5), B(6), 'halo', 5.4)
add(B(6), B(7), 'halo', 9.0)
add(B(7), B(8.5), 'wyrm', 12.25)
add(B(8.5), B(10), 'halo', 13.3)
# ---- act 3: stage clear jingle, warp, end card ---------------------------------------------------------------
Tc = B(10)
Cb = lambda b: Tc + b * CB
add(Cb(0), Cb(1), 'clear', 2.5)
add(Cb(1), Cb(1.5), 'clear', 7.85)
END = Cb(1.5) + 6.6
add(Cb(1.5), END, 'card:end', fade_white=0.45)

# overlays: (png, T0, T1) and their one-frame white flash when a card lands
cards = [('title_logo', M(0.5), M(2)), ('title_tag', M(1), M(2)),
         ('norails', M(2), M(3.75)), ('nobrakes', M(4), M(5.75)), ('neverstop', M(6), M(7.4)), ('chain', M(11.5), M(13.25))]
flash_cards = {'norails', 'nobrakes', 'neverstop', 'chain'}

# sound placements: (file, src_start, dur, T, gain)
sounds = []
for s in segs:
    if not s['src'].startswith('card:'):
        gain = 1.5 if s['T0'] == Tw else 0.9          # the WARNING siren carries the silence between themes
        sounds.append((f"wav/{s['src']}.wav", s['t_in'], (fr(s['T1']) - fr(s['T0'])) / FPS, s['T0'], gain))
sounds += [('wav/mus_main.wav', LEAD, 16 * MB, 0.0, 1.0),
           ('wav/mus_boss.wav', LEAD, 10 * BB, Tb, 1.0),
           ('wav/mus_clear.wav', LEAD, 8.9, Tc, 1.5),
           ('wav/wyrmlow.wav', 0.0, 0.9, Tb - 0.9, 1.0),          # the ground rumbles under the last beat of WARNING
           ('vox/warn.wav', 0.0, 3.05, Tw + 0.12, 1.15),
           ('vox/clear.wav', 0.0, 1.15, Tc + 0.2, 1.0),
           ('wav/st_boom2.wav', 0.04, 2.5, M(0.5), 0.9)]           # logo slam
for name, a, b in cards[2:]: sounds.append(('wav/st_select.wav', 0.04, 0.6, a, 2.2))

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit('ffmpeg failed')
    return r

os.makedirs('out', exist_ok=True)
total = fr(END)

# ---------------------------------------------------------------- picture ---
inputs, chains, labels = [], [], []
for k, s in enumerate(segs):
    F0, F1 = fr(s['T0']), fr(s['T1']); n = F1 - F0; s['frames'] = n
    if s['src'] == 'card:title':
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{n / FPS + 0.5:.4f}', '-i', 'cards/title_bg_ns.png']
        vi = inputs.count('-i') - 1
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{n / FPS + 0.5:.4f}', '-i', 'cards/scan.png']
        si = inputs.count('-i') - 1
        d = n / FPS
        chains.append(f"[{vi}:v]scale=w='trunc(1920*(1+0.045*t/{d:.3f})/2)*2':h=-2:eval=frame:flags=bicubic,"
                      f"crop=1920:1080:'(iw-1920)/2':'(ih-1080)/2',format=rgba[tb{k}];[tb{k}][{si}:v]overlay=format=auto,"
                      f"fade=t=in:st=0:d=0.3,format=yuv444p,trim=end_frame={n},setpts=PTS-STARTPTS[v{k}]")
    elif s['src'] == 'card:end':
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{n / FPS + 0.5:.4f}', '-i', 'cards/endcard.png']
        vi = inputs.count('-i') - 1
        chains.append(f"[{vi}:v]format=yuv444p,trim=end_frame={n},setpts=PTS-STARTPTS,"
                      f"fade=t=in:st=0:d={s.get('fade_white', 0)}:color=white,fade=t=out:st={n / FPS - 0.9:.3f}:d=0.9[v{k}]")
    else:
        st = fr(s['t_in']); have = nframes(s['src'])
        assert st + n <= have, f"{s['src']}: needs frames {st}..{st + n} but only {have}"
        inputs += ['-start_number', str(st), '-framerate', str(FPS), '-i', f"frames/{s['src']}/f_%05d.jpg"]
        vi = inputs.count('-i') - 1
        fw = s.get('fade_white')
        chains.append(f"[{vi}:v]trim=end_frame={n},setpts=PTS-STARTPTS,format=yuv444p" + (f",fade=t=in:st=0:d={fw}:color=white" if fw else '') + f"[v{k}]")
    labels.append(f'[v{k}]')
chains.append(''.join(labels) + f'concat=n={len(labels)}:v=1:a=0[base]')
cur = 'base'
for name, a, b in cards:
    for suffix, t0, t1 in ([('_flash', a, a + 2 / FPS), ('', a + 2 / FPS, b)] if name in flash_cards else [('', a, b)]):
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{t1 - t0:.4f}', '-i', f'cards/{name}{suffix}.png']
        ci = inputs.count('-i') - 1
        chains.append(f"[{ci}:v]format=rgba,setpts=PTS-STARTPTS+{t0:.4f}/TB[c{ci}];[{cur}][c{ci}]overlay=eof_action=pass:format=auto[o{ci}]")
        cur = f'o{ci}'
chains.append(f'[{cur}]format=yuv420p[vout]')
graph = ';'.join(chains)
open('out/video_graph.txt', 'w').write(graph)

preview = '--preview' in sys.argv
vcmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs, '-filter_complex_script', 'out/video_graph.txt',
        '-map', '[vout]', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'veryfast' if preview else 'slow',
        '-crf', '26' if preview else '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-frames:v', str(total), '-fs', '1500M', 'out/video.mp4']
# ------------------------------------------------------------------ sound ---
ain, afx = [], []
for k, (f, a, d, T, g) in enumerate(sounds):
    ain += ['-i', f]
    ms = int(round(T * 1000))
    afx.append(f"[{k}:a]aresample=48000,atrim=start={a:.4f}:duration={d:.4f},asetpts=PTS-STARTPTS,"
               f"afade=t=in:d=0.006,afade=t=out:st={max(0, d - 0.02):.4f}:d=0.02,volume={g},adelay={ms}|{ms}[a{k}]")
afx.append(''.join(f'[a{k}]' for k in range(len(sounds))) + f'amix=inputs={len(sounds)}:normalize=0:dropout_transition=0:duration=longest,'
           f'apad=whole_dur={total / FPS:.4f},afade=t=out:st={total / FPS - 0.9:.3f}:d=0.9[aout]')   # bounded pad to the picture length
open('out/audio_graph.txt', 'w').write(';'.join(afx))
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *ain, '-filter_complex_script', 'out/audio_graph.txt', '-map', '[aout]',
     '-t', f'{total / FPS:.4f}', '-fs', '64M', '-c:a', 'pcm_s16le', '-ar', '48000', 'out/mix_raw.wav'])
dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'out/mix_raw.wav']).stdout)
assert abs(dur - total / FPS) < 0.03, f'mix duration {dur} != {total / FPS}'
# two-pass EBU R128 loudness normalisation to -14 LUFS, -1 dBTP (streaming target)
r = run(['ffmpeg', '-hide_banner', '-y', '-i', 'out/mix_raw.wav', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'])
m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'out/mix_raw.wav', '-af',
     f"loudnorm=I=-14:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000", '-t', f'{total / FPS:.4f}', '-fs', '64M', '-c:a', 'pcm_s16le', 'out/mix.wav'])
print('audio: in', m['input_i'], 'LUFS ->', '-14 target', ' tp', m['input_tp'])
run(vcmd)
out = 'out/neverstill_trailer_preview.mp4' if preview else 'out/neverstill_trailer.mp4'
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'out/video.mp4', '-i', 'out/mix.wav', '-map', '0:v', '-map', '1:a',
     '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out])
json.dump(dict(segs=segs, cards=cards, sounds=sounds, END=END, Tw=Tw, Tb=Tb, Tc=Tc), open('out/edl.json', 'w'), indent=1)

# review sheet: the middle frame of every segment, labelled with its trailer time and source
cols, W, H = 6, 320, 180
rows = (len(segs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H))
for k, s in enumerate(segs):
    t = (s['T0'] + s['T1']) / 2
    p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', out, '-frames:v', '1', '-vf', f'scale={W}:{H}', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
    im = Image.open(__import__('io').BytesIO(p.stdout)).convert('RGB')
    ImageDraw.Draw(im).text((4, 164), f"{s['T0']:.1f}s {s['src']}@{s['t_in']}", fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save('out/review.jpg', quality=85)
print(out, f'{total / FPS:.2f}s', len(segs), 'segments')
