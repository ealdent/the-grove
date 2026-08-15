import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustTemperature,
  advanceTournamentDistribution,
  confusionAtThreshold,
  contextSeedsForSequence,
  detectorStatistic,
  generateSequence,
  replaceTokens,
  runTournament,
  scoreEvidence,
  simulateMarginals,
  simulateScoreDistributions
} from '../learn/synthid-text-lab.js';

test('temperature changes certainty while preserving a valid probability distribution', () => {
  const original = [0.52, 0.28, 0.14, 0.06];
  const colder = adjustTemperature(original, 0.55);
  const warmer = adjustTemperature(original, 1.8);

  assert.ok(Math.abs(colder.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.ok(Math.abs(warmer.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.ok(colder[0] > original[0]);
  assert.ok(warmer[0] < original[0]);
  assert.deepEqual(adjustTemperature(original, 1), original);
  assert.deepEqual(original, [0.52, 0.28, 0.14, 0.06]);
});

test('a tournament exposes every candidate, round, and keyed g-value deterministically', () => {
  const input = {
    probabilities: [0.44, 0.27, 0.18, 0.11],
    labels: ['mango', 'banana', 'guava', 'papaya'],
    layers: 3,
    contextSeed: 2024,
    samplingSeed: 91,
    key: 0x51d7
  };
  const first = runTournament(input);
  const second = runTournament(input);

  assert.deepEqual(second, first);
  assert.equal(first.candidates.length, 8);
  assert.deepEqual(first.rounds.map(round => round.length), [4, 2, 1]);
  assert.equal(first.winnerEvidence.length, 3);
  assert.ok(first.winnerEvidence.every(value => value === 0 || value === 1));
  assert.ok(first.candidates.some(candidate => candidate.id === first.winner.id));
  assert.equal(first.winner.label, input.labels[first.winner.tokenIndex]);
  for (const round of first.rounds) {
    for (const match of round) {
      assert.ok(match.winner.id === match.left.id || match.winner.id === match.right.id);
      assert.ok(match.leftG === 0 || match.leftG === 1);
      assert.ok(match.rightG === 0 || match.rightG === 1);
    }
  }
});

test('the vectorized tournament update reproduces the paper supplement example', () => {
  const base = [0.5, 0.3, 0.15, 0.05];
  const first = advanceTournamentDistribution(base, [1, 0, 0, 1]);
  const second = advanceTournamentDistribution(first, [0, 1, 0, 0]);
  const third = advanceTournamentDistribution(second, [1, 0, 1, 0]);

  const round = values => values.map(value => Math.round((value + Number.EPSILON) * 1000) / 1000);
  assert.deepEqual(round(first), [0.725, 0.135, 0.068, 0.073]);
  assert.deepEqual(round(second), [0.627, 0.252, 0.058, 0.063]);
  assert.deepEqual(round(third), [0.824, 0.079, 0.077, 0.02]);
  for (const distribution of [first, second, third]) {
    assert.ok(Math.abs(distribution.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  }
});

test('the detector recomputes keyed evidence and masks repeated contexts', () => {
  const tokenIds = [2, 1, 3, 0, 2];
  const contextSeeds = [17, 22, 17, 31, 44];
  const result = scoreEvidence({
    tokenIds,
    contextSeeds,
    layers: 3,
    key: 0x51d7,
    maskRepeatedContexts: true
  });

  assert.equal(result.steps.length, tokenIds.length);
  assert.equal(result.steps[2].masked, true);
  assert.equal(result.scoredTokens, 4);
  assert.equal(result.evidenceValues, 12);
  assert.equal(result.score, result.total / result.evidenceValues);
  assert.deepEqual(
    result.steps.filter(step => !step.masked).flatMap(step => step.gValues),
    result.gValues
  );
  assert.equal(result.steps.at(-1).runningScore, result.score);
  assert.notEqual(
    scoreEvidence({ tokenIds, contextSeeds, layers: 3, key: 0x51d8 }).score,
    result.score
  );
});

test('generation bypasses the tournament when a context repeats', () => {
  const masked = generateSequence({
    probabilities: [1, 0],
    length: 6,
    layers: 3,
    key: 0x51d7,
    seed: 91,
    contextWindow: 1,
    watermarked: true,
    maskRepeatedContexts: true
  });
  const unmasked = generateSequence({
    probabilities: [1, 0],
    length: 6,
    layers: 3,
    key: 0x51d7,
    seed: 91,
    contextWindow: 1,
    watermarked: true,
    maskRepeatedContexts: false
  });

  assert.deepEqual(masked.repeatedContexts, [false, false, true, true, true, true]);
  assert.deepEqual(masked.watermarkedPositions, [true, true, false, false, false, false]);
  assert.deepEqual(unmasked.watermarkedPositions, [true, true, true, true, true, true]);
});

test('the ensemble separates matching-key watermarks while a wrong key stays near null', () => {
  const input = {
    probabilities: [0.44, 0.27, 0.18, 0.11],
    samples: 96,
    length: 64,
    layers: 3,
    key: 0x51d7,
    seed: 8128
  };
  const first = simulateScoreDistributions(input);
  const second = simulateScoreDistributions(input);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  assert.deepEqual(second, first);
  assert.ok(mean(first.watermarked) > mean(first.unwatermarked) + 0.08);
  assert.ok(Math.abs(mean(first.unwatermarked) - 0.5) < 0.08);
  assert.ok(Math.abs(mean(first.wrongKey) - 0.5) < 0.08);
});

test('independent low-entropy prompts stay near the null and carry little watermark signal', () => {
  const result = simulateScoreDistributions({
    probabilities: [0.97, 0.015, 0.01, 0.005],
    samples: 96,
    length: 64,
    layers: 3,
    key: 0x51d7,
    seed: 8128
  });
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  assert.ok(Math.abs(mean(result.unwatermarked) - 0.5) < 0.08);
  assert.ok(Math.abs(mean(result.wrongKey) - 0.5) < 0.08);
  assert.ok(Math.abs(mean(result.watermarked) - mean(result.unwatermarked)) < 0.06);
});

test('averaging the non-distortionary tournament over randomized g-seeds preserves marginals', () => {
  const probabilities = [0.5, 0.3, 0.15, 0.05];
  const result = simulateMarginals({
    probabilities,
    layers: 3,
    trials: 12000,
    key: 0x51d7,
    seed: 144
  });

  assert.equal(result.counts.reduce((sum, value) => sum + value, 0), 12000);
  result.observed.forEach((value, index) => {
    assert.ok(Math.abs(value - probabilities[index]) < 0.018);
  });
});

test('the educational detector statistic exposes its Bernoulli null assumption', () => {
  const result = detectorStatistic({ hits: 9, trials: 12, nullRate: 0.5 });
  assert.equal(result.rate, 0.75);
  assert.equal(result.expectedHits, 6);
  assert.ok(Math.abs(result.zScore - Math.sqrt(3)) < 1e-12);
  assert.equal(result.sufficientEvidence, false);

  assert.equal(
    detectorStatistic({ hits: 42, trials: 60, minimumEvidence: 60 }).sufficientEvidence,
    true
  );
});

test('edit and threshold simulations are deterministic and account for abstentions', () => {
  const original = Array.from({ length: 20 }, (_, index) => index % 4);
  const firstEdit = replaceTokens({ tokenIds: original, vocabularySize: 4, rate: 0.25, seed: 77 });
  const secondEdit = replaceTokens({ tokenIds: original, vocabularySize: 4, rate: 0.25, seed: 77 });

  assert.deepEqual(secondEdit, firstEdit);
  assert.equal(firstEdit.changedIndices.length, 5);
  assert.equal(firstEdit.tokenIds.filter((token, index) => token !== original[index]).length, 5);
  assert.deepEqual(original, Array.from({ length: 20 }, (_, index) => index % 4));

  assert.deepEqual(
    confusionAtThreshold({
      positiveScores: [0.8, 0.7, 0.55, 0.4],
      negativeScores: [0.72, 0.5, 0.3, 0.1],
      threshold: 0.65,
      abstainBelow: 0.45
    }),
    {
      truePositive: 2,
      falseNegative: 1,
      falsePositive: 1,
      trueNegative: 2,
      positiveAbstain: 1,
      negativeAbstain: 1,
      decided: 6
    }
  );
});

test('edited tokens deterministically change the downstream context seeds a detector rebuilds', () => {
  const original = contextSeedsForSequence([1, 2, 3, 1, 2, 3], {
    promptSeed: 99,
    contextWindow: 2
  });
  const edited = contextSeedsForSequence([1, 0, 3, 1, 2, 3], {
    promptSeed: 99,
    contextWindow: 2
  });

  assert.deepEqual(contextSeedsForSequence([1, 2, 3, 1, 2, 3], {
    promptSeed: 99,
    contextWindow: 2
  }), original);
  assert.equal(edited[0], original[0]);
  assert.equal(edited[1], original[1]);
  assert.notEqual(edited[2], original[2]);
  assert.notEqual(edited[3], original[3]);
  assert.equal(edited[4], original[4]);
});
