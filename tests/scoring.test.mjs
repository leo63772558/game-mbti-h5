import test from 'node:test';
import assert from 'node:assert/strict';

import { GPTI_AXES, GPTI_POLES, GPTI_TYPES } from '../src/data/gpti.mjs';
import * as scoring from '../src/scoring.mjs';

function scoringExport(name) {
  assert.equal(typeof scoring[name], 'function', `${name} must be exported`);
  return scoring[name];
}

function answersForType(type) {
  return [...type].map((pole, index) => ({
    questionId: `q${index + 1}`,
    optionId: 'a',
    keywords: ['稳健'],
    poles: { [pole]: 2 },
  }));
}

test('computePoleScores accumulates selected option poles from stored answers and question config', () => {
  const computePoleScores = scoringExport('computePoleScores');
  const questions = [
    {
      id: 'q1',
      options: [
        { id: 'a', keywords: ['莽'], poles: { A: 2, T: 1 } },
        { id: 'b', keywords: ['稳健'], poles: { P: 2 } },
      ],
    },
    {
      id: 'q2',
      options: [{ id: 'a', keywords: ['推理'], poles: { T: 2, C: 1 } }],
    },
  ];
  const answers = [
    { questionId: 'q1', optionId: 'a' },
    { questionId: 'q2', optionId: 'a', poles: { I: 3, C: 2 } },
    { questionId: 'missing', optionId: 'a', poles: { W: 1 } },
  ];

  assert.deepEqual(computePoleScores(questions, answers), {
    A: 2,
    P: 0,
    T: 1,
    I: 3,
    R: 0,
    W: 1,
    B: 0,
    C: 2,
  });
});

test('resolveType compares the four GPTI axes into a standard type', () => {
  const resolveType = scoringExport('resolveType');
  const answers = [
    { questionId: 'q1', poles: { A: 3, P: 1 } },
    { questionId: 'q2', poles: { T: 1, I: 4 } },
    { questionId: 'q3', poles: { R: 2 } },
    { questionId: 'q4', poles: { B: 1, C: 5 } },
  ];

  assert.equal(resolveType([], answers), 'AIRC');
});

test('resolveAxis uses the last decisive answer as tie breaker and marks low confidence', () => {
  const computePoleScores = scoringExport('computePoleScores');
  const resolveAxis = scoringExport('resolveAxis');
  const answers = [
    { questionId: 'q1', poles: { A: 2 } },
    { questionId: 'q2', poles: { P: 2 } },
  ];
  const poleScores = computePoleScores([], answers);
  const axis = resolveAxis(GPTI_AXES[0], poleScores, [], answers);

  assert.equal(axis.winner, 'P');
  assert.equal(axis.tied, true);
  assert.equal(axis.tieBreak, 'last_answer');
  assert.equal(axis.confidence, 0);
});

test('resolveAxis tie breaker follows the newest answeredAt timestamp after answer edits', () => {
  const computePoleScores = scoringExport('computePoleScores');
  const resolveAxis = scoringExport('resolveAxis');
  const answers = [
    { questionId: 'q1', poles: { A: 2 }, answeredAt: 3000 },
    { questionId: 'q2', poles: { P: 2 }, answeredAt: 1000 },
  ];
  const poleScores = computePoleScores([], answers);
  const axis = resolveAxis(GPTI_AXES[0], poleScores, [], answers);

  assert.equal(axis.winner, 'A');
  assert.equal(axis.tied, true);
  assert.equal(axis.tieBreak, 'last_answer');
});

test('resolveAxis falls back to the default left pole when a tied axis has no decisive answer', () => {
  const computePoleScores = scoringExport('computePoleScores');
  const resolveAxis = scoringExport('resolveAxis');
  const poleScores = computePoleScores([], [{ questionId: 'q1', poles: { T: 1, I: 1 } }]);
  const axis = resolveAxis(GPTI_AXES[1], poleScores, [], [{ questionId: 'q1', poles: { T: 1, I: 1 } }]);

  assert.equal(axis.winner, 'T');
  assert.equal(axis.tied, true);
  assert.equal(axis.tieBreak, 'default');
  assert.equal(axis.confidence, 0);
});

