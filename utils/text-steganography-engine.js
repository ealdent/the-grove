const WORD_PATTERN = /\p{L}[\p{L}\p{M}\p{N}]*(?:['’\u02BC][\p{L}\p{M}\p{N}]+)*(?:[-\u2010\u2011][\p{L}\p{M}\p{N}]+(?:['’\u02BC][\p{L}\p{M}\p{N}]+)*)*/gu;

const KIND_ORDER = Object.freeze({ decoded: 0, lead: 1, observation: 2 });

const DETERMINISTIC_METHOD = /Zero-Width|Unicode Language Tag|Whitespace SNOW|Inter-Word Spacing Binary|Unicode Space Variant Binary|Embedded (?:Base64|Hexadecimal|Binary)|Variation Selector Binary/i;
const OBSERVATION_METHOD = /Scanner|Normalizer|Detection|Inventory|Bidirectional|Exotic Unicode Space|Statistical/i;
const AMBIGUOUS_METHOD = /Acrostic|Null Cipher|Telestich|Diagonal|Fixed-Stride|Bacon|Case Modulation|Capital Letters|Morse|Word Length|Terminal Punctuation/i;

export function tokenizeWords(text) {
  return String(text || '').match(WORD_PATTERN) || [];
}

export function countWords(text) {
  return tokenizeWords(text).length;
}

function printableRatio(text) {
  if (!text) return 0;
  let printable = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if ((codePoint >= 32 && codePoint <= 126) || codePoint === 9 || codePoint === 10 || codePoint === 13) {
      printable++;
    }
  }
  return printable / [...text].length;
}

export function decodeBitText(bits) {
  const stream = String(bits || '');
  if (stream.length < 7 || !/^[01]+$/.test(stream)) return null;

  let utf8 = null;
  if (stream.length % 8 === 0) {
    const bytes = [];
    for (let index = 0; index < stream.length; index += 8) {
      bytes.push(parseInt(stream.slice(index, index + 8), 2));
    }
    try {
      utf8 = new TextDecoder('utf-8', { fatal: true })
        .decode(new Uint8Array(bytes))
        .replace(/\0+$/, '');
    } catch (error) {
      utf8 = null;
    }
  }

  let ascii7 = null;
  if (stream.length % 7 === 0) {
    ascii7 = '';
    for (let index = 0; index < stream.length; index += 7) {
      ascii7 += String.fromCharCode(parseInt(stream.slice(index, index + 7), 2));
    }
    ascii7 = ascii7.replace(/\0+$/, '');
  }

  if (utf8 && printableRatio(utf8) >= 0.75) return utf8;
  if (ascii7 && printableRatio(ascii7) > printableRatio(utf8)) return ascii7;
  return utf8 || ascii7 || null;
}

function buildBlocks(text) {
  const sourceLines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    blocks.push({
      lines: current,
      lineCount: current.length,
      startLine: current[0].sourceLine,
      endLine: current[current.length - 1].sourceLine
    });
    current = [];
  };

  sourceLines.forEach((line, index) => {
    if (!line.trim()) {
      flush();
      return;
    }
    current.push({ text: line, sourceLine: index + 1 });
  });
  flush();
  return blocks;
}

function isMarkdownSeparator(block) {
  return block.lineCount === 1 && /^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(block.lines[0].text);
}

function repeatedLineBlockRuns(text) {
  const blocks = buildBlocks(text);
  const runs = [];
  let index = 0;

  while (index < blocks.length) {
    const first = blocks[index];
    if (first.lineCount < 2 || first.lineCount > 8 || isMarkdownSeparator(first)) {
      index++;
      continue;
    }

    let end = index + 1;
    while (end < blocks.length && blocks[end].lineCount === first.lineCount && !isMarkdownSeparator(blocks[end])) {
      end++;
    }

    const runBlocks = blocks.slice(index, end);
    const totalLines = runBlocks.reduce((sum, block) => sum + block.lineCount, 0);
    if (runBlocks.length >= 3 && totalLines >= 12 && totalLines <= 64) {
      runs.push({
        blocks: runBlocks,
        blockCount: runBlocks.length,
        blockSize: first.lineCount,
        totalLines,
        startLine: runBlocks[0].startLine,
        endLine: runBlocks[runBlocks.length - 1].endLine
      });
    }
    index = end;
  }

  return runs;
}

