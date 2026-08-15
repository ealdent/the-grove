function normalize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError('A probability distribution needs positive finite mass.');
  }
  return values.map(value => value / total);
}

function validateProbabilities(probabilities) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) {
    throw new TypeError('Provide at least two token probabilities.');
  }
  if (probabilities.some(value => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Token probabilities must be finite and non-negative.');
  }
}

export function adjustTemperature(probabilities, temperature) {
  validateProbabilities(probabilities);
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new RangeError('Temperature must be greater than zero.');
  }
  const base = normalize(probabilities);
  return normalize(base.map(probability => probability ** (1 / temperature)));
}

export function advanceTournamentDistribution(probabilities, gBits) {
  validateProbabilities(probabilities);
  if (!Array.isArray(gBits) || gBits.length !== probabilities.length) {
    throw new TypeError('Provide one g-value for every token probability.');
  }
  if (gBits.some(value => value !== 0 && value !== 1)) {
    throw new RangeError('This educational tournament uses binary g-values.');
  }
  const distribution = normalize(probabilities);
  const markedMass = distribution.reduce(
    (sum, probability, index) => sum + probability * gBits[index],
    0
  );
  return normalize(
    distribution.map(
      (probability, index) => probability * (1 + gBits[index] - markedMass)
    )
  );
}

