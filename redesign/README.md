# Hub redesign — three directions

Three working mockups for a new `index.html`, all rendered from one data file.
Nothing in the live site is changed by this folder.

| File | Direction | Organising idea |
|---|---|---|
| `a-register.html` | **The Register** | One line per model, one column per brief. The four benchmark briefs are the navigation; blanks show which briefs a model has not yet been set. The workshop (Learn, Utils, Shaders, Arcade, Depths, apps) sits below in the same hand. Hover an entry and its plate is clipped to the desk. Rows and columns cross-light with `:has()`, no script. |
| `b-cyanotype.html` | **The Cyanotype** | A site plan after Anna Atkins's 1843 impressions: every work is one mark, every section a plot drawn to its holdings (squarified treemap), benchmark plots parcelled by provider. Fresh marks print brighter; the dotted line is the surveyor's walk through the latest additions; the title-block revision table is the changelog. The legend is the plain index. |
| `c-playbill.html` | **The Playbill** | Hierarchy by importance, not by folder: tonight's bill (drawn with the date), the same piece in four companies, the season so far, the whole repertoire as cast lists (title … model), and the company. Type size is the hierarchy. Plates print in one ink until touched. |
| `d-seed-catalogue.html` | **The Seed Catalogue** | An 1890s seedsmen's annual: novelties for the season, a proprietor's selection drawn with the date, then four *variety trials* (one seed sown in forty soils, every grower named) as plate grids over three-column descriptions, then sundries, books, glasshouses and amusements for the workshop. Every variety has a permanent catalogue number. |
| `e-teletext.html` | **The Teletext** | The Grove as a teletext service, set in the site's own Phosphor Wake face (embedded WOFF2). Page 100 is the index; every work has a permanent three-digit page you can type or link to (`#112`); sections roll through subpages; the four briefs sit on the four coloured keys; REVEAL renders a work's title screen as a 40-column mosaic in the seven teletext colours. Every row is selectable text. |
| `f-field-guide.html` | **The Field Guide** | A mid-century pocket natural-history guide: a frontispiece drawn with the date, a dichotomous key that walks a newcomer to the right family by asking what they want, plates numbered and grouped by family, and species accounts where the model stands where a taxonomic authority stands. A checklist at the back keeps what a visitor has seen (localStorage). |

| `g-seven-words.html` | **Seven Words** | The hub is seven category words set huge in Bricolage Grotesque, each with its count. The lit word is filled with its own works' title screens, changing every couple of seconds; resting on another word moves the light. One caption line names the work showing. Nothing else on the page. |
| `h-contact-sheet.html` | **The Contact Sheet** | A photographer's contact sheet: one film strip per category, one frame per work in shooting order, frame numbers in the rebate, the category and count as edge print, the day's pick circled in grease pencil. Strips scroll sideways; a hovered frame brightens and is named in the rebate. |
| `i-lantern.html` | **The Lantern** | The current hub kept and quieted. The illustration, the painted icons, the grain, vignette, ash and Special Elite title stay; the glass card grid and taglines go. Eight lanterns along the bottom with counts; resting on one projects that category's title screens onto the scene, tinted to the hub's palette, and names the work. |

Round two (D, E, F) followed the owner's preference for the Playbill over the
Register and the Cyanotype: a recognisable document form mapped onto the
collection, a real front page with a rotating lead, and typographic
personality over information-design abstraction.

| `g2-seven-words.html` | **Seven Words, four ways** | Iterations of G on identical data, switched with keys 1–4 or the corner labels: **1 Block** — every line scaled to one measure, a justified wood-type block; **2 Serif** — Fraunces in title case on bone, the lit word's picture panning slowly; **3 Phosphor** — the words in Phosphor Wake Burn with a phosphor halo; **4 Split** — the words solid, the picture full-height beside them, the lit word in ember. The switcher is review tooling, not part of any design. |

Round three (G, H, I) followed the correction that D–F were information
overload: the hub keeps a handful of high-level categories (seven, or eight
with the Greenhouse on its own), the works stay behind them, previews do the
describing, and copy is limited to names, counts and the hovered title. The
Workshop category folds Utils, Shaders and Depths (and in G/H the Greenhouse)
into one door; its link points at `utils/` until a combined index exists.

Round four iterates on Seven Words alone, the direction the owner called
"much closer": one page, four variants, each changing one or two axes
(composition, typeface and ground, the house face, where the picture sits).

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
