import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GPTI_AXES,
  GPTI_KEYWORDS,
  GPTI_POLES,
  GPTI_TYPES,
} from '../src/data/gpti.mjs';
import { chapters, questions } from '../src/data/questions.mjs';
import { questionScenes } from '../src/data/questionScenes.mjs';
import { results } from '../src/data/results.mjs';
import { hiddenTraits } from '../src/data/traits.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EXPECTED_TYPES = [
  'ATRB',
  'ATRC',
  'ATWB',
  'ATWC',
  'AIRB',
  'AIRC',
  'AIWB',
  'AIWC',
  'PTRB',
  'PTRC',
  'PTWB',
  'PTWC',
  'PIRB',
  'PIRC',
  'PIWB',
  'PIWC',
];
const EXPECTED_POLES = ['A', 'P', 'T', 'I', 'R', 'W', 'B', 'C'];
const EXPECTED_OPTION_IDS = ['a', 'b', 'c', 'd'];
const EXPECTED_CHAPTERS = [1, 2, 3, 4];
const CURRENT_CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';
const RESULT_TEXT_FIELDS = [
  'name',
  'identity',
  'headline',
  'summary',
  'talent',
  'weakness',
  'shareCTA',
];
const RESULT_LONG_TEXT_FIELDS = ['longCopy', 'worldCopy', 'playerCopy'];
const RESULT_ARRAY_FIELDS = ['alias', 'tags', 'behaviorFragments', 'charges', 'bestPartners', 'nemesis'];
const RESULT_PUBLIC_FIELD_LIMITS = {
  name: 24,
  identity: 14,
  headline: 56,
  summary: 72,
  talent: 44,
  weakness: 44,
  shareCTA: 28,
};
const RESULT_ARRAY_ITEM_LIMITS = {
  alias: 12,
  tags: 8,
  behaviorFragments: 42,
  charges: 56,
};
const QUESTION_FIELD_LIMITS = {
  title: 144,
  text: 64,
};
const INTERNAL_WORDING_PATTERN = /MBTI|16\s*型人格|16型人格|INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP/i;
const GPTI_TYPE_CODE_PATTERN = new RegExp(`(^|[^A-Z])(${EXPECTED_TYPES.join('|')})(?=$|[^A-Z])`);
const ENGINEERING_PLACEHOLDER_PATTERN = /GPTI\s*占位|占位短解释|占位长文案|后续替换|跑通题库|跑通技术链路|校验和结果结构/;
const GENDERED_COPY_PATTERN = /男人|女人|男性|女性|男生|女生|男孩|女孩|男子|女子|男友|女友|男朋友|女朋友|老公|老婆|老子|爷们|汉子|妹子|姑娘|小伙(?!伴)|老哥|老姐|兄弟|姐妹|哥们|档案持有人/u;
const ENGLISH_GENDERED_ROLE_PATTERN = /\b(?:Mr\.|Mrs\.|Miss|Man|Woman|Male|Female|Boy|Girl|King|Queen)\b/i;

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertWithinLength(value, maxLength, label) {
  assert.ok(
    Array.from(String(value)).length <= maxLength,
    `${label} exceeds ${maxLength} visible characters`,
  );
}

function assertPublicCopy(value, label) {
  assert.doesNotMatch(String(value), INTERNAL_WORDING_PATTERN, `${label} exposes old internal wording`);
  assert.doesNotMatch(String(value), GPTI_TYPE_CODE_PATTERN, `${label} exposes a GPTI type code`);
}

function collectStrings(value, path, output = []) {
  if (typeof value === 'string') {
    output.push([path, value]);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, output));
    return output;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectStrings(item, `${path}.${key}`, output);
  }

  return output;
}

function stripNeutralPronounAllowlist(value) {
  return String(value).replace(/其他|他人|利他|排他|维他|吉他/g, '');
}

