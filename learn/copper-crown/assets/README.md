# Copper Crown model and film assets

The Blender scene and glTF were created from scratch with `build_still.py`.
The scene contains the full 1–576 frame animation at 12 frames per second.
The glTF is a static, assembled version with named component groups. The
film is **48 seconds**. Gold and blue moving dots are
an explanatory flow overlay, not a fluid simulation. Their positions are
keyed at every rendered frame to keep them on the illustrated route.

The kettle is an open shell with an inner stainless face; the lid has a
separate inner liner and the demister contains a representative wire screen.
The pipe curves have open ends, with simplified walls, connections, seals,
and internals. The cooling vessel is a continuous transparent wall, open on
top, to expose the coil. The temperature-limit housing and sensor are symbolic;
electrical circuitry, water-level detection, insulation, and the remote vent
discharge are outside the scene.

To rebuild the static assets and the high-resolution poster from the repository
root using the macOS Blender application:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 \
  --python learn/copper-crown/assets/build_still.py -- \
  --assets learn/copper-crown/assets --still
ffmpeg -i learn/copper-crown/assets/copper-crown-poster.png -q:v 2 \
  learn/copper-crown/assets/copper-crown-poster.jpg
```

To render the entire animation from the saved `.blend` without placing frame
files in the repository, run this from the repository root. The scene uses
blended transparency; the command sets EEVEE's render samples to 16:

```sh
mkdir -p /private/tmp/copper-crown-frames
/Applications/Blender.app/Contents/MacOS/Blender \
  -b learn/copper-crown/assets/copper-crown.blend -t 4 \
  -o /private/tmp/copper-crown-frames/frame_ -F PNG \
  --python-expr 'import bpy; bpy.context.scene.eevee.taa_render_samples = 16' -a
ffmpeg -framerate 12 -start_number 1 \
  -i /private/tmp/copper-crown-frames/frame_%04d.png \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart \
  learn/copper-crown/assets/copper-crown-assembly-silent.mp4
```

The spoken master and caption track are separate; the page's delivered film
combines narration with the rendered video. The source animation is silent.

To recreate the delivered narrated film on macOS, regenerate the opening
card with Pillow and combine it with the silent render and the retained
narration master. The English captions remain a separate WebVTT track in the
page; the spoken script and the source voice clips are in `../audio/`.

```sh
python3 learn/copper-crown/assets/create_title.py
ffmpeg -i learn/copper-crown/assets/copper-crown-assembly-silent.mp4 \
  -loop 1 -i learn/copper-crown/assets/copper-crown-title.png \
  -i learn/copper-crown/audio/copper-crown-narration.flac \
  -filter_complex "[1:v]format=rgba,fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=4:d=1:alpha=1[title];[0:v][title]overlay=0:0:enable='between(t,0,5)'[video]" \
  -map '[video]' -map 2:a:0 -c:v libx264 -crf 19 -preset medium \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -t 48 \
  learn/copper-crown/assets/copper-crown-narrated.mp4
```
