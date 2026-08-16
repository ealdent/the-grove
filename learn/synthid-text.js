import {
  adjustTemperature,
  advanceTournamentDistribution,
  confusionAtThreshold,
  contextSeedsForSequence,
  generateSequence,
  gValue,
  replaceTokens,
  runTournament,
  scoreEvidence,
  simulateMarginals,
  simulateScoreDistributions
} from './synthid-text-lab.js';

const BASE_TOKENS = [
  { label: 'mango', probability: 0.52 },
  { label: 'banana', probability: 0.28 },
  { label: 'guava', probability: 0.14 },
  { label: 'papaya', probability: 0.06 }
];
const PAPER_TOKENS = [
  { label: 'mango', probability: 0.5 },
  { label: 'lychee', probability: 0.3 },
  { label: 'papaya', probability: 0.15 },
  { label: 'durian', probability: 0.05 }
];
const G_LAYERS = [[1, 0, 0, 1], [0, 1, 0, 0], [1, 0, 1, 0]];
const CONTEXTS = {
  orchard: { seed: 0x4f524348, copy: '“The light pooled in the orchard …”' },
  market: { seed: 0x4d41524b, copy: '“We found the last basket at the market …”' },
  recipe: { seed: 0x52454350, copy: '“Fold the bright fruit into the recipe …”' }
};
const OPEN_DISTRIBUTION = [0.44, 0.27, 0.18, 0.11];
const TIGHT_DISTRIBUTION = [0.97, 0.015, 0.01, 0.005];
const MATCHING_KEY = 0x51d7;
const WRONG_KEY = 0xa1b2;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let motionPaused = reducedMotionQuery.matches;
let heroController = null;
let vectorStage = 0;
let tournamentRun = 1;
let selectedContext = 'orchard';
let selectedKey = MATCHING_KEY;
let selectedDetectorKey = 'match';
let selectedEntropy = 'open';
let ensemble = null;
let scoreChart = null;
let ensembleTimer = 0;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const average = values => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const escapeHtml = value => String(value).replace(/[&<>"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
})[character]);

function setPressed(buttons, activeButton) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button === activeButton));
}

function renderProbabilityLab() {
  const bars = $('#token-bars');
  const slider = $('#temperature');
  const value = $('#temperature-value');
  const summary = $('#temperature-summary');
  if (!bars || !slider || !value || !summary) return;
  if (!bars.children.length) {
    bars.innerHTML = BASE_TOKENS.map((token, index) => `
      <div class="token-row">
        <span class="token-name">${escapeHtml(token.label)}</span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" data-bar="${index}"></span></span>
        <span class="token-value" data-value="${index}"></span>
      </div>`).join('');
  }
  const temperature = Number(slider.value);
  const adjusted = adjustTemperature(BASE_TOKENS.map(token => token.probability), temperature);
  value.value = temperature.toFixed(2);
  value.textContent = temperature.toFixed(2);
  adjusted.forEach((probability, index) => {
    bars.querySelector(`[data-bar="${index}"]`)?.style.setProperty('--probability', probability.toFixed(6));
    const label = bars.querySelector(`[data-value="${index}"]`);
    if (label) label.textContent = percent(probability);
  });
  const description = temperature < 0.85
    ? 'concentrated, so fewer alternatives can carry watermark evidence'
    : temperature > 1.15
      ? 'spread out, so more alternatives can carry watermark evidence'
      : 'close to the base distribution';
  summary.textContent = `At T = ${temperature.toFixed(2)}, the distribution is ${description}. Mango has ${percent(adjusted[0])} probability, and all four probabilities still total 100%.`;
}

function setupProbabilityLab() {
  $('#temperature')?.addEventListener('input', renderProbabilityLab);
  renderProbabilityLab();
}