function assertKeywordList(keywords, label) {
  assert.ok(Array.isArray(keywords), `${label} must be an array`);
  assert.ok(keywords.length > 0, `${label} must not be empty`);
  for (const keyword of keywords) {
    assert.ok(GPTI_KEYWORDS.includes(keyword), `${label} contains non-whitelisted keyword ${keyword}`);
  }
}

function assertPoleScoreObject(poles, label) {
  assert.equal(typeof poles, 'object', `${label} must be an object`);
  assert.ok(poles && !Array.isArray(poles), `${label} must be a plain object`);
  assert.ok(Object.keys(poles).length > 0, `${label} must not be empty`);

  for (const [pole, score] of Object.entries(poles)) {
    assert.ok(GPTI_POLES.includes(pole), `${label} contains invalid pole ${pole}`);
    assert.ok(Number.isInteger(score), `${label}.${pole} must be an integer`);
    assert.ok(score >= 1 && score <= 3, `${label}.${pole} must be between 1 and 3`);
  }
}

function assertPoleMinimumObject(poles, label) {
  assert.equal(typeof poles, 'object', `${label} must be an object`);
  assert.ok(poles && !Array.isArray(poles), `${label} must be a plain object`);
  assert.ok(Object.keys(poles).length > 0, `${label} must not be empty`);

  for (const [pole, score] of Object.entries(poles)) {
    assert.ok(GPTI_POLES.includes(pole), `${label} contains invalid pole ${pole}`);
    assert.ok(Number.isInteger(score), `${label}.${pole} must be an integer`);
    assert.ok(score >= 1 && score <= 48, `${label}.${pole} must be between 1 and 48`);
  }
}

function readWebpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');

  for (let offset = 12; offset + 8 < buffer.length;) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkId === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(dataOffset + 4, 3),
        height: 1 + buffer.readUIntLE(dataOffset + 7, 3),
      };
    }

    if (chunkId === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  throw new Error('Unsupported WebP image layout');
}

test('GPTI constants define the approved 16-type system', () => {
  assert.deepEqual(GPTI_POLES, EXPECTED_POLES);
  assert.deepEqual(GPTI_TYPES, EXPECTED_TYPES);
  assert.equal(new Set(GPTI_KEYWORDS).size, GPTI_KEYWORDS.length);
  assert.equal(GPTI_KEYWORDS.length, 42);
  assert.deepEqual(
    GPTI_AXES.map((axis) => [axis.left, axis.right]),
    [
      ['A', 'P'],
      ['T', 'I'],
      ['R', 'W'],
      ['B', 'C'],
    ],
  );
});