function invertBits(bits) {
  return bits.replace(/[01]/g, bit => bit === '0' ? '1' : '0');
}

function bitsToHex(bits) {
  if (!bits || bits.length % 4 !== 0) return null;
  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    hex += parseInt(bits.slice(index, index + 4), 2).toString(16).toUpperCase();
  }
  return hex;
}

function colorInterpretation(hex) {
  if (!hex || hex.length !== 6) return null;
  const rgb = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16)
  ];
  const normalized = rgb.map(channel => channel / 255);
  const max = Math.max(...normalized);
  const min = Math.min(...normalized);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === normalized[0]) hue = 60 * (((normalized[1] - normalized[2]) / delta) % 6);
    else if (max === normalized[1]) hue = 60 * (((normalized[2] - normalized[0]) / delta) + 2);
    else hue = 60 * (((normalized[0] - normalized[1]) / delta) + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hueFamily = 'neutral';
  if (saturation >= 0.2) {
    if (hue < 15 || hue >= 345) hueFamily = 'red';
    else if (hue < 45) hueFamily = 'orange';
    else if (hue < 70) hueFamily = 'yellow';
    else if (hue < 165) hueFamily = 'green';
    else if (hue < 195) hueFamily = 'cyan';
    else if (hue < 255) hueFamily = 'blue';
    else if (hue < 290) hueFamily = 'purple';
    else hueFamily = 'magenta';
  }
  return {
    css: `#${hex}`,
    hsl: [Math.round(hue), Math.round(saturation * 100), Math.round(lightness * 100)],
    hueFamily,
    rgb
  };
}

function rgbByteRotations(hex) {
  if (!hex || hex.length !== 6) return [];
  const variants = [
    { direction: 'none', hex },
    { direction: 'right', hex: hex.slice(4) + hex.slice(0, 4) },
    { direction: 'left', hex: hex.slice(2) + hex.slice(0, 2) }
  ];
  return variants.map(variant => ({ ...variant, color: colorInterpretation(variant.hex) }));
}

function interpretColorRing(text, hex, invertedHex) {
  if (!hex || hex.length !== 6) return null;
  const lower = String(text || '').toLowerCase();
  const cycleCue = /\b(?:gyre|cycle|cyclic|circle|ring|rotate|rotation|turn|clock)\b/.test(lower);
  const backwardCue = /\b(?:backward|backwards|counterclockwise|reverse)\b/.test(lower);
  const sevenKnotCue = /\bseven(?:-|\s+)knotted\b/.test(lower);
  const sigilCue = /\bsigil\b/.test(lower);
  const namedColors = [...new Set(lower.match(/\b(?:red|orange|yellow|green|cyan|blue|purple|magenta)\b/g) || [])];
  const rotations = rgbByteRotations(hex);
  const invertedRotations = rgbByteRotations(invertedHex);
  const right = rotations.find(rotation => rotation.direction === 'right');
  const uniqueColorMatches = rotations.filter(rotation => namedColors.includes(rotation.color.hueFamily));
  let selected = rotations[0];
  let reason = 'linear stanza order';

  if (cycleCue && backwardCue) {
    selected = right;
    reason = 'cycle + backward cues select one right RGB-byte rotation';
  } else if (cycleCue && uniqueColorMatches.length === 1) {
    selected = uniqueColorMatches[0];
    reason = `cycle cue + unique ${selected.color.hueFamily} match select ${selected.direction} rotation`;
  }

  const invertedSelected = invertedRotations.find(rotation => rotation.direction === selected.direction);
  return {
    backwardCue,
    cycleCue,
    invertedRotations,
    invertedSelected,
    namedColors,
    reason,
    rotations,
    sevenKnotCue,
    selected,
    selectedMatchesNamedColor: namedColors.includes(selected.color.hueFamily),
    sigilCue
  };
}