function renderGValues() {
  const context = CONTEXTS[selectedContext];
  const grid = $('#g-grid');
  if (!context || !grid) return;
  $('#g-context-copy').textContent = context.copy;
  grid.innerHTML = PAPER_TOKENS.map((token, tokenIndex) => {
    const bits = Array.from({ length: 3 }, (_, layer) => gValue(tokenIndex, context.seed, layer, selectedKey));
    return `<div class="g-cell" role="listitem">
      <span class="g-token">${escapeHtml(token.label)}</span>
      <span class="g-bits" aria-label="g-values ${bits.join(', ')}">
        ${bits.map(bit => `<span class="g-bit" data-value="${bit}">${bit}</span>`).join('')}
      </span>
    </div>`;
  }).join('');
  $('#g-summary').textContent = `${selectedKey === MATCHING_KEY ? 'Key A' : 'Key B'} and this context produce three bits per token. The same inputs reproduce these bits; changing the key or context recalculates them. These are educational values, not Google’s private values.`;
}

function setupGValueLab() {
  const contextButtons = $$('#context-controls [data-context]');
  const keyButtons = $$('#key-controls [data-key]');
  for (const button of contextButtons) {
    button.addEventListener('click', () => {
      selectedContext = button.dataset.context;
      setPressed(contextButtons, button);
      renderGValues();
    });
  }
  for (const button of keyButtons) {
    button.addEventListener('click', () => {
      selectedKey = Number(button.dataset.key);
      setPressed(keyButtons, button);
      renderGValues();
    });
  }
  renderGValues();
}

function renderTournament() {
  const result = runTournament({
    probabilities: PAPER_TOKENS.map(token => token.probability),
    labels: PAPER_TOKENS.map(token => token.label),
    layers: 3,
    contextSeed: CONTEXTS[selectedContext].seed,
    samplingSeed: 90 + tournamentRun,
    key: selectedKey
  });
  const board = $('#tournament-board');
  if (!board) return;
  const candidateColumn = `<div class="round-column"><span class="round-label">8 base draws</span>
    ${result.candidates.map(candidate => `<div class="candidate"><strong>${escapeHtml(candidate.label)}</strong>p = ${candidate.probability.toFixed(2)}</div>`).join('')}
  </div>`;
  const roundColumns = result.rounds.map((round, index) => `<div class="round-column">
    <span class="round-label">${index === result.rounds.length - 1 ? 'Final winner' : `Layer ${index + 1}`}</span>
    ${round.map(match => `<div class="candidate winner"><strong>${escapeHtml(match.winner.label)}</strong>
      <span class="decision">${escapeHtml(match.left.label)}:${match.leftG} · ${escapeHtml(match.right.label)}:${match.rightG}</span></div>`).join('')}
  </div>`).join('');
  board.innerHTML = candidateColumn + roundColumns;
  $('#tournament-seed').textContent = `Run ${String(tournamentRun).padStart(2, '0')}`;
  $('#tournament-result').textContent = `${result.winner.label} is emitted after surviving with g-values ${result.winnerEvidence.join(', ')}. Another run starts with eight new draws, so it may emit a different token.`;
}

function setupTournamentLab() {
  $('#run-tournament')?.addEventListener('click', () => {
    tournamentRun += 1;
    renderTournament();
  });
  renderTournament();
}

function vectorDistributions() {
  const distributions = [PAPER_TOKENS.map(token => token.probability)];
  for (const bits of G_LAYERS) distributions.push(advanceTournamentDistribution(distributions.at(-1), bits));
  return distributions;
}

