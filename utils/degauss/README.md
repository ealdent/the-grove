# Degauss 1.0

A mixed-space typeface for screens that remember. Degauss is built for code,
terminals and interfaces, drawn in the language of 1970s and 80s cassette
futurism: picture-tube squircles, engineered joints and phosphor dots.

Degauss is not monospaced, and it is not proportional either. Every glyph has
one of four fixed widths, named like tape lengths:

| Class | Advance | Share of C60 | Examples |
|-------|--------:|-------------:|----------|
| C30   | 300     | ½            | `i l ! . , : ; ' \|` |
| C45   | 450     | ¾            | `f j r t I ( ) [ ] { } / \ "` |
| C60   | 600     | 1            | most letters, all figures, space, operators, box drawing |
| C90   | 900     | 1½           | `m w M W @ Æ Œ … —` and wide Cyrillic |

30 : 45 : 60 : 90 is 2 : 3 : 4 : 6, the ratio of an octave, a fifth and a
fourth. Two C30s make a C60, three make a C90, two C45s make a C90. The four
widths are listed per character in `coverage.json`.

The space, the figure space and every box-drawing and block character are
C60, so indentation, directory trees, frames and tables of figures still line
up on the C60 cell. Characters of other classes do not; this is the trade
that lets `m` breathe and `i` stop floating in a wide cell.

## Install

Open `Degauss-Regular.ttf` and `Degauss-Bold.ttf` (or the `.otf` files) in your
system's font installer. On macOS use Font Book's Install button; on Windows
right-click and choose Install; on Linux copy them to `~/.local/share/fonts/`
and run `fc-cache -f`. Restart editors that were open during installation.

Regular and Bold form one style-linked family named **Degauss**, so an editor
that bolds keywords uses the real Bold. Bold keeps Regular's advances exactly:
bolding a word never reflows a line.

VS Code:

```json
{
  "editor.fontFamily": "Degauss, monospace",
  "editor.fontLigatures": true,
  "editor.fontSize": 15,
  "editor.lineHeight": 1.45
}
```

## What is in the kit

- Desktop fonts: TrueType (`.ttf`) and CFF OpenType (`.otf`), Regular and Bold.
- Web fonts: `.woff2` and `.woff`, Regular and Bold.
- `degauss.css`: font faces, a prose helper, a ligature switch, and optional
  phosphor glow and burn-in effects.
- `coverage.json`: every encoded character with its name and width class,
  character groups and the ligature list.
- The construction source, build script and verifier, and an MIT license.

## Coverage

913 characters in each weight:

- Printable ASCII, Latin-1 Supplement and Latin Extended-A, plus Romanian
  comma-below letters, schwa, florin and dotless j.
- Monotonic Greek with tonos and dialytika.
- Cyrillic for Russian, Ukrainian, Belarusian, Bulgarian, Serbian and
  Macedonian.
- Arrows, mathematical operators, logic and set notation, super- and
  subscript figures, fractions, currency signs including € ₹ ₽ ₿ ₩.
- The complete Box Drawing and Block Elements ranges. The shade blocks
  ░ ▒ ▓ are drawn as scanlines rather than dither.
- Geometric shapes, check marks and ballot boxes, keyboard symbols
  (⌘ ⌥ ⇧ ⌃ ⌫ ⎋ ⏎), IEC power symbols (⏻ ⏼ ⏽ ⭘ ⏾) and cassette transport
  controls (⏵ ⏸ ⏹ ⏺ ⏩ ⏪ ⏭ ⏮ ⏯ ⏏).
- Powerline branch, line number, padlock, and the solid, thin and rounded
  separators in their standard private-use slots.

`coverage.json` is the authoritative list. Combining marks are not encoded
separately; precomposed letters are. CJK, emoji and icon libraries are not
included; your system falls back to another font for those.

## Coding ligatures

60 ligatures through the `calt` feature, on by default in browsers and in
editors with ligatures enabled:

- Arrows: `->` `<-` `<->` `-->` `<--` `->>` `=>` `==>` `<==` `<=>` `<==>` `~>` `<~`
- Pipes: `|>` `<|` `<|>` (Elixir, F#, OCaml, Elm, R, Julia)
- Equality and comparison: `==` `===` `!=` `!==` `=/=` `<=` `>=` `<>`
- Scope, assignment and ranges: `::` `:::` `:=` `::=` `..` `..=` `..<`
- Logic and optional chaining: `&&` `||` `!!` `??` `?.` `?:`
- Arithmetic and streams: `++` `+++` `--` `---` `**` `***` `<<` `>>` `<<<` `>>>`
- Haskell: `>>=` `=<<` `<$>` `<*>` `<+>`
- Comments and markup: `//` `///` `/*` `*/` `</` `/>` `</>` `<!--`
- Hex literals: the `x` in `0xFF` becomes a small raised x.

Every source character keeps its own glyph and advance: the first characters
of a ligature become invisible spacers of the same width class and the last
draws the whole shape. Carets, selections and copying behave as if ligatures
were off. A ligature only forms from a complete run of operator characters,
so `https://`, `=>>` and `<<=` stay exactly as typed. Turn `calt` off for a
strict character-by-character view.

## Design notes

- **Picture-tube squircles.** Bowls are rounded rectangles with superelliptic
  corners, the shape of a 1970s screen. Where a stem runs on, the corner
  stays square.
- **Bloom traps.** Wedge-shaped notches where a bowl or shoulder meets a stem
  are the CRT counterpart of ink traps. Phosphor bloom fills them, so glowing
  joints stay as light as the strokes around them; in plain rendering they
  keep dense joints open and give display sizes an engineered edge.
- **Phosphor dots.** Tittles, periods, colons and accents are true circles,
  the beam spot among the squircles.
- **The power-off zero.** `0` carries a free-floating dot: a picture tube
  collapsing to its last bright point. It never touches the walls, so it
  cannot be mistaken for θ, Ø or O.
- **Segment figures.** 2 3 5 6 9 are built like a seven-segment display with
  squircle corners.
- **Legible code.** `0 O`, `1 l I |`, `5 S`, `2 Z`, `8 B`, `ß B` and `δ б 6`
  are all distinct. The u-form `y` shares its tail with `g`.

## Web use

Keep the CSS beside the font files and link it:

```html
<link rel="stylesheet" href="./degauss.css?v=1.000">
<pre class="degauss degauss-phosphor">signal |> decode() != noise</pre>
```

For running text, `.degauss-prose` tightens the C60 word space with
`word-spacing: -0.25em`. `.degauss-amber` and `.degauss-ice` recolour the
glow. `.degauss-burn` with a `data-burn` attribute leaves a faint ghost of
that text behind, like a tube that showed the same screen for years. Glow
and burn-in are rendering effects in CSS; the fonts themselves are plain
outlines that print and embed anywhere.

## Rebuild and verify

Python 3.10 or later:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python build.py
.venv/bin/python verify.py
```

`build.py` reads no existing font. Every outline is constructed from
rectangles, squircles, slanted strokes and circles joined with boolean path
operations (skia-pathops), then written as quadratic TrueType and cubic CFF
outlines. Timestamps and archive entries are fixed, so a rebuild reproduces
the same bytes.

`verify.py` checks the built files: exact coverage against `coverage.json`,
the four width classes, identical Regular and Bold advances, names and style
flags, outline winding in both TTF and OTF, that WOFF2 and WOFF match the
TTF, that box drawing fills the line box, that confusable characters differ,
real HarfBuzz shaping of every ligature with `calt` on and off, and archive
integrity.

Copyright 2026 Jason Adams. Released under the MIT License; see `LICENSE.txt`.