test('question config contains 24 GPTI four-option questions', () => {
  assert.equal(questions.length, 24);

  const ids = questions.map((question) => question.id);
  const expectedIds = Array.from({ length: 24 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, expectedIds);

  for (const question of questions) {
    assert.match(question.id, /^q\d{2}$/);
    assert.ok(EXPECTED_CHAPTERS.includes(question.chapter), `${question.id} has invalid chapter`);
    assertNonEmptyString(question.title, `${question.id}.title`);
    assertWithinLength(question.title, QUESTION_FIELD_LIMITS.title, `${question.id}.title`);
    assertPublicCopy(question.title, `${question.id}.title`);
    assert.doesNotMatch(question.title, /^｜/, `${question.id}.title should not expose an editor divider`);
    assert.doesNotMatch(question.title, /结束题/, `${question.id}.title should not expose an editor label`);
    assert.equal(question.dimension, undefined, `${question.id} should not use old dimension field`);
    assert.equal(question.leftChoice, undefined, `${question.id} should not use old leftChoice field`);
    assert.equal(question.rightChoice, undefined, `${question.id} should not use old rightChoice field`);

    assert.ok(Array.isArray(question.options), `${question.id}.options must be an array`);
    assert.deepEqual(question.options.map((option) => option.id), EXPECTED_OPTION_IDS);
    for (const option of question.options) {
      assertNonEmptyString(option.text, `${question.id}.${option.id}.text`);
      assertWithinLength(option.text, QUESTION_FIELD_LIMITS.text, `${question.id}.${option.id}.text`);
      assertPublicCopy(option.text, `${question.id}.${option.id}.text`);
      assertKeywordList(option.keywords, `${question.id}.${option.id}.keywords`);
      assertPoleScoreObject(option.poles, `${question.id}.${option.id}.poles`);
    }
  }
});

test('question copy does not contain known proofreading defects', () => {
  const copy = questions.flatMap((question) => [
    question.title,
    ...question.options.map((option) => option.text),
  ]).join('\n');

  assert.doesNotMatch(copy, /从排出去/, 'q13 option copy should include the missing demonstrative');
  assert.doesNotMatch(copy, /托付到/, 'q12 title should use natural entrusted-speech wording');
});

test('question scene illustrations cover every quiz question', () => {
  const ids = questions.map((question) => question.id);
  assert.deepEqual(Object.keys(questionScenes), ids);

  for (const question of questions) {
    const scene = questionScenes[question.id];
    assertNonEmptyString(scene.title, `${question.id}.scene.title`);
    assertWithinLength(scene.title, 24, `${question.id}.scene.title`);
    assertPublicCopy(scene.title, `${question.id}.scene.title`);
    assertNonEmptyString(scene.illustration, `${question.id}.scene.illustration`);
    assert.match(scene.illustration, new RegExp(`^\\./assets/questions/${question.id}\\.webp$`));
    assert.ok(existsSync(resolve(projectRoot, scene.illustration)), `${scene.illustration} should exist`);
    assertNonEmptyString(scene.alt, `${question.id}.scene.alt`);
    assertPublicCopy(scene.alt, `${question.id}.scene.alt`);
    assert.ok(Array.isArray(scene.paragraphs), `${question.id}.scene.paragraphs must be an array`);
    assert.ok(scene.paragraphs.length > 0, `${question.id}.scene.paragraphs must not be empty`);
    for (const paragraph of scene.paragraphs) {
      assertNonEmptyString(paragraph, `${question.id}.scene.paragraph`);
      assertPublicCopy(paragraph, `${question.id}.scene.paragraph`);
    }
  }
});

test('question raster illustrations fit the mobile header slot', () => {
  for (const question of questions) {
    const scene = questionScenes[question.id];
    const webp = readFileSync(resolve(projectRoot, scene.illustration));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF', `${question.id} illustration must be a RIFF WebP`);
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP', `${question.id} illustration must be a WebP image`);
    assert.ok(webp.length < 120 * 1024, `${question.id} illustration should stay below 120 KB`);
    assert.deepEqual(readWebpSize(webp), { width: 960, height: 420 }, `${question.id} illustration should match the UI slot`);
  }
});

test('chapters are complete and every chapter owns six questions', () => {
  assert.deepEqual(chapters.map((chapter) => chapter.id), EXPECTED_CHAPTERS);

  for (const chapter of chapters) {
    assertNonEmptyString(chapter.title, `chapter ${chapter.id}.title`);
    assertNonEmptyString(chapter.feedback, `chapter ${chapter.id}.feedback`);
    assertWithinLength(chapter.title, 16, `chapter ${chapter.id}.title`);
    assertWithinLength(chapter.feedback, 32, `chapter ${chapter.id}.feedback`);
    assertPublicCopy(chapter.title, `chapter ${chapter.id}.title`);
    assertPublicCopy(chapter.feedback, `chapter ${chapter.id}.feedback`);
    assert.equal(
      questions.filter((question) => question.chapter === chapter.id).length,
      6,
      `chapter ${chapter.id} should contain six questions`,
    );
  }
});

test('result config contains the 16 standard GPTI types with complete short fields', () => {
  assert.deepEqual(Object.keys(results), GPTI_TYPES);

  for (const type of GPTI_TYPES) {
    const result = results[type];
    assert.equal(result.type, type, `${type}.type must match the result key`);
    assert.match(result.name, /[A-Za-z]/, `${type}.name should include an English alias`);
    assert.match(result.name, /[\u4e00-\u9fff]/u, `${type}.name should include a Chinese persona name`);

    for (const field of RESULT_TEXT_FIELDS) {
      assertNonEmptyString(result[field], `${type}.${field}`);
      assertWithinLength(result[field], RESULT_PUBLIC_FIELD_LIMITS[field], `${type}.${field}`);
      assertPublicCopy(result[field], `${type}.${field}`);
    }

    for (const field of RESULT_LONG_TEXT_FIELDS) {
      assertNonEmptyString(result[field], `${type}.${field}`);
      assertPublicCopy(result[field], `${type}.${field}`);
    }

    for (const field of RESULT_ARRAY_FIELDS) {
      assert.ok(Array.isArray(result[field]), `${type}.${field} must be an array`);
      assert.ok(result[field].length > 0, `${type}.${field} must not be empty`);
    }

    for (const [index, tag] of result.tags.entries()) {
      assert.ok(GPTI_KEYWORDS.includes(tag), `${type}.tags[${index}] must come from keyword whitelist`);
      assertWithinLength(tag, RESULT_ARRAY_ITEM_LIMITS.tags, `${type}.tags[${index}]`);
      assertPublicCopy(tag, `${type}.tags[${index}]`);
    }

    for (const field of ['alias', 'behaviorFragments', 'charges']) {
      for (const [index, item] of result[field].entries()) {
        assertNonEmptyString(item, `${type}.${field}[${index}]`);
        assertWithinLength(item, RESULT_ARRAY_ITEM_LIMITS[field], `${type}.${field}[${index}]`);
        assertPublicCopy(item, `${type}.${field}[${index}]`);
      }
    }

    for (const partnerType of [...result.bestPartners, ...result.nemesis]) {
      assert.ok(GPTI_TYPES.includes(partnerType), `${type} references unknown result type ${partnerType}`);
    }

    assert.equal(typeof result.detail, 'object', `${type}.detail must be an object`);
    assert.ok(result.detail && !Array.isArray(result.detail), `${type}.detail must be a plain object`);
    for (const field of ['analysis', 'behavior', 'charges', 'talents', 'weaknesses']) {
      assert.ok(Array.isArray(result.detail[field]), `${type}.detail.${field} must be an array`);
      assert.ok(result.detail[field].length >= 1, `${type}.detail.${field} should include at least one item`);
      assert.ok(result.detail[field].length <= 4, `${type}.detail.${field} should stay compact for mobile`);
      for (const [index, item] of result.detail[field].entries()) {
        assertNonEmptyString(item, `${type}.detail.${field}[${index}]`);
        assertPublicCopy(item, `${type}.detail.${field}[${index}]`);
      }
    }
    for (const field of ['soul', 'partners', 'nemesis']) {
      assert.ok(Array.isArray(result.detail[field]), `${type}.detail.${field} must be an array`);
      assert.ok(result.detail[field].length <= 4, `${type}.detail.${field} should stay compact for mobile`);
      for (const [index, item] of result.detail[field].entries()) {
        assertNonEmptyString(item, `${type}.detail.${field}[${index}]`);
        assertPublicCopy(item, `${type}.detail.${field}[${index}]`);
      }
    }
  }
});

test('result copy gives every standard type distinct public framing', () => {
  for (const field of ['headline', 'summary', 'talent', 'weakness', 'shareCTA', 'longCopy']) {
    const values = GPTI_TYPES.map((type) => results[type][field]);
    assert.equal(new Set(values).size, GPTI_TYPES.length, `${field} should be distinct for all 16 types`);
  }

  for (const field of ['behaviorFragments', 'charges']) {
    const values = GPTI_TYPES.map((type) => results[type][field].join('\n'));
    assert.equal(new Set(values).size, GPTI_TYPES.length, `${field} should be distinct for all 16 types`);
  }
});

test('hidden traits define bounded rare variants without replacing the main result', () => {
  assert.ok(Array.isArray(hiddenTraits));
  assert.ok(hiddenTraits.length >= 3 && hiddenTraits.length <= 5);
  assert.equal(new Set(hiddenTraits.map((trait) => trait.id)).size, hiddenTraits.length);

  for (const trait of hiddenTraits) {
    assert.match(trait.id, /^[a-z0-9_]+$/);
    assertNonEmptyString(trait.name, `${trait.id}.name`);
    assertNonEmptyString(trait.headline, `${trait.id}.headline`);
    assertNonEmptyString(trait.copy, `${trait.id}.copy`);
    assert.ok(Number.isInteger(trait.priority), `${trait.id}.priority must be an integer`);
    assert.ok(['keyword_combo', 'single_pole_spike', 'dual_high_conflict'].includes(trait.triggerType));
    assert.equal(typeof trait.conditions, 'object', `${trait.id}.conditions must be an object`);
    assert.ok(trait.conditions && !Array.isArray(trait.conditions), `${trait.id}.conditions must be a plain object`);
    assertPublicCopy(trait.name, `${trait.id}.name`);
    assertPublicCopy(trait.headline, `${trait.id}.headline`);
    assertPublicCopy(trait.copy, `${trait.id}.copy`);

    for (const key of ['keywordsAll', 'keywordsAny']) {
      if (trait.conditions[key]) assertKeywordList(trait.conditions[key], `${trait.id}.conditions.${key}`);
    }
    if (trait.conditions.polesMin) assertPoleMinimumObject(trait.conditions.polesMin, `${trait.id}.conditions.polesMin`);
  }
});

test('user-visible result and hidden-trait copy does not contain engineering placeholders', () => {
  for (const type of GPTI_TYPES) {
    const result = results[type];
    const visibleCopy = [
      result.name,
      result.identity,
      result.headline,
      result.summary,
      result.talent,
      result.weakness,
      result.shareCTA,
      ...RESULT_LONG_TEXT_FIELDS.map((field) => result[field]),
      ...result.alias,
      ...result.tags,
      ...result.behaviorFragments,
      ...result.charges,
    ].join('\n');

    assert.doesNotMatch(visibleCopy, ENGINEERING_PLACEHOLDER_PATTERN, `${type} contains engineering placeholder copy`);
  }

  for (const trait of hiddenTraits) {
    assert.doesNotMatch(
      [trait.name, trait.headline, trait.copy].join('\n'),
      ENGINEERING_PLACEHOLDER_PATTERN,
      `${trait.id} contains engineering placeholder copy`,
    );
  }
});

test('user-visible GPTI copy avoids gendered default wording', () => {
  const visibleEntries = [
    ...collectStrings(questions, 'questions'),
    ...collectStrings(questionScenes, 'questionScenes'),
    ...collectStrings(results, 'results'),
    ...collectStrings(hiddenTraits, 'hiddenTraits'),
  ];

  for (const [label, value] of visibleEntries) {
    assert.doesNotMatch(value, GENDERED_COPY_PATTERN, `${label} uses gendered role wording`);
    assert.doesNotMatch(value, ENGLISH_GENDERED_ROLE_PATTERN, `${label} uses gendered English role wording`);
    assert.doesNotMatch(stripNeutralPronounAllowlist(value), /[他她]/u, `${label} uses default gender pronoun wording`);
  }
});

test('Open Graph cover image exists as a 1200x630 PNG', () => {
  const png = readFileSync(resolve(projectRoot, 'assets/og/cover.png'));

  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('avatar assets are only required for results explicitly marked ready', () => {
  for (const type of GPTI_TYPES) {
    const result = results[type];
    const avatarPath = resolve(projectRoot, result.avatar);

    if (result.avatarReady === true) {
      assert.ok(existsSync(avatarPath), `${type} is avatarReady but ${result.avatar} is missing`);
    }
  }
});

test('standard GPTI result avatars are ready 512x512 PNG badges', () => {
  for (const type of GPTI_TYPES) {
    const result = results[type];
    assert.equal(result.avatarReady, true, `${type}.avatarReady should be enabled for the baseline avatar pack`);
    assert.notEqual(result.imageReady, true, `${type}.imageReady should stay disabled until result images exist`);

    const png = readFileSync(resolve(projectRoot, result.avatar));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 512, `${type} avatar width should be 512`);
    assert.equal(png.readUInt32BE(20), 512, `${type} avatar height should be 512`);
    assert.ok(png.length < 200 * 1024, `${type} avatar should stay below 200 KB`);
  }
});

test('result image assets are only required for results explicitly marked ready', () => {
  for (const type of GPTI_TYPES) {
    const result = results[type];
    const imagePath = resolve(projectRoot, result.image);

    if (result.imageReady === true) {
      assert.ok(existsSync(imagePath), `${type} is imageReady but ${result.image} is missing`);
    }
  }
});

test('HTML meta copy uses public game-personality wording', () => {
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');

  assert.match(html, /游戏人格|游戏灵魂职业|异界职业档案/);
  assert.doesNotMatch(html, /16型|游戏 MBTI H5|MBTI/);
});

test('HTML declares an inline favicon to avoid implicit static 404s', () => {
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');

  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
});

test('analytics content version is declared consistently', () => {
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');
  const htmlVersion = html.match(/contentVersion:\s*'([^']+)'/)?.[1];
  const appVersion = appSource.match(/CONTENT_VERSION\s*=\s*'([^']+)'/)?.[1];

  assertNonEmptyString(htmlVersion, 'index.html contentVersion');
  assertNonEmptyString(appVersion, 'src/app.mjs CONTENT_VERSION');
  assert.equal(appVersion, htmlVersion);
  assert.equal(appVersion, CURRENT_CONTENT_VERSION);
  assert.notEqual(appVersion, 'content-2026-05-21');
});