function mix32(value) {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function tupleHash(...values) {
  let hash = 0x9e3779b9;
  for (const value of values) {
    hash = mix32(hash ^ mix32(Number(value) >>> 0));
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = tupleHash(seed, 0xa511e9b3);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleCategorical(probabilities, random) {
  const target = random();
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index++) {
    cumulative += probabilities[index];
    if (target < cumulative || index === probabilities.length - 1) return index;
  }
  return probabilities.length - 1;
}

export function gValue(tokenIndex, contextSeed, layer, key) {
  return tupleHash(tokenIndex + 1, contextSeed, layer + 1, key) & 1;
}

export function scoreEvidence({
  tokenIds,
  contextSeeds,
  layers = 3,
  key = 1,
  maskRepeatedContexts = false
}) {
  if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
    throw new TypeError('Provide at least one generated token.');
  }
  if (!Array.isArray(contextSeeds) || contextSeeds.length !== tokenIds.length) {
    throw new TypeError('Provide one context seed for every token.');
  }
  if (!Number.isInteger(layers) || layers < 1 || layers > 64) {
    throw new RangeError('Detector layers must be an integer from 1 to 64.');
  }

  const seenContexts = new Set();
  const gValues = [];
  const steps = [];
  let total = 0;

  for (let index = 0; index < tokenIds.length; index++) {
    const contextSeed = contextSeeds[index];
    const masked = maskRepeatedContexts && seenContexts.has(contextSeed);
    seenContexts.add(contextSeed);
    const values = masked
      ? []
      : Array.from(
          { length: layers },
          (_, layer) => gValue(tokenIds[index], contextSeed, layer, key)
        );
    total += values.reduce((sum, value) => sum + value, 0);
    gValues.push(...values);
    steps.push({
      index,
      tokenId: tokenIds[index],
      contextSeed,
      masked,
      gValues: values,
      runningScore: gValues.length ? total / gValues.length : null
    });
  }

  return {
    steps,
    gValues,
    total,
    scoredTokens: steps.filter(step => !step.masked).length,
    evidenceValues: gValues.length,
    score: gValues.length ? total / gValues.length : null
  };
}

export function runTournament({
  probabilities,
  labels,
  layers = 3,
  contextSeed = 1,
  samplingSeed = 1,
  key = 1
}) {
  validateProbabilities(probabilities);
  if (!Number.isInteger(layers) || layers < 1 || layers > 6) {
    throw new RangeError('Tournament layers must be an integer from 1 to 6.');
  }
  const distribution = normalize(probabilities);
  const names = distribution.map((_, index) => labels?.[index] || `token ${index + 1}`);
  const random = createRng(tupleHash(samplingSeed, contextSeed, key));
  const candidateCount = 2 ** layers;
  const candidates = Array.from({ length: candidateCount }, (_, index) => {
    const tokenIndex = sampleCategorical(distribution, random);
    return {
      id: `candidate-${index + 1}`,
      label: names[tokenIndex],
      probability: distribution[tokenIndex],
      tokenIndex
    };
  });

  const rounds = [];
  let active = candidates;
  for (let layer = 0; layer < layers; layer++) {
    const matches = [];
    const winners = [];
    for (let index = 0; index < active.length; index += 2) {
      const left = active[index];
      const right = active[index + 1];
      const leftG = gValue(left.tokenIndex, contextSeed, layer, key);
      const rightG = gValue(right.tokenIndex, contextSeed, layer, key);
      let winner;
      if (leftG > rightG) winner = left;
      else if (rightG > leftG) winner = right;
      else winner = random() < 0.5 ? left : right;
      winners.push(winner);
      matches.push({ layer: layer + 1, left, leftG, right, rightG, winner });
    }
    rounds.push(matches);
    active = winners;
  }

  const winner = active[0];
  return {
    candidates,
    rounds,
    winner,
    winnerEvidence: Array.from(
      { length: layers },
      (_, layer) => gValue(winner.tokenIndex, contextSeed, layer, key)
    )
  };
}

function contextSeedFromHistory(history, promptSeed, contextWindow) {
  const recent = history.slice(-contextWindow);
  return tupleHash(promptSeed, recent.length, ...recent.map(token => token + 1));
}

export function contextSeedsForSequence(tokenIds, {
  promptSeed = 0x5eed,
  contextWindow = 4
} = {}) {
  if (!Array.isArray(tokenIds)) throw new TypeError('Provide a token sequence.');
  if (!Number.isInteger(contextWindow) || contextWindow < 1 || contextWindow > 64) {
    throw new RangeError('Context window must be an integer from 1 to 64.');
  }
  const history = [];
  return tokenIds.map(tokenId => {
    if (!Number.isInteger(tokenId) || tokenId < 0) {
      throw new RangeError('Token identifiers must be non-negative integers.');
    }
    const contextSeed = contextSeedFromHistory(history, promptSeed, contextWindow);
    history.push(tokenId);
    return contextSeed;
  });
}

export function generateSequence({
  probabilities,
  length = 48,
  layers = 3,
  key = 1,
  seed = 1,
  promptSeed = 0x5eed,
  contextWindow = 4,
  watermarked = true,
  maskRepeatedContexts = true
}) {
  validateProbabilities(probabilities);
  if (!Number.isInteger(length) || length < 1 || length > 10000) {
    throw new RangeError('Sequence length must be an integer from 1 to 10,000.');
  }
  if (!Number.isInteger(contextWindow) || contextWindow < 1 || contextWindow > 64) {
    throw new RangeError('Context window must be an integer from 1 to 64.');
  }
  const distribution = normalize(probabilities);
  const tokenIds = [];
  const contextSeeds = [];
  const repeatedContexts = [];
  const watermarkedPositions = [];
  const seenContexts = new Set();

  for (let position = 0; position < length; position++) {
    const contextSeed = contextSeedFromHistory(tokenIds, promptSeed, contextWindow);
    const repeatedContext = seenContexts.has(contextSeed);
    const applyWatermark = watermarked && !(maskRepeatedContexts && repeatedContext);
    seenContexts.add(contextSeed);
    contextSeeds.push(contextSeed);
    repeatedContexts.push(repeatedContext);
    watermarkedPositions.push(applyWatermark);
    let tokenIndex;
    if (applyWatermark) {
      tokenIndex = runTournament({
        probabilities: distribution,
        layers,
        contextSeed,
        samplingSeed: tupleHash(seed, position + 1),
        key
      }).winner.tokenIndex;
    } else {
      const random = createRng(tupleHash(seed, position + 1, contextSeed, 0x6e756c6c));
      tokenIndex = sampleCategorical(distribution, random);
    }
    tokenIds.push(tokenIndex);
  }

  return { tokenIds, contextSeeds, repeatedContexts, watermarkedPositions };
}

export function simulateScoreDistributions({
  probabilities,
  samples = 80,
  length = 64,
  layers = 3,
  key = 1,
  seed = 1,
  contextWindow = 4
}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 2000) {
    throw new RangeError('Sample count must be an integer from 1 to 2,000.');
  }
  const watermarked = [];
  const unwatermarked = [];
  const wrongKey = [];
  for (let sample = 0; sample < samples; sample++) {
    const sampleSeed = tupleHash(seed, sample + 1);
    const promptSeed = tupleHash(seed, sample + 1, 0x50524f4d);
    const markedSequence = generateSequence({
      probabilities,
      length,
      layers,
      key,
      seed: sampleSeed,
      promptSeed,
      contextWindow,
      watermarked: true
    });
    const nullSequence = generateSequence({
      probabilities,
      length,
      layers,
      key,
      seed: tupleHash(sampleSeed, 0x4e554c4c),
      promptSeed,
      contextWindow,
      watermarked: false
    });
    watermarked.push(scoreEvidence({
      ...markedSequence,
      layers,
      key,
      maskRepeatedContexts: true
    }).score);
    unwatermarked.push(scoreEvidence({
      ...nullSequence,
      layers,
      key,
      maskRepeatedContexts: true
    }).score);
    wrongKey.push(scoreEvidence({
      ...markedSequence,
      layers,
      key: tupleHash(key, 0x57524f4e),
      maskRepeatedContexts: true
    }).score);
  }
  return { watermarked, unwatermarked, wrongKey };
}

