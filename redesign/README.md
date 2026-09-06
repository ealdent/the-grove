# Hub redesign — three directions

Three working mockups for a new `index.html`, all rendered from one data file.
Nothing in the live site is changed by this folder.

| File | Direction | Organising idea |
|---|---|---|
| `a-register.html` | **The Register** | One line per model, one column per brief. The four benchmark briefs are the navigation; blanks show which briefs a model has not yet been set. The workshop (Learn, Utils, Shaders, Arcade, Depths, apps) sits below in the same hand. Hover an entry and its plate is clipped to the desk. Rows and columns cross-light with `:has()`, no script. |
| `b-cyanotype.html` | **The Cyanotype** | A site plan after Anna Atkins's 1843 impressions: every work is one mark, every section a plot drawn to its holdings (squarified treemap), benchmark plots parcelled by provider. Fresh marks print brighter; the dotted line is the surveyor's walk through the latest additions; the title-block revision table is the changelog. The legend is the plain index. |
| `c-playbill.html` | **The Playbill** | Hierarchy by importance, not by folder: tonight's bill (drawn with the date), the same piece in four companies, the season so far, the whole repertoire as cast lists (title … model), and the company. Type size is the hierarchy. Plates print in one ink until touched. |

## Data

`manifest.json` is built by `build_manifest.py` from the eleven section index
pages (their `data-provider` / `data-model` / `data-effort` attributes and card
text) joined with `git log --diff-filter=A` for the date each work entered.
It is the single source the three pages read, and it could equally drive
`README.md` and the section indexes.

```
python3 redesign/build_manifest.py            # refresh manifest.json
python3 redesign/build.py --png-dir <dir>     # convert new captures, render the pages
```

`thumbs/` holds a 480px title-screen capture of each work (headless Chromium,
960×600, one work has no capture: `rail-shooter/redline-ascent/`). The pages
degrade to "no plate yet" when one is missing.

## Normalisations made while building the manifest

- Two different works are both titled *Stormglass*; duplicates are detected by
  file content, not title.
- Learn's model labels of the form `Gemini 3.1 Pro · High` are split into model
  and effort; the `Claude ` prefix is dropped so rows line up with the
  benchmark sections.
- `Fugu Ultra High` (svg-forest) and `Kimi K3` (svg-forest) carried
  `data-provider="other"`; they are attributed to Sakana and Moonshot from the
  model name. `ox-alpha`, `Multiple` and `Unknown` stay unattributed.
