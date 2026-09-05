#!/usr/bin/env python3
"""Validate the actual built fonts and kit with fontTools and HarfBuzz."""
from pathlib import Path
import json
import zipfile

from fontTools.ttLib import TTFont
from fontTools.pens.pointInsidePen import PointInsidePen
import uharfbuzz as hb

ROOT=Path(__file__).resolve().parent


def shape(path,text,calt):
    font=hb.Font(hb.Face(path.read_bytes()))
    font.scale=(1200,1200)
    buffer=hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(font,buffer,{'calt':calt})
    return buffer.glyph_infos,buffer.glyph_positions


def main():
    manifest=json.loads((ROOT/'coverage.json').read_text())
    expected={int(c['codepoint'][2:],16) for c in manifest['characters']}
    assert len(expected)==manifest['characterCount']
    grouped=''.join(group['characters'] for group in manifest['groups'])
    assert len(grouped)==len(set(grouped))==len(expected)
    assert set(map(ord,grouped))==expected
    assert set(range(32,127))<=expected
    assert set(range(160,384))<=expected
    assert set(range(0x2500,0x25a0))<=expected
    for family in manifest['families']:
        path=ROOT/family['ttf']
        font=TTFont(path,checkChecksums=2)
        assert font.getBestCmap().keys()==expected
        assert len(font.getGlyphOrder())==manifest['glyphCount']
        assert font['head'].unitsPerEm==1200
        assert font['post'].isFixedPitch==1
        assert font['OS/2'].fsType==0
        assert font['name'].getDebugName(1)==family['name']
        for cp,name in font.getBestCmap().items():
            assert font['hmtx'][name][0]==720,(hex(cp),'advance')
            glyph=font['glyf'][name]
            if cp not in (32,160,173):
                assert glyph.numberOfContours>0,(hex(cp),'empty')
                assert glyph.xMin>=0 and glyph.xMax<=720,(hex(cp),'cell overflow')
                assert glyph.yMin>=-320 and glyph.yMax<=1120,(hex(cp),'vertical overflow')
        woff=TTFont(ROOT/family['woff2'])
        assert woff.getBestCmap()==font.getBestCmap()
        assert woff['hmtx'].metrics==font['hmtx'].metrics
        for tag in ('glyf','GSUB','name'):
            assert woff[tag].compile(woff)==font[tag].compile(font),tag
        # Code-reading confusables must have different actual outline data.
        for pair in [('0','O'),('1','I'),('1','l'),('I','l'),("'",'`'),('‘','’')]:
            outlines=[font['glyf'][font.getBestCmap()[ord(c)]].compile(font['glyf']) for c in pair]
            assert outlines[0]!=outlines[1],('indistinguishable',pair)
        if family['name']=='Phosphor Wake':
            glyph_set=font.getGlyphSet()
            # A double elbow and tee must retain the open inner corner. Check
            # the built outlines, rather than the generator's construction.
            for c,point,expected_ink in [('╔',(280,480),True),('╔',(440,340),True),
                                          ('╔',(440,400),False),('╠',(280,400),True),
                                          ('╠',(440,400),False),('╬',(360,400),False)]:
                pen=PointInsidePen(glyph_set,point)
                glyph_set[font.getBestCmap()[ord(c)]].draw(pen)
                assert bool(pen.getResult())==expected_ink,('double-line topology',c,point)
        for sequence in manifest['ligatures']:
            info_off,pos_off=shape(path,sequence,False)
            info_on,pos_on=shape(path,sequence,True)
            assert len(info_off)==len(sequence),(sequence,'disabled glyph count')
            assert len(info_on)==1,(sequence,'enabled glyph count',len(info_on))
            assert sum(p.x_advance for p in pos_off)==720*len(sequence)
            assert sum(p.x_advance for p in pos_on)==720*len(sequence)
            assert all(g.codepoint!=0 for g in info_on)
        for sample in ['const x = foo?.bar ?? 0;','std::vector<int> x;','fn main() -> Result<(), E> {}','Enum.map(data, &(&1 + 1)) |> IO.inspect()','Àéîõü ČŽź ğ œ Ł ĳ ſ','┌─┬─┐\n│▓│░│\n└─┴─┘']:
            for line in sample.split('\n'):
                infos,positions=shape(path,line,True)
                assert all(g.codepoint!=0 for g in infos),sample
                assert sum(p.x_advance for p in positions)==len(line)*720,sample
        print(f'PASS {family["ttf"]}: {len(expected)} encoded characters; {len(manifest["ligatures"])} ligatures; fixed cell and round-trip checks')
    with zipfile.ZipFile(ROOT/'PhosphorWake-font-kit.zip') as kit:
        assert kit.testzip() is None
        for entry in kit.namelist():
            assert kit.read(entry)==(ROOT/Path(entry).name).read_bytes(),entry
    print('PASS exact manifest coverage, complete ASCII/Latin/box/block ranges, ZIP integrity and byte parity')


if __name__=='__main__': main()
