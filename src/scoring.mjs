import { GPTI_AXES, GPTI_POLES } from './data/gpti.mjs';
import { hiddenTraits } from './data/traits.mjs';

const SINGLE_POLE_SPIKE_RATIO = 0.35;
const DUAL_HIGH_DEFAULT_MIN = 6;
const DUAL_HIGH_MAX_DIFF = 2;

function createPoleScoreMap() {
  return Object.fromEntries(GPTI_POLES.map((pole) => [pole, 0]));
}

function buildQuestionMap(questions) {
  return new Map((questions ?? []).map((question) => [question.id, question]));
}

function getSelectedOption(questionById, answer) {
  const question = questionById.get(answer.questionId);
  return question?.options?.find((option) => option.id === answer.optionId) ?? null;
}

function normalizePoleObject(poles) {
  if (!poles || typeof poles !== 'object' || Array.isArray(poles)) return null;

  const normalized = {};
  for (const pole of GPTI_POLES) {
    const value = Number(poles[pole] ?? 0);
    if (Number.isFinite(value) && value !== 0) normalized[pole] = value;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function getAnswerPoles(questionById, answer) {
  return normalizePoleObject(answer.poles) ?? normalizePoleObject(getSelectedOption(questionById, answer)?.poles) ?? {};
}

function getAnswerKeywords(questionById, answer) {
  const keywords = Array.isArray(answer.keywords) ? answer.keywords : getSelectedOption(questionById, answer)?.keywords;
  if (!Array.isArray(keywords)) return [];
  return keywords.filter((keyword) => typeof keyword === 'string' && keyword.trim());
}

export function computePoleScores(questions, answers) {
  const questionById = buildQuestionMap(questions);
  const poleScores = createPoleScoreMap();

  for (const answer of answers ?? []) {
    const poles = getAnswerPoles(questionById, answer);
    for (const [pole, score] of Object.entries(poles)) {
      poleScores[pole] += score;
    }
  }

  return poleScores;
}

export function computeKeywordCounts(questions, answers) {
  const questionById = buildQuestionMap(questions);
  const keywordCounts = {};

  for (const answer of answers ?? []) {
    for (const keyword of getAnswerKeywords(questionById, answer)) {
      keywordCounts[keyword] = (keywordCounts[keyword] ?? 0) + 1;
    }
  }

  return keywordCounts;
}

export function computeAxisConfidence(leftScore, rightScore) {
  const total = leftScore + rightScore;
  if (total <= 0) return 0;
  return Number((Math.abs(leftScore - rightScore) / total).toFixed(2));
}

function resolveTieFromLastAnswer(axis, questions, answers) {
  const questionById = buildQuestionMap(questions);
  const orderedAnswers = [...(answers ?? [])].sort((a, b) => {
    const aTime = Number.isFinite(Number(a?.answeredAt)) && Number(a?.answeredAt) > 0 ? Number(a.answeredAt) : -1;
    const bTime = Number.isFinite(Number(b?.answeredAt)) && Number(b?.answeredAt) > 0 ? Number(b.answeredAt) : -1;
    if (aTime !== bTime) return bTime - aTime;
    return (answers ?? []).indexOf(b) - (answers ?? []).indexOf(a);
  });

  for (const answer of orderedAnswers) {
    const poles = getAnswerPoles(questionById, answer);
    const leftDelta = poles[axis.left] ?? 0;
    const rightDelta = poles[axis.right] ?? 0;

    if (leftDelta > rightDelta) return axis.left;
    if (rightDelta > leftDelta) return axis.right;
  }

  return null;
}

export function resolveAxis(axis, poleScores, questions, answers) {
  const leftScore = poleScores[axis.left] ?? 0;
  const rightScore = poleScores[axis.right] ?? 0;

  if (leftScore > rightScore) {
    return {
      left: axis.left,
      right: axis.right,
      winner: axis.left,
      leftScore,
      rightScore,
      confidence: computeAxisConfidence(leftScore, rightScore),
      tied: false,
      tieBreak: 'score',
    };
  }

  if (rightScore > leftScore) {
    return {
      left: axis.left,
      right: axis.right,
      winner: axis.right,
      leftScore,
      rightScore,
      confidence: computeAxisConfidence(leftScore, rightScore),
      tied: false,
      tieBreak: 'score',
    };
  }

  const tieWinner = resolveTieFromLastAnswer(axis, questions, answers);

  return {
    left: axis.left,
    right: axis.right,
    winner: tieWinner ?? axis.left,
    leftScore,
    rightScore,
    confidence: 0,
    tied: true,
    tieBreak: tieWinner ? 'last_answer' : 'default',
  };
}

function buildAxes(poleScores, questions, answers) {
  return Object.fromEntries(GPTI_AXES.map((axis) => [axis.id, resolveAxis(axis, poleScores, questions, answers)]));
}

export function resolveType(questions, answers) {
  const poleScores = computePoleScores(questions, answers);
  const axes = buildAxes(poleScores, questions, answers);
  return GPTI_AXES.map((axis) => axes[axis.id].winner).join('');
}

function conditionKeywordsAllMatch(keywordCounts, keywords = []) {
  return keywords.every((keyword) => (keywordCounts[keyword] ?? 0) > 0);
}

function conditionKeywordsAnyMatch(keywordCounts, keywords = []) {
  if (!keywords.length) return true;
  return keywords.some((keyword) => (keywordCounts[keyword] ?? 0) > 0);
}

function conditionPolesMinMatch(poleScores, polesMin = {}) {
  return Object.entries(polesMin).every(([pole, minimum]) => (poleScores[pole] ?? 0) >= minimum);
}

function baseConditionsMatch(report, conditions = {}) {
  return (
    conditionKeywordsAllMatch(report.keywordCounts ?? {}, conditions.keywordsAll ?? []) &&
    conditionKeywordsAnyMatch(report.keywordCounts ?? {}, conditions.keywordsAny ?? []) &&
    conditionPolesMinMatch(report.poleScores ?? {}, conditions.polesMin ?? {})
  );
}

function matchesSinglePoleSpike(report, conditions = {}) {
  const poleScores = report.poleScores ?? {};
  const total = Object.values(poleScores).reduce((sum, score) => sum + Math.max(0, score), 0);
  if (total <= 0) return false;

  const conditionedPoles = Object.keys(conditions.polesMin ?? {}).filter((pole) => GPTI_POLES.includes(pole));
  const candidatePoles = conditionedPoles.length ? conditionedPoles : GPTI_POLES;

  return candidatePoles.some((pole) => (poleScores[pole] ?? 0) / total >= SINGLE_POLE_SPIKE_RATIO);
}

function matchesDualHighConflict(report, conditions = {}) {
  const poleScores = report.poleScores ?? {};
  const polesMin = conditions.polesMin ?? {};
  const conditionedPoles = Object.keys(polesMin).filter((pole) => GPTI_POLES.includes(pole));

  return GPTI_AXES.some((axis) => {
    const axisHasCondition = conditionedPoles.includes(axis.left) || conditionedPoles.includes(axis.right);
    if (conditionedPoles.length && !axisHasCondition) return false;

    const leftScore = poleScores[axis.left] ?? 0;
    const rightScore = poleScores[axis.right] ?? 0;
    const leftMin = polesMin[axis.left] ?? DUAL_HIGH_DEFAULT_MIN;
    const rightMin = polesMin[axis.right] ?? DUAL_HIGH_DEFAULT_MIN;

    return leftScore >= leftMin && rightScore >= rightMin && Math.abs(leftScore - rightScore) <= DUAL_HIGH_MAX_DIFF;
  });
}

function traitMatches(report, trait) {
  if (!baseConditionsMatch(report, trait.conditions)) return false;

  switch (trait.triggerType) {
    case 'keyword_combo':
      return true;
    case 'single_pole_spike':
      return matchesSinglePoleSpike(report, trait.conditions);
    case 'dual_high_conflict':
      return matchesDualHighConflict(report, trait.conditions);
    default:
      return false;
  }
}

export function resolveHiddenTrait(report, traitRules = hiddenTraits) {
  const matches = (traitRules ?? [])
    .filter((trait) => traitMatches(report, trait))
    .sort((a, b) => a.priority - b.priority);

  return matches[0] ?? null;
}

export function buildScoreReport(questions, answers) {
  const poleScores = computePoleScores(questions, answers);
  const axes = buildAxes(poleScores, questions, answers);
  const keywordCounts = computeKeywordCounts(questions, answers);
  const confidence = Object.fromEntries(Object.entries(axes).map(([axisId, axis]) => [axisId, axis.confidence]));
  const report = {
    type: GPTI_AXES.map((axis) => axes[axis.id].winner).join(''),
    poleScores,
    scores: poleScores,
    axes,
    confidence,
    keywordCounts,
    hiddenTrait: null,
  };

  report.hiddenTrait = resolveHiddenTrait(report);
  return report;
}