function renderVectorStage() {
  const current = vectorDistributions()[vectorStage];
  const stage = $('#vector-stage');
  if (!stage) return;
  stage.innerHTML = PAPER_TOKENS.map((token, index) => `<div class="vector-row">
    <span class="vector-token">${escapeHtml(token.label)}</span>
    <span class="bar-track" aria-hidden="true"><span class="vector-bar" style="--value:${current[index].toFixed(6)}"></span></span>
    <span class="vector-value">${current[index].toFixed(3)}</span>
  </div>`).join('');
  $('#vector-stage-label').textContent = vectorStage === 0 ? 'Base distribution' : `After g-layer ${vectorStage}`;
  $('#vector-back').disabled = vectorStage === 0;
  $('#vector-next').disabled = vectorStage === G_LAYERS.length;
  if (vectorStage === 0) {
    $('#vector-summary').textContent = 'Start with p⁽⁰⁾ = (.50, .30, .15, .05). This is the distribution entering the watermark sampler.';
  } else {
    const previous = vectorDistributions()[vectorStage - 1];
    const bits = G_LAYERS[vectorStage - 1];
    const markedMass = previous.reduce((sum, probability, index) => sum + probability * bits[index], 0);
    const markedFactor = 2 - markedMass;
    const unmarkedFactor = 1 - markedMass;
    $('#vector-summary').textContent = `Layer ${vectorStage}: G = ${markedMass.toFixed(3)}. Tokens with g = 1 are multiplied by ${markedFactor.toFixed(3)}; tokens with g = 0 are multiplied by ${unmarkedFactor.toFixed(3)}. The four updated probabilities total 1.`;
  }
}

function setupVectorLab() {
  $('#vector-next')?.addEventListener('click', () => {
    vectorStage = Math.min(G_LAYERS.length, vectorStage + 1);
    renderVectorStage();
  });
  $('#vector-back')?.addEventListener('click', () => {
    vectorStage = Math.max(0, vectorStage - 1);
    renderVectorStage();
  });
  renderVectorStage();
}

function renderMarginals(trials) {
  const result = simulateMarginals({
    probabilities: PAPER_TOKENS.map(token => token.probability),
    layers: 3,
    trials,
    key: MATCHING_KEY,
    seed: 144
  });
  $('#marginal-count').textContent = `${trials.toLocaleString()} trials`;
  $('#marginal-bars').innerHTML = PAPER_TOKENS.map((token, index) => `<div class="compare-row">
    <span class="compare-token">${escapeHtml(token.label)}</span>
    <span class="dual-track" aria-hidden="true">
      <span class="dual-bar expected" style="--value:${result.expected[index].toFixed(6)}"></span>
      <span class="dual-bar observed" style="--value:${result.observed[index].toFixed(6)}"></span>
    </span>
    <span class="compare-value">${percent(result.observed[index])}</span>
  </div>`).join('');
  const maximumError = Math.max(...result.observed.map((value, index) => Math.abs(value - result.expected[index])));
  $('#marginal-summary').textContent = `The largest difference between a winner frequency and its base probability is ${percent(maximumError, 2)}. More trials reduce random sampling error. The theorem provides the proof; this lab shows the convergence.`;
}

function setupMarginalLab() {
  const controls = $$('#trial-controls [data-trials]');
  for (const button of controls) {
    button.addEventListener('click', () => {
      setPressed(controls, button);
      renderMarginals(Number(button.dataset.trials));
    });
  }
  renderMarginals(100);
}

const detectorSequence = generateSequence({
  probabilities: OPEN_DISTRIBUTION,
  length: 18,
  layers: 3,
  key: MATCHING_KEY,
  seed: 901,
  promptSeed: 0x5eed,
  contextWindow: 2,
  watermarked: true
});

