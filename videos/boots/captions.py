#!/usr/bin/env python3
"""Write boots.srt: the recitation, one caption per spoken line, in Holmes's stanza order.

    python3 captions.py [OUT.srt ...]      (default: boots.srt beside this file)

Times are source seconds in the 1915 transfer (the same measured voice onsets edit.js cuts on); the film starts at T0.
The text is Kipling's (1903, public domain). Each cue runs from its line's first syllable until the next line starts,
so the captions never blink off mid-stanza; the last one ends with the voice.
"""
import sys
from pathlib import Path

T0 = 33.0
BOOTS = "Boots—boots—boots—boots—movin' up an' down again!"
WAR = "There's no discharge in the war!"
END = 184.0  # the voice stops
LINES = [  # (first onset, text)
    (34.24, "We're foot—slog—slog—slog—sloggin' over Africa—"),
    (40.73, "Foot—foot—foot—foot—sloggin' over Africa—"),
    (46.07, BOOTS),
    (51.78, WAR),
    (55.03, "Seven—six—eleven—five—nine-an'-twenty mile to-day—"),
    (60.32, "Four—eleven—seventeen—thirty-two the day before—"),
    (64.39, BOOTS),
    (70.06, WAR),
    (73.12, "Don't—don't—don't—don't—look at what's in front of you."),
    (78.28, BOOTS),
    (83.50, "Men—men—men—men—men go mad with watchin' 'em,"),
    (88.86, "An' there's no discharge in the war!"),
    (91.88, "Count—count—count—count—the bullets in the bandoliers."),
    (97.08, "If—your—eyes—drop—they will get atop o' you!"),
    (101.92, BOOTS),
    (107.42, WAR),
    (110.53, "We—can—stick—out—'unger, thirst, an' weariness,"),
    (115.51, "But—not—not—not—not the chronic sight of 'em—"),
    (120.54, BOOTS),
    (126.00, "An' there's no discharge in the war!"),
    (129.00, "'Tain't—so—bad—by—day because o' company,"),
    (133.77, "But night—brings—long—strings—o' forty thousand million"),
    (138.62, BOOTS),
    (143.97, WAR),
    (146.63, "I—'ave—marched—six—weeks in 'Ell an' certify"),
    (151.74, "It—is—not—fire—devils, dark, or anything,"),
    (156.09, "But boots—boots—boots—boots—movin' up an' down again,"),
    (161.93, "An' there's no discharge in the war!"),
    (164.99, "Try—try—try—try—to think o' something different—"),
    (170.11, "Oh—my—God—keep—me from goin' lunatic!"),
    (175.23, BOOTS),
    (180.80, WAR),
]


def stamp(t):
    ms = round(t * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def main():
    cues = []
    for i, (a, text) in enumerate(LINES):
        b = LINES[i + 1][0] - 0.04 if i + 1 < len(LINES) else END
        cues.append(f'{i + 1}\n{stamp(a - T0)} --> {stamp(b - T0)}\n{text}\n')
    srt = '\n'.join(cues)
    for out in sys.argv[1:] or [str(Path(__file__).with_name('boots.srt'))]:
        Path(out).write_text(srt, encoding='utf-8')
        print('wrote', out, len(cues), 'cues')


if __name__ == '__main__':
    main()