test('quiz source uses GPTI four-option answers instead of the old score slider model', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /question\.options/);
  assert.match(appSource, /data-option-id/);
  assert.match(appSource, /questionScenes\[question\.id\]/);
  assert.match(appSource, /keywords:\s*option\.keywords/);
  assert.match(appSource, /poles:\s*option\.poles/);
  assert.doesNotMatch(appSource, /choice-keywords/);
  assert.doesNotMatch(appSource, /#\$\{keyword\}/);
  assert.doesNotMatch(appSource, /optionScores/);
  assert.doesNotMatch(appSource, /data-score/);
  assert.doesNotMatch(appSource, /leftChoice|rightChoice/);
  assert.doesNotMatch(appSource, /score_\$\{score\}/);
  assert.doesNotMatch(appSource, /dimension:\s*question\.dimension/);
});

test('app analytics payload includes GPTI answer and hidden trait fields', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /question_answer[\s\S]*option_id:\s*answer\.optionId/);
  assert.match(appSource, /question_answer[\s\S]*keywords:\s*option\.keywords/);
  assert.match(appSource, /question_answer[\s\S]*poles:\s*option\.poles/);
  assert.match(appSource, /test_complete[\s\S]*hidden_trait_id/);
  assert.match(appSource, /test_complete[\s\S]*hidden_trait_name/);
  assert.match(appSource, /result_view[\s\S]*hidden_trait_id/);
  assert.match(appSource, /result_view[\s\S]*hidden_trait_name/);
});

