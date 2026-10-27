# Save Me a Seat: The Last Signal

A second interpretation of the same 3:21 song. An amber message travels
through eclipses, abandoned machinery, and a living garden, carried in part
by a small mechanical courier. The shots are animated from original generated
images and cut to the song's lyric and section timings. The original
hand-drawn interpretation remains at `../save-me-a-seat/`.

`index.html` is the watch page. `media/signal.mp4` is the finished film,
`media/signal-short.mp4` is a 30-second excerpt from the final chorus, and
`media/frames/` holds the stills used by the video shelf.

## Re-rendering

The edit uses 29 silent source clips in `source/clips/`, named `01.mp4` through
`29.mp4`, arranged into 35 shots. The source clips are kept locally and excluded
from git; the finished film is tracked. Clips 01–25 are at least 8 seconds,
clip 26 is at least 12 seconds, and clips 27–29 are at least 4 seconds. The
last shot needs the longer source because its window is 13.4 seconds. The
renderer refuses clips that would need more than 1.25×
slowdown; very short windows use the beginning of a longer clip instead of
speeding it up by more than 1.15×. It does not loop footage.

With Python 3, FFmpeg, and ffprobe available, run from the repository root:

```sh
python3 videos/save-me-a-seat-signal/render.py
```

This uses the mix at `tmp/save-me-a-seat/song/mix_vm.wav` and writes
`videos/save-me-a-seat-signal/media/signal.mp4`. It aligns cuts to the nearest
24 fps frame, uses hard cuts, and writes a 4,827-frame H.264/AAC MP4 at
1280×720 with BT.709 color tags and faststart. The full mix is preserved; its
5 ms difference from the frame-aligned picture is padded with silence. The
renderer verifies the result before moving it into place and will not replace
an existing output unless `--overwrite` is supplied.

`--clips`, `--audio`, `--edit`, and `--output` select alternate paths;
`--jobs` controls parallel encodes, `--preset` chooses the x264 preset, and
`--crf` controls quality and file size (default 19; higher produces smaller files).
See `--help` for defaults. `edit.json` contains timings and production notes;
the notes are never rendered as text.

An edit shot can optionally set `"source_in"` to a nonnegative time in
seconds. The renderer then starts that shot at that point in its source clip;
without `source_in` it starts at zero. The remaining source must still be long
enough for the shot's timing and the slowdown limit.
