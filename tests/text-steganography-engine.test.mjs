import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  analyzeStructuralWatermarks,
  countWords,
  decodeBitText,
  finalizeFindings,
  summarizeFindings
} from '../utils/text-steganography-engine.js';

const fixtureUrl = new URL('./fixtures/nigredo-watermark.txt', import.meta.url);
const nigredo = await readFile(fixtureUrl, 'utf8');
const nigredoPoem = nigredo.split('\n---\n')[0];

test('word tokenizer preserves apostrophized and hyphenated compounds', () => {
  assert.equal(countWords("My mother's seven-knotted cord"), 4);
  assert.equal(countWords('l\u2019heure non-breaking\u2011hyphen'), 2);
});

test('binary text decoding consumes complete 8-bit or 7-bit groups only', () => {
  const ok8 = '0100111101001011';
  const inverted8 = ok8.replace(/[01]/g, bit => bit === '0' ? '1' : '0');
  const ok7 = '10011111001011';

  assert.equal(decodeBitText(ok8), 'OK');
  assert.equal(decodeBitText(ok7), 'OK');
  assert.equal(decodeBitText(inverted8), null);
  assert.equal(decodeBitText(`${ok8}10`), null);
});

test('full Nigredo specimen exposes the repeated-quatrain parity lead', () => {
  const findings = analyzeStructuralWatermarks(nigredo);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'lead');
  assert.equal(findings[0].payload, '#103A7D');
  assert.equal(findings[0].rawBits, '0011 1010 0111 1101 0001 0000');
  assert.equal(findings[0].evidence.rawPayload, '#3A7D10');
  assert.deepEqual(findings[0].evidence.rawColor.rgb, [58, 125, 16]);
  assert.deepEqual(findings[0].evidence.color.rgb, [16, 58, 125]);
  assert.equal(findings[0].evidence.color.hueFamily, 'blue');
  assert.equal(findings[0].evidence.colorRing.selected.direction, 'right');
  assert.equal(findings[0].evidence.invertedPayload, '#EFC582');
  assert.equal(findings[0].evidence.yearCue.value, 2001);
  assert.equal(findings[0].evidence.yearCue.invertedValue, 2094);
});

test('title, Markdown separator, and prose commentary do not contaminate the poem scope', () => {
  const full = analyzeStructuralWatermarks(nigredo)[0];
  const poemOnly = analyzeStructuralWatermarks(nigredoPoem)[0];

  assert.equal(poemOnly.payload, full.payload);
  assert.equal(poemOnly.rawBits, full.rawBits);
  assert.equal(full.evidence.blockCount, 6);
  assert.equal(full.evidence.blockSize, 4);
});

test('one added word flips only the corresponding parity bit', () => {
  const mutated = nigredo.replace(
    'The gyre has a womb in it, and I am its hour.',
    'The gyre has a womb in it, and I am its hour now.'
  );
  const finding = analyzeStructuralWatermarks(mutated)[0];

  assert.equal(finding.evidence.rawPayload, '#BA7D10');
  assert.equal(finding.payload, '#10BA7D');
  assert.equal(finding.evidence.bits.slice(1), analyzeStructuralWatermarks(nigredo)[0].evidence.bits.slice(1));
});

test('removing authored line and stanza breaks removes the structural candidate', () => {
  const flattened = nigredoPoem.replace(/\s+/g, ' ');
  assert.deepEqual(analyzeStructuralWatermarks(flattened), []);
});

test('an arbitrary six-quatrain parity value remains a lead, never a decode', () => {
  const stanza = ['one', 'two', 'three', 'four'].join('\n');
  const arbitrary = Array.from({ length: 6 }, () => stanza).join('\n\n');
  const finding = finalizeFindings(analyzeStructuralWatermarks(arbitrary))[0];

  assert.equal(finding.payload, '#FFFFFF');
  assert.equal(finding.kind, 'lead');
});

test('finding finalization suppresses low-information decoder noise', () => {
  const findings = finalizeFindings([
    {
      method: 'Morse Code (Punctuation Dots/Dashes)',
      type: 'Morse / Punctuation',
      payload: 'EEEEEEETTEEEEEEEE',
      confidence: 73,
      details: 'noise'
    },
    {
      method: 'Word Telestich (Last Letter of Each Word)',
      type: 'Null Cipher',
      payload: 'ystsydddndteestronsgsdes',
      confidence: 25,
      details: 'noise'
    },
    {
      method: 'Typography Inventory',
      type: 'Punctuation Variant',
      payload: 'U+2014 \u00d7 3',
      confidence: 8,
      details: 'context only'
    },
    {
      method: 'Zero-Width Binary (ZWSP=0, ZWNJ=1)',
      type: 'Invisible Unicode',
      payload: 'FLAG{OK}',
      confidence: 132,
      details: 'reversible'
    },
    {
      method: 'Whitespace SNOW (Trailing Spaces & Tabs)',
      type: 'Whitespace Steganography',
      payload: 'GRID:34N118W',
      confidence: 40,
      details: 'reversible'
    }
  ]);

  assert.deepEqual(findings.map(finding => finding.method), [
    'Zero-Width Binary (ZWSP=0, ZWNJ=1)',
    'Whitespace SNOW (Trailing Spaces & Tabs)',
    'Typography Inventory'
  ]);
  assert.equal(findings[0].kind, 'decoded');
  assert.equal(findings[0].confidence, 100);
  assert.deepEqual(summarizeFindings(findings), {
    decoded: 2,
    lead: 0,
    observation: 1,
    total: 3
  });
});

test('deterministic carriers retain short and low-entropy payloads', () => {
  const findings = finalizeFindings([
    {
      method: 'Zero-Width Binary (ZWSP=0, ZWNJ=1)',
      type: 'Invisible Unicode',
      payload: 'OK',
      confidence: 90,
      details: 'short but reversible'
    },
    {
      method: 'Unicode Language Tag Watermark (U+E0000)',
      type: 'Invisible Tags',
      payload: 'AAAAAA',
      confidence: 90,
      details: 'low entropy but reversible'
    }
  ]);

  assert.deepEqual(findings.map(finding => finding.payload), ['AAAAAA', 'OK']);
  assert.ok(findings.every(finding => finding.kind === 'decoded'));
});