function findYearCue(lines, bits) {
  for (let index = 11; index < lines.length; index++) {
    if (!/\byear\b/i.test(lines[index].text)) continue;
    const cueBits = bits.slice(index - 11, index + 1);
    const value = parseInt(cueBits, 2);
    const invertedValue = parseInt(invertBits(cueBits), 2);
    if ((value >= 1000 && value <= 2200) || (invertedValue >= 1000 && invertedValue <= 2200)) {
      return {
        bits: cueBits,
        invertedValue,
        sourceLine: lines[index].sourceLine,
        value,
        windowStartLine: lines[index - 11].sourceLine
      };
    }
  }
  return null;
}

function formatStructuralEvidence(blockEvidence) {
  return blockEvidence.map((block, index) => {
    const suffix = block.hex ? ` \u2192 ${block.hex}` : '';
    return `Block ${index + 1}: ${block.counts.join(', ')} \u2192 ${block.bits}${suffix}`;
  }).join('\n');
}

export function analyzeStructuralWatermarks(text) {
  const findings = [];

  for (const run of repeatedLineBlockRuns(text)) {
    const lines = run.blocks.flatMap(block => block.lines);
    const counts = lines.map(line => countWords(line.text));
    if (counts.some(count => count === 0)) continue;

    const bits = counts.map(count => count % 2 === 0 ? '0' : '1').join('');
    const invertedBits = invertBits(bits);
    const hex = bitsToHex(bits);
    const invertedHex = bitsToHex(invertedBits);
    const rawColor = colorInterpretation(hex);
    const invertedRawColor = colorInterpretation(invertedHex);
    const colorRing = interpretColorRing(lines.map(line => line.text).join('\n'), hex, invertedHex);
    const color = colorRing ? colorRing.selected.color : rawColor;
    const invertedColor = colorRing ? colorRing.invertedSelected.color : invertedRawColor;
    const yearCue = findYearCue(lines, bits);
    const blockEvidence = run.blocks.map(block => {
      const blockCounts = block.lines.map(line => countWords(line.text));
      const blockBits = blockCounts.map(count => count % 2 === 0 ? '0' : '1').join('');
      return {
        bits: blockBits,
        counts: blockCounts,
        hex: blockBits.length === 4 ? bitsToHex(blockBits) : null,
        sourceLines: [block.startLine, block.endLine]
      };
    });

    let payload = bits.replace(/(.{4})/g, '$1 ').trim();
    let method = 'Line Word-Count Parity';
    let details = `${run.blockCount} consecutive ${run.blockSize}-line blocks preserve a ${bits.length}-bit even/odd word-count stream.`;
    if (hex) {
      payload = bits.length === 24 && colorRing ? colorRing.selected.color.css : (bits.length === 24 ? `#${hex}` : `0x${hex}`);
      method += ' \u2192 Hexadecimal';
      details += ` Even=0 and odd=1 first yields ${bits.length === 24 ? '#' : '0x'}${hex}; inverted polarity yields ${bits.length === 24 ? '#' : '0x'}${invertedHex}.`;
    }
    if (colorRing && colorRing.selected.direction !== 'none') {
      method = 'Line Word-Count Parity \u2192 Cyclic RGB Hex';
      details += ` Carrier cycle/backward cues bound the interpretation to one right RGB-byte rotation: ${hex.match(/../g).join(' ')} \u2192 ${colorRing.selected.hex.match(/../g).join(' ')} \u2192 ${payload}.`;
    }
    if (color) {
      details += ` The selected candidate is RGB(${color.rgb.join(', ')}), ${color.hueFamily} (HSL ${color.hsl[0]}\u00b0 ${color.hsl[1]}% ${color.hsl[2]}%).`;
      if (colorRing && colorRing.selectedMatchesNamedColor) details += ` That matches an explicit \u201c${color.hueFamily}\u201d carrier cue.`;
      if (colorRing && colorRing.sigilCue) details += ` The color-prefix # is compatible with the carrier's \u201csigil\u201d cue.`;
      if (colorRing && colorRing.sevenKnotCue && payload.length === 7) details += ` The seven-character candidate matches the \u201cseven-knotted\u201d cue.`;
    }
    if (yearCue) {
      details += ` A 12-bit window ending on the explicit word \u201cyear\u201d is ${yearCue.value} (${yearCue.invertedValue} inverted).`;
    }
    details += ' Format compatibility is a structural lead, not independent proof of a watermark.';

    const score = Math.min(85,
      35 +
      Math.min(15, run.blockCount * 2) +
      (bits.length === 24 ? 10 : 0) +
      (yearCue ? 15 : 0) +
      (colorRing && colorRing.selected.direction !== 'none' ? 6 : 0) +
      (colorRing && colorRing.selectedMatchesNamedColor ? 7 : 0)
    );

    let evidenceText = formatStructuralEvidence(blockEvidence);
    if (colorRing) {
      evidenceText += `\nRaw RGB ring: ${hex.match(/../g).join(' ')}`;
      if (colorRing.selected.direction !== 'none') {
        evidenceText += `\nRight byte rotation: ${colorRing.selected.hex.match(/../g).join(' ')} \u2192 ${colorRing.selected.color.css}`;
      }
    }

    findings.push({
      detectorId: 'line-word-count-parity',
      method,
      type: 'Structural Watermark',
      kind: 'lead',
      payload,
      rawBits: blockEvidence.map(block => block.bits).join(' '),
      confidence: score,
      details,
      scope: `lines ${run.startLine}\u2013${run.endLine}`,
      evidenceText,
      evidence: {
        assumption: 'Unicode words; internal apostrophes and hyphens remain part of one word; even=0; odd=1',
        bits,
        blockCount: run.blockCount,
        blockSize: run.blockSize,
        blocks: blockEvidence,
        color,
        colorRing,
        rawColor,
        rawPayload: hex ? `${bits.length === 24 ? '#' : '0x'}${hex}` : null,
        invertedBits,
        invertedColor,
        invertedPayload: invertedColor ? invertedColor.css : (invertedHex ? `${bits.length === 24 ? '#' : '0x'}${invertedHex}` : null),
        yearCue
      }
    });
  }

  return findings;
}

