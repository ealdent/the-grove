# Copper Crown model and film assets

The Blender scene and glTF were created from scratch with `build_still.py`.
The editable scene includes machined unions, gauges, braces, and individual
fasteners, as well as the full 1–720 frame animation at 12 frames per second.
The static glTF retains ten named component groups and embeds the generated
metal surface maps. Opaque details are batched by group and material for the
browser; transparent glass and water remain separate. The film is **60
seconds**, silent, with a separate caption track. Gold and blue moving dots
are an explanatory flow overlay, not a fluid simulation: gold for the steam
the crown leaves to the coil, blue for the two harvests. Their positions are
keyed at every rendered frame to keep them on the illustrated route.

The crown is the working part. Two nested 30° cones sit on a band above the
kettle: steam condenses under the inner cone and drains from a rim gutter,
and the heat it gives up evaporates a film of feed water on the cone's upper
face. That vapor crosses a narrow air gap (about 6 mm in the concept, drawn
wider here) and condenses under the outer cone, which an open basin of
cooling water keeps cool. Group `02` is the inner crown, `02b` the outer
crown and basin, and `03c` the two harvest lines and the basin-to-bath water
link.

The 3D viewer, its poster, and its model-download data are embedded in
`../../copper-crown.html`, so that viewer can run when the HTML is opened
directly from disk. The films, captions, and Blender download still use the
neighboring asset files.

The kettle is an open shell with an inner stainless face; the outer cone has
a separate stainless product face and the demister contains a representative
wire screen. The gutters, wick, downcomers and metering valve are simplified.
The pipe curves have open ends, with simplified walls, connections, seals,
and internals. The cooling vessel is a continuous transparent wall, open on
top, to expose the coil. The temperature-limit housing and sensor are symbolic;
electrical circuitry, water-level detection, insulation, and the remote vent
discharge are outside the scene.

To rebuild the static assets and the high-resolution poster from the repository
root using the macOS Blender application, including the four generated,
tileable surface maps (which are also embedded in the `.blend` and `.glb`).
The poster uses 64 denoised Cycles samples; the saved scene remains in Eevee
for animation:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 4 \
  --python learn/copper-crown/assets/build_still.py -- \
  --assets learn/copper-crown/assets --still
# add `--preview /tmp/look.png` for a quick EEVEE still while editing
ffmpeg -i learn/copper-crown/assets/copper-crown-poster.png -q:v 2 \
  learn/copper-crown/assets/copper-crown-poster.jpg
```

After changing `viewer.js`, the GLB, or the poster, rebuild the embedded
viewer from the repository root. This build step requires Node.js, npm, Python,
and the pinned esbuild version; none are needed to open the finished page:

```sh
npm install --prefix /tmp/copper-crown-build --save-exact esbuild@0.25.12
python3 learn/copper-crown/build-standalone.py \
  --esbuild /tmp/copper-crown-build/node_modules/.bin/esbuild
```

To render the entire animation without placing frame files in the
repository, add `--render --frames DIR` to the build command above (EEVEE,
16 samples), then encode the frames with the opening card from
`create_title.py`. The film has no soundtrack; the English captions are the
separate WebVTT track `copper-crown-captions.vtt`, timed to the assembly:

```sh
python3 learn/copper-crown/assets/create_title.py
ffmpeg -framerate 12 -start_number 1 -i DIR/frame_%04d.png \
  -loop 1 -i learn/copper-crown/assets/copper-crown-title.png \
  -filter_complex "[1:v]format=rgba,fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=4:d=1:alpha=1[title];[0:v][title]overlay=0:0:enable='between(t,0,5)'[video]" \
  -map '[video]' -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p \
  -movflags +faststart -t 60 -an \
  learn/copper-crown/assets/copper-crown-assembly-silent.mp4
```

The narration in `../audio/` was recorded for the earlier single-condenser
machine and is not used by the page; see the note there.