function renderDetector() {
  const key = selectedDetectorKey === 'match' ? MATCHING_KEY : WRONG_KEY;
  const maskRepeatedContexts = Boolean($('#mask-repeats')?.checked);
  const evidence = scoreEvidence({ ...detectorSequence, layers: 3, key, maskRepeatedContexts });
  $('#detector-strip').innerHTML = evidence.steps.map(step => `<span class="evidence-token${step.masked ? ' masked' : ''}" title="${step.masked ? 'Repeated context excluded' : `g = ${step.gValues.join('')}`}">
    <strong>${escapeHtml(PAPER_TOKENS[step.tokenId].label.slice(0, 3))}</strong><small>${step.masked ? 'mask' : step.gValues.join('')}</small>
  </span>`).join('');
  const score = evidence.score ?? 0;
  $('#detector-score').textContent = score.toFixed(3);
  $('#detector-score-fill').style.setProperty('--score', score.toFixed(6));
  $('#detector-count').textContent = `${evidence.evidenceValues} evidence bits · ${evidence.scoredTokens} tokens`;
  const keyCopy = selectedDetectorKey === 'match' ? 'matching' : 'wrong';
  const comparison = score >= 0.5 ? `${(score - 0.5).toFixed(3)} above` : `${(0.5 - score).toFixed(3)} below`;
  $('#detector-summary').textContent = `The ${keyCopy} key reconstructs a mean g-score of ${score.toFixed(3)}, which is ${comparison} the toy null expectation of 0.500. A positive decision would still require a length-specific calibrated threshold.`;
}

function setupDetectorLab() {
  const controls = $$('#detector-key-controls [data-detector-key]');
  for (const button of controls) {
    button.addEventListener('click', () => {
      selectedDetectorKey = button.dataset.detectorKey;
      setPressed(controls, button);
      renderDetector();
    });
  }
  $('#mask-repeats')?.addEventListener('change', renderDetector);
  renderDetector();
}