function alphanumericPayload(payload) {
  return String(payload || '').replace(/[^\p{L}\p{N}]+/gu, '');
}

function isLowInformationPayload(payload) {
  const clean = alphanumericPayload(payload).toUpperCase();
  if (clean.length < 3) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  const counts = new Map();
  for (const character of clean) counts.set(character, (counts.get(character) || 0) + 1);
  const dominant = Math.max(...counts.values()) / clean.length;
  return clean.length >= 6 && (counts.size <= 2 || dominant > 0.65);
}

function hasUnsafeDecodeCharacters(payload) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/.test(String(payload || ''));
}

function inferKind(finding, score) {
  if (finding.kind && KIND_ORDER[finding.kind] !== undefined) return finding.kind;
  if (OBSERVATION_METHOD.test(finding.method || '')) return 'observation';
  if (DETERMINISTIC_METHOD.test(finding.method || '')) return 'decoded';
  if (AMBIGUOUS_METHOD.test(finding.method || '')) return score >= 55 ? 'decoded' : 'lead';
  return score >= 55 ? 'decoded' : 'lead';
}

function shouldKeepFinding(finding) {
  if (finding.kind === 'observation') return true;
  if (finding.detectorId === 'line-word-count-parity') return true;
  if (hasUnsafeDecodeCharacters(finding.payload)) return false;
  if (finding.kind === 'decoded' && DETERMINISTIC_METHOD.test(finding.method || '')) return true;
  if (isLowInformationPayload(finding.payload)) return false;
  if (finding.kind === 'lead') return finding.confidence >= 38;
  return finding.confidence >= 45;
}

export function finalizeFindings(rawFindings) {
  const seen = new Set();
  const findings = [];

  for (const raw of rawFindings || []) {
    const score = Math.max(0, Math.min(100, Math.round(Number(raw.confidence) || 0)));
    const finding = {
      ...raw,
      confidence: score,
      kind: inferKind(raw, score)
    };
    if (!shouldKeepFinding(finding)) continue;

    const signature = `${finding.detectorId || finding.method}\u0000${finding.payload}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    findings.push(finding);
  }

  findings.sort((left, right) => {
    const kindDelta = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
    return kindDelta || right.confidence - left.confidence || left.method.localeCompare(right.method);
  });
  return findings;
}

export function summarizeFindings(findings) {
  const summary = { decoded: 0, lead: 0, observation: 0, total: 0 };
  for (const finding of findings || []) {
    if (summary[finding.kind] !== undefined) summary[finding.kind]++;
    summary.total++;
  }
  return summary;
}
