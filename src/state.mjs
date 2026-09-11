import { GPTI_POLES } from './data/gpti.mjs';

export const STATE_SCHEMA_VERSION = 1;

const VALID_VIEWS = new Set(['home', 'rules', 'quiz', 'chapter', 'generating', 'result']);
const VALID_OPTION_IDS = new Set(['a', 'b', 'c', 'd']);

export function createInitialState({ channel = 'default_channel', contentVersion } = {}) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    contentVersion,
    view: 'home',
    currentIndex: 0,
    answers: [],
    channel,
    startedAt: 0,
    trackedChapterCompletes: [],
    testCompleteTracked: false,
  };
}

export function createLaunchState(savedState, { contentVersion, fallbackChannel = 'default_channel', questions } = {}) {
  const restoredState = normalizeSavedState(savedState, { contentVersion, fallbackChannel, questions });

  return {
    initialState: createInitialState({ channel: restoredState.channel, contentVersion }),
    resumeState: isResumableState(restoredState, questions) ? prepareResumeState(restoredState, questions) : null,
  };
}

export function prepareResumeState(restoredState, questions) {
  const questionMeta = buildQuestionMeta(questions);

  return {
    ...restoredState,
    view: 'quiz',
    currentIndex: questionMeta ? getFirstUnansweredIndex(restoredState.answers ?? [], questionMeta) : normalizeIndex(restoredState.currentIndex),
  };
}

export function shouldPreserveResumableProgress(currentState, resumeState) {
  const answers = Array.isArray(currentState?.answers) ? currentState.answers : [];
  const view = getString(currentState?.view);
  return Boolean(resumeState) && answers.length === 0 && (view === 'home' || view === 'rules');
}

export function normalizeSavedState(savedState, { contentVersion, fallbackChannel = 'default_channel', questions } = {}) {
  const channel = getString(savedState?.channel) || fallbackChannel;
  const initialState = createInitialState({ channel, contentVersion });
  const questionMeta = buildQuestionMeta(questions);

  if (!savedState || typeof savedState !== 'object' || Array.isArray(savedState)) return initialState;
  if (savedState.schemaVersion !== STATE_SCHEMA_VERSION) return initialState;
  if (savedState.contentVersion !== contentVersion) return initialState;

  const answers = Array.isArray(savedState.answers)
    ? dedupeAnswers(savedState.answers.map((answer) => normalizeAnswer(answer, questionMeta)).filter(Boolean))
    : [];
  const view = normalizeView(savedState.view, answers, questionMeta);
  const currentIndex = normalizeCurrentIndex(savedState.currentIndex, answers, questionMeta, view);
  const hasCompleteAnswers = isCompleteAnswerSet(answers, questionMeta);

  return {
    ...initialState,
    view,
    currentIndex,
    answers,
    startedAt: normalizeTimestamp(savedState.startedAt),
    trackedChapterCompletes: normalizeChapterIds(savedState.trackedChapterCompletes),
    testCompleteTracked: hasCompleteAnswers && savedState.testCompleteTracked === true,
  };
}

function isResumableState(state, questions) {
  const questionMeta = buildQuestionMeta(questions);
  const answers = Array.isArray(state?.answers) ? state.answers : [];
  if (!questionMeta) return answers.length > 0;
  return answers.length > 0 && !isCompleteAnswerSet(answers, questionMeta);
}

function normalizeAnswer(answer, questionMeta) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const questionId = getString(answer.questionId);
  const optionId = getString(answer.optionId);
  if (!questionId || !isValidOption(questionId, optionId, questionMeta)) return null;

  return {
    questionId,
    optionId,
    keywords: Array.isArray(answer.keywords) ? answer.keywords.filter((item) => typeof item === 'string') : [],
    poles: normalizePoles(answer.poles),
    answeredAt: normalizeTimestamp(answer.answeredAt),
  };
}

function buildQuestionMeta(questions) {
  if (!Array.isArray(questions) || !questions.length) return null;

  return {
    ids: questions.map((question) => question.id).filter((id) => typeof id === 'string' && id),
    optionsByQuestionId: new Map(
      questions.map((question) => [
        question.id,
        new Set((question.options ?? []).map((option) => option.id).filter((id) => typeof id === 'string' && id)),
      ]),
    ),
  };
}

function isValidOption(questionId, optionId, questionMeta) {
  if (!questionMeta) return VALID_OPTION_IDS.has(optionId);
  const optionIds = questionMeta.optionsByQuestionId.get(questionId);
  return Boolean(optionIds?.has(optionId));
}

function dedupeAnswers(answers) {
  const byQuestionId = new Map();

  answers.forEach((answer, index) => {
    const existing = byQuestionId.get(answer.questionId);
    if (!existing || isAnswerNewer(answer, index, existing.answer, existing.index)) {
      byQuestionId.set(answer.questionId, { answer, index });
    }
  });

  return [...byQuestionId.values()]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.answer);
}

function isAnswerNewer(answer, index, existingAnswer, existingIndex) {
  if (answer.answeredAt !== existingAnswer.answeredAt) return answer.answeredAt > existingAnswer.answeredAt;
  return index > existingIndex;
}

function normalizeView(view, answers, questionMeta) {
  const normalizedView = VALID_VIEWS.has(view) ? view : 'home';
  if ((normalizedView === 'generating' || normalizedView === 'result') && !isCompleteAnswerSet(answers, questionMeta)) {
    return answers.length ? 'quiz' : 'home';
  }
  return normalizedView;
}

function normalizeCurrentIndex(value, answers, questionMeta, view) {
  if (!questionMeta) return normalizeIndex(value);

  const maxIndex = Math.max(0, questionMeta.ids.length - 1);
  if ((view === 'quiz' || view === 'chapter') && answers.length < questionMeta.ids.length) {
    return getFirstUnansweredIndex(answers, questionMeta);
  }

  return Math.min(normalizeIndex(value), maxIndex);
}

function getFirstUnansweredIndex(answers, questionMeta) {
  const answeredQuestionIds = new Set(answers.map((answer) => answer.questionId));
  const index = questionMeta.ids.findIndex((id) => !answeredQuestionIds.has(id));
  return index >= 0 ? index : Math.max(0, questionMeta.ids.length - 1);
}

function isCompleteAnswerSet(answers, questionMeta) {
  if (!questionMeta) return true;
  if (answers.length !== questionMeta.ids.length) return false;
  const answeredQuestionIds = new Set(answers.map((answer) => answer.questionId));
  return questionMeta.ids.every((id) => answeredQuestionIds.has(id));
}

function normalizePoles(poles) {
  if (!poles || typeof poles !== 'object' || Array.isArray(poles)) return {};
  const normalized = {};

  for (const pole of GPTI_POLES) {
    const value = Number(poles[pole]);
    if (Number.isFinite(value) && value !== 0) normalized[pole] = value;
  }

  return normalized;
}

function normalizeChapterIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
}

function normalizeIndex(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function normalizeTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
