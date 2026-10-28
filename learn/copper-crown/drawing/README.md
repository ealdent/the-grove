# Copper Crown dimensional drawing

`copper-crown-drawing.js` and `copper-crown-drawing.css` are the editable
scene and palette. They adapt the `dimensional-drawing-motion` scene template:
the SVG stroke registration, time-based camera, and morph groups are retained
and the device geometry, typography, timings, and colors are specific to the
Copper Crown. The film is 11 seconds, silent, 1920 × 1080, at 30 fps.

The drawing includes the full front elevation, separated components, top and
right elevations, kettle section, tube section, and the example dimensions
from the learning page. Overall width and height remain `TBD`. The illustration
is labeled schematic and not to scale.

To regenerate from this directory, use Node 18+, FFmpeg, and Playwright:

```sh
cd headless
npm install
node render.mjs \
  --scene ../copper-crown-drawing.js \
  --css ../copper-crown-drawing.css \
  --duration 11 --fps 30 --width 1920 --height 1080 --crf 18 \
  --out ../copper-crown-drawing.mp4
node render.mjs \
  --scene ../copper-crown-drawing.js \
  --css ../copper-crown-drawing.css \
  --still 10.8 --out /tmp/copper-crown-drawing-poster.png
ffmpeg -i /tmp/copper-crown-drawing-poster.png -q:v 2 \
  ../copper-crown-drawing-poster.jpg
```

Set `CHROMIUM_PATH` to an installed Chrome/Chromium binary if preferred. The
adapter also accepts comma-separated keyframes via `--stills` with `--out`
set to a directory, e.g. `--stills 0,2.4,5.9,8,10.8 --out /tmp/crown-beats`.
