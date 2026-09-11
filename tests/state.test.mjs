import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATE_SCHEMA_VERSION,
  createLaunchState,
  createInitialState,
  normalizeSavedState,
  prepareResumeState,
  shouldPreserveResumableProgress,
} from '../src/state.mjs';
import { questions } from '../src/data/questions.mjs';

const CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';

test('createInitialState creates a GPTI state with schema and content version', () => {
  assert.deepEqual(createInitialState({
    channel: 'wechat_group',
    contentVersion: CONTENT_VERSION,
  }), {
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'home',
    currentIndex: 0,
    answers: [],
    channel: 'wechat_group',
    startedAt: 0,
    trackedChapterCompletes: [],
    testCompleteTracked: false,
  });
});

test('normalizeSavedState drops old pre-GPTI score slider state', () => {
  const state = normalizeSavedState({
    view: 'result',
    currentIndex: 23,
    contentVersion: 'content-2026-05-21',
    answers: [{
      questionId: 'q01',
      optionId: 'score_2',
      dimension: 'EI',
      score: 2,
    }],
    channel: 'old_channel',
  }, {
    contentVersion: CONTENT_VERSION,
    fallbackChannel: 'wechat_group',
  });

  assert.equal(state.view, 'home');
  assert.equal(state.currentIndex, 0);
  assert.deepEqual(state.answers, []);
  assert.equal(state.channel, 'old_channel');
  assert.equal(state.contentVersion, CONTENT_VERSION);
});

test('normalizeSavedState keeps valid GPTI answers and drops invalid answers', () => {
  const state = normalizeSavedState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'quiz',
    currentIndex: 5,
    answers: [
      {
        questionId: 'q01',
        optionId: 'a',
        keywords: ['莽'],
        poles: { A: 2, T: 1 },
        answeredAt: 1710000000000,
      },
      {
        questionId: 'q02',
        optionId: 'score_2',
        keywords: ['稳健'],
        poles: { E: 2 },
      },
    ],
    channel: 'wechat_group',
    startedAt: 1710000000000,
    trackedChapterCompletes: [1],
    testCompleteTracked: true,
  }, {
    contentVersion: CONTENT_VERSION,
    fallbackChannel: 'default_channel',
  });

  assert.equal(state.view, 'quiz');
  assert.equal(state.currentIndex, 5);
  assert.equal(state.answers.length, 1);
  assert.equal(state.answers[0].optionId, 'a');
  assert.deepEqual(state.trackedChapterCompletes, [1]);
  assert.equal(state.testCompleteTracked, true);
});

test('normalizeSavedState prevents incomplete restored states from opening result views', () => {
  const state = normalizeSavedState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'result',
    currentIndex: 99,
    answers: [
      {
        questionId: 'q01',
        optionId: 'a',
        keywords: ['莽'],
        poles: { A: 2, T: 1 },
        answeredAt: 1710000000000,
      },
      {
        questionId: 'q01',
        optionId: 'b',
        keywords: ['稳健'],
        poles: { P: 2, C: 1 },
        answeredAt: 1710000001000,
      },
      {
        questionId: 'missing',
        optionId: 'a',
        keywords: ['莽'],
        poles: { A: 2 },
        answeredAt: 1710000002000,
      },
    ],
    channel: 'wechat_group',
    testCompleteTracked: true,
  }, {
    contentVersion: CONTENT_VERSION,
    questions,
  });

  assert.equal(state.view, 'quiz');
  assert.equal(state.currentIndex, 1);
  assert.equal(state.answers.length, 1);
  assert.equal(state.answers[0].questionId, 'q01');
  assert.equal(state.answers[0].optionId, 'b');
  assert.equal(state.testCompleteTracked, false);
});

test('createLaunchState starts from a fresh home while preserving incomplete progress for explicit resume', () => {
  const launch = createLaunchState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'quiz',
    currentIndex: 7,
    answers: [
      { questionId: 'q01', optionId: 'a', answeredAt: 1710000000000 },
      { questionId: 'q02', optionId: 'b', answeredAt: 1710000001000 },
    ],
    channel: 'wechat_group',
    startedAt: 1710000000000,
  }, {
    contentVersion: CONTENT_VERSION,
    questions,
  });

  assert.deepEqual(launch.initialState, createInitialState({
    channel: 'wechat_group',
    contentVersion: CONTENT_VERSION,
  }));
  assert.equal(launch.resumeState?.answers.length, 2);
  assert.equal(launch.resumeState?.currentIndex, 2);
});

test('createLaunchState does not expose completed result state as resumable progress', () => {
  const launch = createLaunchState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'result',
    currentIndex: 23,
    answers: questions.map((question, index) => ({
      questionId: question.id,
      optionId: 'a',
      answeredAt: 1710000000000 + index,
    })),
    channel: 'shared_device',
    startedAt: 1710000000000,
    testCompleteTracked: true,
  }, {
    contentVersion: CONTENT_VERSION,
    questions,
  });

  assert.equal(launch.initialState.view, 'home');
  assert.equal(launch.initialState.answers.length, 0);
  assert.equal(launch.initialState.channel, 'shared_device');
  assert.equal(launch.resumeState, null);
});

test('prepareResumeState opens the first unanswered question only after explicit resume', () => {
  const restored = normalizeSavedState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'home',
    currentIndex: 0,
    answers: [
      { questionId: 'q01', optionId: 'a', answeredAt: 1710000000000 },
      { questionId: 'q03', optionId: 'c', answeredAt: 1710000001000 },
    ],
    channel: 'wechat_group',
  }, {
    contentVersion: CONTENT_VERSION,
    questions,
  });

  const resumed = prepareResumeState(restored, questions);

  assert.equal(resumed.view, 'quiz');
  assert.equal(resumed.currentIndex, 1);
  assert.equal(resumed.answers.length, 2);
});

test('shouldPreserveResumableProgress defers localStorage writes while viewing home or rules before choosing start or resume', () => {
  const resumeState = prepareResumeState(normalizeSavedState({
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    view: 'quiz',
    currentIndex: 1,
    answers: [{ questionId: 'q01', optionId: 'a', answeredAt: 1710000000000 }],
    channel: 'shared_device',
  }, {
    contentVersion: CONTENT_VERSION,
    questions,
  }), questions);

  assert.equal(shouldPreserveResumableProgress(createInitialState({ contentVersion: CONTENT_VERSION }), resumeState), true);
  assert.equal(shouldPreserveResumableProgress({ ...createInitialState({ contentVersion: CONTENT_VERSION }), view: 'rules' }, resumeState), true);
  assert.equal(shouldPreserveResumableProgress({ ...createInitialState({ contentVersion: CONTENT_VERSION }), view: 'quiz' }, resumeState), false);
  assert.equal(shouldPreserveResumableProgress({ ...createInitialState({ contentVersion: CONTENT_VERSION }), answers: resumeState.answers }, resumeState), false);
  assert.equal(shouldPreserveResumableProgress(createInitialState({ contentVersion: CONTENT_VERSION }), null), false);
});