export function simulateMarginals({
  probabilities,
  layers = 3,
  trials = 10000,
  key = 1,
  seed = 1
}) {
  validateProbabilities(probabilities);
  if (!Number.isInteger(trials) || trials < 1 || trials > 1000000) {
    throw new RangeError('Trial count must be an integer from 1 to 1,000,000.');
  }
  const distribution = normalize(probabilities);
  const counts = distribution.map(() => 0);
  for (let trial = 0; trial < trials; trial++) {
    const contextSeed = tupleHash(seed, trial + 1, 0x43545854);
    const winner = runTournament({
      probabilities: distribution,
      layers,
      contextSeed,
      samplingSeed: tupleHash(seed, trial + 1, 0x44524157),
      key
    }).winner;
    counts[winner.tokenIndex] += 1;
  }
  return {
    counts,
    observed: counts.map(count => count / trials),
    expected: distribution
  };
}

export function detectorStatistic({
  hits,
  trials,
  nullRate = 0.5,
  minimumEvidence = 60
}) {
  if (!Number.isInteger(trials) || trials < 1) {
    throw new RangeError('Evidence trials must be a positive integer.');
  }
  if (!Number.isInteger(hits) || hits < 0 || hits > trials) {
    throw new RangeError('Hits must be an integer between zero and the trial count.');
  }
  if (!Number.isFinite(nullRate) || nullRate <= 0 || nullRate >= 1) {
    throw new RangeError('The null rate must be between zero and one.');
  }
  const expectedHits = trials * nullRate;
  return {
    rate: hits / trials,
    expectedHits,
    zScore: (hits - expectedHits) / Math.sqrt(trials * nullRate * (1 - nullRate)),
    sufficientEvidence: trials >= minimumEvidence
  };
}

export function replaceTokens({ tokenIds, vocabularySize, rate, seed = 1 }) {
  if (!Array.isArray(tokenIds)) throw new TypeError('Provide a token sequence.');
  if (!Number.isInteger(vocabularySize) || vocabularySize < 2) {
    throw new RangeError('Vocabulary size must be an integer of at least two.');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError('Edit rate must be between zero and one.');
  }
  if (tokenIds.some(token => !Number.isInteger(token) || token < 0 || token >= vocabularySize)) {
    throw new RangeError('Every token must be inside the vocabulary.');
  }

  const random = createRng(tupleHash(seed, tokenIds.length, vocabularySize));
  const shuffledIndices = tokenIds.map((_, index) => index);
  for (let index = shuffledIndices.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffledIndices[index], shuffledIndices[other]] = [shuffledIndices[other], shuffledIndices[index]];
  }
  const changedIndices = shuffledIndices.slice(0, Math.round(tokenIds.length * rate)).sort((a, b) => a - b);
  const edited = [...tokenIds];
  for (const index of changedIndices) {
    const offset = 1 + Math.floor(random() * (vocabularySize - 1));
    edited[index] = (edited[index] + offset) % vocabularySize;
  }
  return { tokenIds: edited, changedIndices };
}

export function confusionAtThreshold({
  positiveScores,
  negativeScores,
  threshold,
  abstainBelow = null
}) {
  if (!Array.isArray(positiveScores) || !Array.isArray(negativeScores)) {
    throw new TypeError('Provide positive and negative score arrays.');
  }
  if (!Number.isFinite(threshold)) throw new TypeError('Provide a finite threshold.');
  if (abstainBelow !== null && (!Number.isFinite(abstainBelow) || abstainBelow > threshold)) {
    throw new RangeError('The abstention boundary must not exceed the positive threshold.');
  }
  const classify = score => {
    if (!Number.isFinite(score)) throw new TypeError('Scores must be finite.');
    if (score >= threshold) return 'positive';
    if (abstainBelow !== null && score >= abstainBelow) return 'abstain';
    return 'negative';
  };
  const result = {
    truePositive: 0,
    falseNegative: 0,
    falsePositive: 0,
    trueNegative: 0,
    positiveAbstain: 0,
    negativeAbstain: 0,
    decided: 0
  };
  for (const score of positiveScores) {
    const label = classify(score);
    if (label === 'positive') result.truePositive += 1;
    else if (label === 'negative') result.falseNegative += 1;
    else result.positiveAbstain += 1;
  }
  for (const score of negativeScores) {
    const label = classify(score);
    if (label === 'positive') result.falsePositive += 1;
    else if (label === 'negative') result.trueNegative += 1;
    else result.negativeAbstain += 1;
  }
  result.decided = result.truePositive + result.falseNegative + result.falsePositive + result.trueNegative;
  return result;
}
