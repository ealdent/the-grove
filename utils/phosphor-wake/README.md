# Phosphor Wake

An original heavy pixel monospace for terminals that stayed awake too long.
Faceted capitals, blunt lowercase, a diagonal zero, a flagged one, barred I,
and a hooked lowercase l give it an old instrument-panel voice. Every encoded
character occupies one 720-unit cell in a 1200-unit em.

## Install

Open `PhosphorWake-Regular.ttf` and `PhosphorWake-Burn.ttf` in your operating
system's font installer. On macOS, use Font Book's Install button; on Windows,
right-click and choose Install; on Linux, copy to `~/.local/share/fonts/` and
run `fc-cache -f`. Restart an editor that was open during installation.

Select **Phosphor Wake** for the solid pixel face or **Phosphor Wake Burn** for
the scan-cut face with a dithered outline halo. The two are separate font
families so editors can select either one. Both are static, upright faces.
The regular face is intentionally heavy; the Burn face is heavier again.

For example, VS Code settings:

```json
{
  "editor.fontFamily": "'Phosphor Wake', monospace",
  "editor.fontLigatures": "'calt'",
  "editor.fontSize": 18
}
```

Font installation and editor menu behavior depend on the operating system.
The build verifier validates the generated files and shaping; it does not
install fonts into the host OS or alter your editor settings.

## What is in the kit

- Two desktop TrueType fonts (`.ttf`).
- Two browser WOFF2 fonts (`.woff2`).
- `phosphor-wake.css`: font faces, optional soft glow, and a ligature switch.
- `coverage.json`: the exact encoded character list, names, groups, and metrics.
- Original pixel drawings and reproducible Python build and verification source.
- An MIT license allowing personal, commercial, desktop, web, and embedded use.

## Coverage and programming

Complete printable ASCII includes upper- and lowercase letters, digits, and
all source-code punctuation. Complete Latin-1 Supplement and Latin Extended-A
include accented Latin letters. The complete box-drawing and block-element
ranges support terminal frames, progress meters, and shaded panels. Selected
arrows, mathematical operators, keyboard symbols, Greek mathematical letters,
and seven standard Powerline glyphs round out the set. `coverage.json` is the
authoritative list; this is not a claim of universal Unicode coverage.

Space and nonbreaking space have empty outlines; the soft-hyphen outline is
also empty because it is a discretionary formatting character. Combining
marks are not separately encoded; use the supported precomposed Latin forms.
CJK, emoji, full Greek, Cyrillic, and programming icon libraries are outside
this release. Unknown characters should use your application's fallback font.

Optional `calt` programming ligatures preserve the full number of character
cells and retain their underlying ASCII source. Turn contextual ligatures off
for a strict character-by-character appearance. The included set is listed
in `coverage.json`, including `|>`, `<|`, `=>`, `->`, `==`, `===`, `!=`, `!==`,
`<=`, `>=`, `&&`, `||`, `::`, `++`, `--`, `**`, `??`, `?.`, `<<`, `>>`, `:=`,
`=~`, `!~`, `..`, and `...`. Some sequences simply form a single shaping cluster
without joining their outlines, preserving familiar code punctuation.

The font has no kerning. Ordinary encoded glyphs and spaces all advance 720
units. N-character ligatures advance exactly N × 720 units. With a 24px font,
the underlying 80-unit design pixels become 1.6 CSS pixels; at 30px they become
2 CSS pixels. Crispness and hinting will vary by display and rasterizer.

## Burn versus glow

The Burn face contains real monochrome scanline cuts, heavier ink, and small
pixel sparks around the contours. Those outlines survive desktop installation,
PDF embedding, print, and environments with no CSS support. A conventional
outline font cannot create translucent light, coloured bloom, screen curvature,
or soft blur by itself. The web CSS supplies optional true phosphor glow using
`text-shadow`; your editor will show the Burn texture but needs its own effect
support for luminous bloom.

## Web use

Keep the CSS and fonts in the same folder, then:

```html
<link rel="stylesheet" href="./phosphor-wake.css">
<pre class="phosphor-wake-burn phosphor-glow">signal |> remember()</pre>
```

Use a dark background and roomy type for the glow effect. For terminal box
art, use `line-height: 1.2`, no letter spacing, and a `<pre>` element. Box and
block glyphs reach the full line cell. Glow and Burn ink can visually soften
tight gaps; use the solid face for dense source code.

## Rebuild and verify

Use Python 3.10 or later in a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python build.py
.venv/bin/python verify.py
```

All build inputs are local and original. `build.py` reads no existing font,
uses deterministic geometry, fixes font and ZIP timestamps, and writes the two
TTFs, two WOFF2s, the coverage manifest, and `PhosphorWake-font-kit.zip`.
`verify.py` checks exact coverage, fixed cell advances, names, embedding flags,
WOFF2 round trips, bounding boxes, archive integrity, and real HarfBuzz shaping
with contextual ligatures both enabled and disabled.

Copyright 2026 Jason Adams. Released under the MIT License; see `LICENSE.txt`.