test('result page user-facing templates do not directly render internal type codes', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.doesNotMatch(appSource, /四维倾向/);
  assert.doesNotMatch(appSource, /NO\. \$\{result\.type\}/);
  assert.doesNotMatch(appSource, /\$\{result\.type\}｜/);
  assert.doesNotMatch(appSource, /\$\{result\.type\} 型玩家/);
  assert.doesNotMatch(appSource, /NO\. \$\{report\.type\}/);
  assert.doesNotMatch(appSource, /\$\{result\.rarity\} · \$\{report\.type\}/);
  assert.doesNotMatch(appSource, /link\.download = `\$\{result\.type\}/);
  assert.doesNotMatch(appSource, /bestPartners\.join/);
  assert.doesNotMatch(appSource, /nemesis\.join/);
  assert.match(appSource, /report\.hiddenTrait/);
  assert.match(appSource, /getResultNameList/);
  assert.match(appSource, /data-action="toggle-details"/);
  assert.match(appSource, /renderResultDetails\(result\)/);
});

test('app escapes dynamic content before inserting config fields into innerHTML', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /escapeHtml\(question\.title\)/);
  assert.match(appSource, /escapeHtml\(scene\.title/);
  assert.match(appSource, /escapeHtml\(line\)/);
  assert.match(appSource, /escapeAttribute\(scene\.illustration\)/);
  assert.match(appSource, /escapeHtml\(option\.text\)/);
  assert.match(appSource, /escapeAttribute\(option\.id\)/);
  assert.match(appSource, /escapeHtml\(result\.name\)/);
  assert.match(appSource, /escapeHtml\(result\.summary\)/);
  assert.match(appSource, /escapeHtml\(hiddenTrait\.name\)/);
  assert.match(appSource, /escapeHtml\(hiddenTrait\.headline\)/);
  assert.match(appSource, /escapeHtml\(item\)/);
  assert.match(appSource, /detailSection\('致命弱点', detail\.weaknesses\)/);
  assert.match(appSource, /renderAvatarFrame\(result\)/);
  assert.match(appSource, /getResultAvatarSource\(result, CONTENT_VERSION\)/);
  assert.match(appSource, /escapeAttribute\(avatar\)/);
});

test('share poster uses versioned ready result avatars with a text fallback', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /getResultAvatarSource/);
  assert.match(appSource, /getResultAvatarSource\(result, CONTENT_VERSION\)/);
  assert.match(appSource, /loadShareAvatar\(result\)/);
  assert.match(appSource, /drawSharePoster\(\s*ctx,\s*result,\s*\{ \.\.\.report, answerCount: state\.answers\.length \},\s*avatarImage,\s*qrImage,\s*playerGroupQrImage,\s*\)/);
  assert.match(appSource, /drawShareAvatar/);
  assert.match(appSource, /ctx\.drawImage\(avatarImage/);
  assert.match(appSource, /result\.name\.slice\(0, 2\)/);
});

test('share poster includes official and player group QR entries without ambiguous scan wording', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');
  const styleSource = readFileSync(resolve(projectRoot, 'src/styles.css'), 'utf8');
  const officialQrPath = resolve(projectRoot, 'assets/qr/gameplayti-official.png');
  const playerGroupQrPath = resolve(projectRoot, 'assets/qr/guanghe-player-group.png');
  const campusGroupQrPath = resolve(projectRoot, 'assets/qr/guanghe-campus-group.png');
  const officialQrPng = readFileSync(officialQrPath);
  const playerGroupQrPng = readFileSync(playerGroupQrPath);
  const campusGroupQrPng = readFileSync(campusGroupQrPath);

  assert.ok(existsSync(officialQrPath), 'official share poster QR image should exist');
  assert.ok(existsSync(playerGroupQrPath), 'player group QR image should exist');
  assert.ok(existsSync(campusGroupQrPath), 'campus group QR image should exist');
  assert.deepEqual([...officialQrPng.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual([...playerGroupQrPng.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual([...campusGroupQrPng.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(officialQrPng.readUInt32BE(16), 512, 'official QR width should be 512');
  assert.equal(officialQrPng.readUInt32BE(20), 512, 'official QR height should be 512');
  assert.equal(playerGroupQrPng.readUInt32BE(16), 285, 'player group QR width should match provided asset');
  assert.equal(playerGroupQrPng.readUInt32BE(20), 285, 'player group QR height should match provided asset');
  assert.equal(campusGroupQrPng.readUInt32BE(16), 285, 'campus group QR width should match provided asset');
  assert.equal(campusGroupQrPng.readUInt32BE(20), 285, 'campus group QR height should match provided asset');
  assert.match(appSource, /SHARE_POSTER_QR_HREF = 'https:\/\/gameplayti\.icu\/\?h5_channel=share_poster'/);
  assert.match(appSource, /SHARE_POSTER_QR_SOURCE = '\.\/assets\/qr\/gameplayti-official\.png'/);
  assert.match(appSource, /PLAYER_GROUP_HREF = 'https:\/\/qun\.qq\.com\/certify-share\/s\/iYIhVvtXJe\?_nsp=1'/);
  assert.match(appSource, /CAMPUS_GROUP_HREF = 'https:\/\/qun\.qq\.com\/certify-share\/s\/Nob8sZR4u5\?_nsp='/);
  assert.match(appSource, /SURVEY_HREF = 'https:\/\/wj\.qq\.com\/s2\/26929947\/85d7\/'/);
  assert.match(appSource, /loadShareQr\(PLAYER_GROUP_QR_SOURCE\)/);
  assert.match(appSource, /drawPosterQr\(ctx, \[/);
  assert.match(appSource, /data-action="scroll-side-quest"/);
  assert.match(appSource, /data-action="go-side-quest"/);
  assert.match(appSource, /function renderSideQuestFloat\(\)/);
  assert.match(appSource, /class="side-quest-float"/);
  assert.match(appSource, /function syncSideQuestFloatVisibility\(\)/);
  assert.doesNotMatch(appSource, /renderSideQuestNudge/);
  assert.doesNotMatch(appSource, /side-quest-nudge/);
  assert.match(styleSource, /\.side-quest-float\.is-visible/);
  assert.match(appSource, /sideQuestFloatDismissed = true/);
  assert.match(appSource, /app\.querySelector\('\.side-quest-float'\)\?\.remove\(\)/);
  assert.match(appSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(appSource, /requestAnimationFrame\(scrollToSideQuest\)/);
  const resultActionsMatch = appSource.match(/<div class="actions result-actions">([\s\S]*?)<\/div>/);
  assert.ok(resultActionsMatch, 'result actions block should exist');
  assert.doesNotMatch(resultActionsMatch[1], /scroll-side-quest/);
  assert.match(resultActionsMatch[1], /data-action="share-image"/);
  assert.doesNotMatch(resultActionsMatch[1], /data-action="copy"/);
  assert.doesNotMatch(resultActionsMatch[1], /data-action="restart"/);
  const secondaryActionsMatch = appSource.match(/<div class="actions result-secondary-actions">([\s\S]*?)<\/div>/);
  assert.ok(secondaryActionsMatch, 'result secondary actions block should exist');
  assert.match(secondaryActionsMatch[1], /data-action="copy"/);
  assert.match(secondaryActionsMatch[1], /data-action="restart"/);
  assert.doesNotMatch(secondaryActionsMatch[1], /scroll-side-quest/);
  const resultCardMatch = appSource.match(/function renderResultCard[\s\S]*?function renderSideQuestFloat/);
  assert.ok(resultCardMatch, 'result card renderer should exist');
  assert.ok(
    resultCardMatch[0].indexOf('class="journey-summary"') < resultCardMatch[0].indexOf('data-action="share-image"')
      && resultCardMatch[0].indexOf('data-action="share-image"') < resultCardMatch[0].indexOf('data-action="toggle-details"'),
    'share image action should be the first primary action after the result summary'
  );
  assert.ok(appSource.includes('去支线任务'));
  assert.match(appSource, /gameplayti\.icu/);
  assert.match(appSource, /进入测试/);
  assert.match(appSource, /玩家群/);
  assert.match(appSource, /SIDE QUEST \/ 支线任务/);
  assert.match(appSource, /先不要关QAQ/);
  assert.match(appSource, /填问卷，参与周边抽奖/);
  assert.match(appSource, /光核训练营实习/);
  assert.doesNotMatch(appSource, /打开入口生成你的游戏灵魂职业/);
  assert.doesNotMatch(appSource, /drawWrappedCanvasText\(ctx, posterHref/);
  assert.doesNotMatch(appSource, /扫码/);
});
