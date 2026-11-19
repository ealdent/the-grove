#!/usr/bin/env python3
"""Turn downloaded Higgsfield results into what the renderer reads.
    python3 prep.py MEDIA_DIR
raw/<key>.png|jpg|webp  -> img/<key>.jpg  (2560x1440 cover crop, 7% trimmed to lose any printed border)
raw/<clip>.mp4          -> clip/<clip>/0001.jpg ... (24 fps, 1920x1080) and clips.json {clip: frame count}
Only missing outputs are built."""
import json, subprocess, sys
from pathlib import Path
media = Path(sys.argv[1]); raw = media / 'raw'
(media / 'img').mkdir(exist_ok=True); (media / 'clip').mkdir(exist_ok=True)
made = 0
for f in sorted(raw.iterdir()):
    if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp') and not f.stem.startswith('key_'):
        dst = media / 'img' / f'{f.stem}.jpg'
        if not dst.exists() or dst.stat().st_mtime < f.stat().st_mtime:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(f), '-vf', 'crop=iw*0.93:ih*0.93,scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440', '-q:v', '3', '-frames:v', '1', str(dst)], check=True)
            made += 1
    if f.suffix.lower() == '.mp4':
        d = media / 'clip' / f.stem
        if not d.exists() or not any(d.iterdir()) or (d / '0001.jpg').stat().st_mtime < f.stat().st_mtime:
            d.mkdir(exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(f), '-vf', 'fps=24,crop=iw*0.93:ih*0.93,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080', '-q:v', '3', '-frames:v', '400', str(d / '%04d.jpg')], check=True)
            made += 1
clips = {d.name: len(list(d.glob('*.jpg'))) for d in sorted((media / 'clip').iterdir()) if d.is_dir()}
(media / 'clips.json').write_text(json.dumps(clips))
print('built', made, '| images', len(list((media / 'img').glob('*.jpg'))), '| clips', clips)
