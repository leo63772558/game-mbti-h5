import test from 'node:test';
import assert from 'node:assert/strict';

import { questions } from '../src/data/questions.mjs';
import { buildScoreReport } from '../src/scoring.mjs';

function buildAnswers(choices) {
  return questions.map((question, index) => {
    const optionId = typeof choices === 'string' ? choices : choices[question.id];
    const option = question.options.find((item) => item.id === optionId) ?? question.options[0];
    return {
      questionId: question.id,
      optionId: option.id,
      keywords: option.keywords,
      poles: option.poles,
      answeredAt: index + 1,
    };
  });
}

test('second-option path no longer collapses into Loot Hamster by position alone', () => {
  const report = buildScoreReport(questions, buildAnswers('b'));

  assert.notEqual(report.type, 'PTRC');
  assert.equal(report.type, 'PTWC');
  assert.equal(report.axes.focus.winner, 'W');
  assert.equal(report.axes.focus.tied, false);
});

test('resource and checklist-heavy path can still resolve to Loot Hamster', () => {
  const report = buildScoreReport(
    questions,
    buildAnswers({
      q01: 'a',
      q02: 'b',
      q03: 'b',
      q04: 'd',
      q05: 'b',
      q06: 'a',
      q07: 'b',
      q08: 'a',
      q09: 'b',
      q10: 'c',
      q11: 'c',
      q12: 'd',
      q13: 'b',
      q14: 'a',
      q15: 'a',
      q16: 'a',
      q17: 'b',
      q18: 'b',
      q19: 'a',
      q20: 'b',
      q21: 'b',
      q22: 'b',
      q23: 'b',
      q24: 'b',
    }),
  );

  assert.equal(report.type, 'PTRC');
  assert.equal(report.axes.initiative.winner, 'P');
  assert.equal(report.axes.mode.winner, 'T');
  assert.equal(report.axes.focus.winner, 'R');
  assert.equal(report.axes.risk.winner, 'C');
});