function createHistogram(canvas) {
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return null;
  let latestSeries = null;
  const draw = series => {
    latestSeries = series || latestSeries;
    if (!latestSeries) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const padding = { top: 22, right: 18, bottom: 34, left: 38 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const min = 0.32;
    const max = 0.96;
    const bins = 18;
    const binSeries = latestSeries.map(item => {
      const counts = Array(bins).fill(0);
      for (const value of item.values) {
        const index = Math.max(0, Math.min(bins - 1, Math.floor(((value - min) / (max - min)) * bins)));
        counts[index] += 1;
      }
      return { ...item, counts };
    });
    const largest = Math.max(1, ...binSeries.flatMap(item => item.counts));
    context.strokeStyle = 'rgba(177,196,255,0.14)';
    context.lineWidth = 1;
    context.font = '10px DM Mono, monospace';
    context.fillStyle = '#707a99';
    context.textAlign = 'center';
    for (let tick = 0; tick <= 4; tick++) {
      const x = padding.left + (plotWidth * tick) / 4;
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, padding.top + plotHeight);
      context.stroke();
      context.fillText((min + ((max - min) * tick) / 4).toFixed(2), x, height - 12);
    }
    for (const item of binSeries) {
      context.beginPath();
      item.counts.forEach((count, index) => {
        const x = padding.left + ((index + 0.5) / bins) * plotWidth;
        const y = padding.top + plotHeight - (count / largest) * plotHeight;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = item.color;
      context.lineWidth = 2;
      context.stroke();
    }
    context.textAlign = 'left';
    binSeries.forEach((item, index) => {
      const x = padding.left + index * Math.min(145, plotWidth / 3);
      context.fillStyle = item.color;
      context.fillRect(x, 8, 12, 2);
      context.fillStyle = '#a8b0c9';
      context.fillText(item.label, x + 17, 12);
    });
    canvas.setAttribute('aria-label', `Score distributions. ${binSeries.map(item => `${item.label} mean ${average(item.values).toFixed(3)}`).join('; ')}.`);
  };
  const observer = new ResizeObserver(() => draw());
  observer.observe(canvas);
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  return { draw };
}

function renderEvidenceLab() {
  const length = Number($('#evidence-length').value);
  const probabilities = selectedEntropy === 'open' ? OPEN_DISTRIBUTION : TIGHT_DISTRIBUTION;
  ensemble = simulateScoreDistributions({
    probabilities,
    samples: 96,
    length,
    layers: 3,
    key: MATCHING_KEY,
    seed: 8128,
    contextWindow: 4
  });
  const descriptors = [
    { key: 'unwatermarked', label: 'No watermark', color: '#9d8cff' },
    { key: 'watermarked', label: 'Matching key', color: '#65e4ac' },
    { key: 'wrongKey', label: 'Wrong key', color: '#f8c66d' }
  ];
  scoreChart?.draw(descriptors.map(item => ({ ...item, values: ensemble[item.key] })));
  $('#score-stats').innerHTML = descriptors.map(item => `<div class="stat-card"><span>${escapeHtml(item.label)} mean</span><strong>${average(ensemble[item.key]).toFixed(3)}</strong></div>`).join('');
  $('#evidence-length-value').value = String(length);
  $('#evidence-length-value').textContent = String(length);
  $('#evidence-status').textContent = `${length} tokens · ${selectedEntropy === 'open' ? 'probabilities spread out' : 'one token near 100%'}`;
  const separation = average(ensemble.watermarked) - average(ensemble.unwatermarked);
  $('#score-summary').textContent = selectedEntropy === 'open'
    ? `The matching-key mean is ${separation.toFixed(3)} above the unmarked mean in this fixed simulation. Increase length to see the score curves narrow and overlap less.`
    : `With one token near 100%, the matching-key mean is only ${separation.toFixed(3)} above the unmarked mean. Repeated candidate draws usually select the same token, so the tournament rarely changes the output.`;
  renderThresholdLab();
}

function scheduleEvidenceLab() {
  window.clearTimeout(ensembleTimer);
  ensembleTimer = window.setTimeout(renderEvidenceLab, 70);
}

function setupEvidenceLab() {
  scoreChart = createHistogram($('#score-chart'));
  $('#evidence-length')?.addEventListener('input', event => {
    $('#evidence-length-value').textContent = event.target.value;
    scheduleEvidenceLab();
  });
  const controls = $$('#entropy-controls [data-entropy]');
  for (const button of controls) {
    button.addEventListener('click', () => {
      selectedEntropy = button.dataset.entropy;
      setPressed(controls, button);
      renderEvidenceLab();
    });
  }
  renderEvidenceLab();
}

function renderThresholdLab() {
  if (!ensemble) return;
  const threshold = Number($('#threshold').value);
  const useAbstention = Boolean($('#use-abstention').checked);
  const abstainBelow = useAbstention ? Math.max(0, threshold - 0.06) : null;
  const result = confusionAtThreshold({
    positiveScores: ensemble.watermarked,
    negativeScores: ensemble.unwatermarked,
    threshold,
    abstainBelow
  });
  $('#threshold-value').value = threshold.toFixed(3);
  $('#threshold-value').textContent = threshold.toFixed(3);
  $('#threshold-value-label').textContent = `Positive at ${threshold.toFixed(3)}`;
  $('#confusion-grid').innerHTML = `
    <span class="matrix-head"></span><span class="matrix-head">Positive</span><span class="matrix-head">Abstain</span><span class="matrix-head">Negative</span>
    <span class="matrix-head">Marked</span>
    <span class="matrix-cell good"><strong>${result.truePositive}</strong><span>true positive</span></span>
    <span class="matrix-cell abstain"><strong>${result.positiveAbstain}</strong><span>uncertain</span></span>
    <span class="matrix-cell warn"><strong>${result.falseNegative}</strong><span>missed</span></span>
    <span class="matrix-head">No mark</span>
    <span class="matrix-cell warn"><strong>${result.falsePositive}</strong><span>false positive</span></span>
    <span class="matrix-cell abstain"><strong>${result.negativeAbstain}</strong><span>uncertain</span></span>
    <span class="matrix-cell good"><strong>${result.trueNegative}</strong><span>true negative</span></span>`;
  const tpr = result.truePositive / ensemble.watermarked.length;
  const fpr = result.falsePositive / ensemble.unwatermarked.length;
  const abstained = result.positiveAbstain + result.negativeAbstain;
  $('#threshold-summary').textContent = `In this simulated population, the threshold finds ${percent(tpr)} of marked passages and incorrectly flags ${percent(fpr)} of unmarked passages. It withholds ${abstained} of ${ensemble.watermarked.length + ensemble.unwatermarked.length} passages as uncertain.`;
}

function setupThresholdLab() {
  $('#threshold')?.addEventListener('input', renderThresholdLab);
  $('#use-abstention')?.addEventListener('change', renderThresholdLab);
}

const editSequence = generateSequence({
  probabilities: OPEN_DISTRIBUTION,
  length: 40,
  layers: 3,
  key: MATCHING_KEY,
  seed: 1181,
  promptSeed: 0x5eed,
  contextWindow: 4,
  watermarked: true
});

function renderEditLab() {
  const rate = Number($('#edit-rate').value);
  const edited = replaceTokens({ tokenIds: editSequence.tokenIds, vocabularySize: PAPER_TOKENS.length, rate, seed: 77 });
  const editedContexts = contextSeedsForSequence(edited.tokenIds, { promptSeed: 0x5eed, contextWindow: 4 });
  const originalEvidence = scoreEvidence({ ...editSequence, layers: 3, key: MATCHING_KEY, maskRepeatedContexts: true });
  const editedEvidence = scoreEvidence({
    tokenIds: edited.tokenIds,
    contextSeeds: editedContexts,
    layers: 3,
    key: MATCHING_KEY,
    maskRepeatedContexts: true
  });
  const originalScore = originalEvidence.score ?? 0;
  const editedScore = editedEvidence.score ?? 0;
  const changed = new Set(edited.changedIndices);
  $('#edit-rate-value').value = percent(rate, 0);
  $('#edit-rate-value').textContent = percent(rate, 0);
  $('#edit-label').textContent = `${percent(rate, 0)} replaced`;
  $('#original-edit-score').textContent = originalScore.toFixed(3);
  $('#edited-score').textContent = editedScore.toFixed(3);
  $('#edited-sequence').innerHTML = edited.tokenIds.map((tokenId, index) => `<span class="edited-token${changed.has(index) ? ' changed' : ''}">${escapeHtml(PAPER_TOKENS[tokenId].label.slice(0, 3))}</span>`).join('');
  const direction = editedScore < originalScore ? 'fell' : editedScore > originalScore ? 'rose' : 'did not change';
  $('#edit-summary').textContent = `${edited.changedIndices.length} of ${edited.tokenIds.length} tokens changed. After rebuilding every affected context, this sample’s score ${direction} from ${originalScore.toFixed(3)} to ${editedScore.toFixed(3)}. One passage cannot establish an edit-resistance rate; that requires many samples.`;
}

function setupEditLab() {
  $('#edit-rate')?.addEventListener('input', renderEditLab);
  renderEditLab();
}

function setupNavigation() {
  const progress = $('#lesson-progress');
  const navLinks = $$('#chapter-rail a[href^="#"]');
  const sectionById = new Map(navLinks.map(link => [link.hash.slice(1), link]));
  const updateProgress = () => {
    const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / available));
    progress?.style.setProperty('transform', `scaleX(${ratio})`);
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const link of navLinks) link.removeAttribute('aria-current');
    const active = sectionById.get(visible.target.id);
    active?.setAttribute('aria-current', 'true');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.2, 0.5] });
  for (const id of sectionById.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

async function createHeroField() {
  const canvas = $('#signal-field');
  const hero = $('.hero');
  if (!canvas || !hero) return null;
  let THREE;
  try {
    THREE = await import('three');
  } catch (error) {
    canvas.hidden = true;
    document.documentElement.classList.add('webgl-fallback');
    return null;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (error) {
    canvas.hidden = true;
    document.documentElement.classList.add('webgl-fallback');
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x050711, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 0, 9);
  const count = window.innerWidth < 640 ? 720 : 1450;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let visualSeed = 0xdecafbad;
  const random = () => {
    visualSeed = (Math.imul(1664525, visualSeed) + 1013904223) >>> 0;
    return visualSeed / 4294967296;
  };
  for (let index = 0; index < count; index++) {
    const radius = 1.1 + random() * 7.5;
    const angle = random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (random() - 0.5) * 10;
    positions[index * 3 + 2] = (random() - 0.5) * 12;
    seeds[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      precision highp float;
      attribute float aSeed;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uPixelRatio;
      varying float vSeed;
      void main() {
        vec3 p = position;
        float phase = aSeed * 6.2831853;
        p.x += sin(uTime * (0.08 + aSeed * 0.12) + phase) * 0.45;
        p.y += cos(uTime * (0.06 + aSeed * 0.08) + phase * 1.7) * 0.34;
        p.xy += uPointer * (0.16 + aSeed * 0.24);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float pointScale = (18.0 + aSeed * 32.0) * uPixelRatio / max(1.0, -mv.z);
        gl_PointSize = clamp(pointScale, 1.0, 13.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
        vSeed = aSeed;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vSeed;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point);
        float core = smoothstep(0.22, 0.0, radius);
        float ring = smoothstep(0.48, 0.38, radius) * smoothstep(0.30, 0.38, radius);
        float alpha = core * 0.82 + ring * 0.48;
        if (alpha < 0.02) discard;
        vec3 cyan = vec3(0.40, 0.91, 0.98);
        vec3 violet = vec3(0.62, 0.55, 1.0);
        vec3 color = mix(violet, cyan, vSeed);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `
  });
  const points = new THREE.Points(geometry, material);
  points.rotation.z = -0.12;
  scene.add(points);
  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    renderer.render(scene, camera);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const pointerTarget = new THREE.Vector2();
  const onPointer = event => pointerTarget.set((event.clientX / window.innerWidth - 0.5) * 2, (0.5 - event.clientY / window.innerHeight) * 2);
  window.addEventListener('pointermove', onPointer, { passive: true });
  let heroVisible = true;
  let frame = 0;
  let elapsed = 0;
  let previousTimestamp = null;
  const shouldAnimate = () => !motionPaused && !document.hidden && heroVisible;
  const draw = timestamp => {
    frame = 0;
    if (!shouldAnimate()) return;
    if (previousTimestamp !== null) elapsed += Math.min(0.05, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPointer.value.lerp(pointerTarget, 0.035);
    points.rotation.y = Math.sin(elapsed * 0.08) * 0.08;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };
  const sync = () => {
    if (shouldAnimate() && !frame) {
      previousTimestamp = null;
      frame = requestAnimationFrame(draw);
    } else if (!shouldAnimate() && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  const visibilityObserver = new IntersectionObserver(entries => {
    heroVisible = entries[0]?.isIntersecting ?? false;
    sync();
  }, { threshold: 0.01 });
  visibilityObserver.observe(hero);
  const onVisibility = sync;
  document.addEventListener('visibilitychange', onVisibility);
  renderer.render(scene, camera);
  sync();
  const onContextLost = event => {
    event.preventDefault();
    canvas.hidden = true;
    document.documentElement.classList.add('webgl-fallback');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const step = seconds => {
    elapsed += Math.max(0, Number(seconds) || 0);
    material.uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
  };
  const dispose = () => {
    if (frame) cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return { dispose, renderer, step, sync };
}

function updateMotionControl() {
  const button = $('#motion-toggle');
  if (!button) return;
  button.setAttribute('aria-pressed', String(motionPaused));
  button.textContent = motionPaused ? 'Resume motion' : 'Pause motion';
  heroController?.sync();
}

function setupMotionControl() {
  $('#motion-toggle')?.addEventListener('click', () => {
    motionPaused = !motionPaused;
    updateMotionControl();
  });
  reducedMotionQuery.addEventListener?.('change', event => {
    motionPaused = event.matches;
    updateMotionControl();
  });
  updateMotionControl();
}

function resetLabs() {
  $('#temperature').value = '1';
  $('#evidence-length').value = '64';
  $('#threshold').value = '0.65';
  $('#edit-rate').value = '0';
  $('#mask-repeats').checked = true;
  $('#use-abstention').checked = true;
  selectedContext = 'orchard';
  selectedKey = MATCHING_KEY;
  selectedDetectorKey = 'match';
  selectedEntropy = 'open';
  vectorStage = 0;
  tournamentRun = 1;
  const activate = (selector, predicate) => {
    const buttons = $$(selector);
    setPressed(buttons, buttons.find(predicate));
  };
  activate('#context-controls [data-context]', button => button.dataset.context === 'orchard');
  activate('#key-controls [data-key]', button => Number(button.dataset.key) === MATCHING_KEY);
  activate('#detector-key-controls [data-detector-key]', button => button.dataset.detectorKey === 'match');
  activate('#entropy-controls [data-entropy]', button => button.dataset.entropy === 'open');
  activate('#trial-controls [data-trials]', button => Number(button.dataset.trials) === 100);
  renderProbabilityLab();
  renderGValues();
  renderTournament();
  renderVectorStage();
  renderMarginals(100);
  renderDetector();
  renderEvidenceLab();
  renderEditLab();
}

setupProbabilityLab();
setupGValueLab();
setupTournamentLab();
setupVectorLab();
setupMarginalLab();
setupDetectorLab();
setupThresholdLab();
setupEvidenceLab();
setupEditLab();
setupNavigation();
setupMotionControl();
heroController = await createHeroField();
updateMotionControl();

window.__SYNTHID_TEXT_TUTORIAL__ = {
  version: 1,
  math: { adjustTemperature, advanceTournamentDistribution, runTournament, scoreEvidence, simulateMarginals, simulateScoreDistributions },
  pause(value = true) {
    motionPaused = Boolean(value);
    updateMotionControl();
  },
  reset: resetLabs,
  snapshot() {
    return {
      ready: true,
      motionPaused,
      temperature: Number($('#temperature')?.value || 1),
      vectorStage,
      tournamentRun,
      selectedContext,
      selectedKey,
      selectedDetectorKey,
      evidenceLength: Number($('#evidence-length')?.value || 64),
      selectedEntropy,
      threshold: Number($('#threshold')?.value || 0.65),
      editRate: Number($('#edit-rate')?.value || 0),
      webgl: Boolean(heroController),
      ensembleMeans: ensemble ? {
        watermarked: average(ensemble.watermarked),
        unwatermarked: average(ensemble.unwatermarked),
        wrongKey: average(ensemble.wrongKey)
      } : null
    };
  },
  step(seconds = 1 / 60) { heroController?.step(seconds); },
  selfTest() {
    const sum = adjustTemperature([0.5, 0.3, 0.15, 0.05], 1).reduce((total, value) => total + value, 0);
    const sample = runTournament({ probabilities: [0.5, 0.3, 0.15, 0.05], layers: 3, key: 7, contextSeed: 9, samplingSeed: 11 });
    return {
      probabilitiesNormalize: Math.abs(sum - 1) < 1e-12,
      tournamentHasEightCandidates: sample.candidates.length === 8,
      matchingMeanAboveNull: ensemble ? average(ensemble.watermarked) > average(ensemble.unwatermarked) : false,
      allAnchorTargetsExist: $$('a[href^="#"]').every(link => document.querySelector(link.hash))
    };
  }
};

document.documentElement.dataset.synthidReady = 'true';
window.dispatchEvent(new CustomEvent('synthid-tutorial-ready'));