test('computeAxisConfidence returns score difference over total axis score', () => {
  const computeAxisConfidence = scoringExport('computeAxisConfidence');

  assert.equal(computeAxisConfidence(9, 3), 0.5);
  assert.equal(computeAxisConfidence(0, 0), 0);
});

test('computeKeywordCounts counts selected option keywords from answers and question config', () => {
  const computeKeywordCounts = scoringExport('computeKeywordCounts');
  const questions = [
    {
      id: 'q1',
      options: [{ id: 'a', keywords: ['莽', '速通'], poles: { A: 1 } }],
    },
    {
      id: 'q2',
      options: [{ id: 'a', keywords: ['稳健'], poles: { P: 1 } }],
    },
  ];
  const answers = [
    { questionId: 'q1', optionId: 'a' },
    { questionId: 'q2', optionId: 'a', keywords: ['莽', '复盘'] },
  ];

  assert.deepEqual(computeKeywordCounts(questions, answers), {
    莽: 2,
    速通: 1,
    复盘: 1,
  });
});

test('buildScoreReport includes type, pole scores, axis confidence, keyword counts, and hidden trait', () => {
  const buildScoreReport = scoringExport('buildScoreReport');
  const answers = [
    { questionId: 'q1', keywords: ['背板', '莽'], poles: { A: 2, T: 2, B: 3 } },
    { questionId: 'q2', keywords: ['稳健'], poles: { C: 3, R: 2 } },
  ];
  const report = buildScoreReport([], answers);

  assert.equal(report.type, 'ATRC');
  assert.deepEqual(report.poleScores, {
    A: 2,
    P: 0,
    T: 2,
    I: 0,
    R: 2,
    W: 0,
    B: 3,
    C: 3,
  });
  assert.equal(report.axes.initiative.winner, 'A');
  assert.equal(report.axes.risk.winner, 'C');
  assert.equal(report.axes.risk.tied, true);
  assert.equal(report.confidence.risk, 0);
  assert.equal(report.keywordCounts['背板'], 1);
  assert.equal(report.hiddenTrait.id, 'scripted_gambler');
});

test('resolveHiddenTrait picks the matching trait with the highest explicit priority', () => {
  const resolveHiddenTrait = scoringExport('resolveHiddenTrait');
  const report = {
    poleScores: Object.fromEntries(GPTI_POLES.map((pole) => [pole, 0])),
    axes: {},
    keywordCounts: { 莽: 1, 稳健: 1 },
  };
  report.poleScores.B = 5;
  report.poleScores.C = 5;

  const trait = resolveHiddenTrait(report, [
    {
      id: 'late',
      name: 'Late',
      priority: 30,
      triggerType: 'keyword_combo',
      conditions: { keywordsAny: ['莽'], polesMin: { B: 3 } },
    },
    {
      id: 'early',
      name: 'Early',
      priority: 10,
      triggerType: 'keyword_combo',
      conditions: { keywordsAny: ['稳健'], polesMin: { C: 3 } },
    },
  ]);

  assert.equal(trait.id, 'early');
});

test('resolveHiddenTrait returns null when no hidden trait rule matches', () => {
  const buildScoreReport = scoringExport('buildScoreReport');
  const resolveHiddenTrait = scoringExport('resolveHiddenTrait');
  const report = buildScoreReport([], [{ questionId: 'q1', keywords: ['稳健'], poles: { P: 1, C: 1 } }]);

  assert.equal(resolveHiddenTrait(report), null);
});

test('all 16 standard GPTI types are constructible from pole contributions', () => {
  const resolveType = scoringExport('resolveType');
  const resolvedTypes = GPTI_TYPES.map((type) => resolveType([], answersForType(type)));

  assert.deepEqual(resolvedTypes, GPTI_TYPES);
});
