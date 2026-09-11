import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { questions } from '../src/data/questions.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EXPECTED_CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';
const TRIAL_Q01_Q17_VISIBLE_COPY_SHA256 = 'f25d244e9e41ddf16178c0efdf33437ac5adc069f47243d922a457984ebc6eea';
const TRIAL_Q01_Q17_KEYWORDS_SHA256 = '603a341ee45126630db871e6927f24360fdafe10c1ae00054d407cc002cdc8c6';
const TRIAL_Q01_Q17_SCORING_METADATA_SHA256 = '544fad88c1cdc696b327c6a8b48e99980d4b916bfb7c29950b2defc84b43bd10';
const PREVIOUS_Q19_Q24_COPY_SHA256 = 'ae029964274c1326fa3b1fbcb3294ed76a1ea2f8587d81c484e88d9d12a24da1';

const firstTrialSamples = [
  {
    id: 'q01',
    title: '在追杀丝血BOSS的路上，你被小怪伸脚绊倒摔死了。你的辩解是：',
    options: [
      { id: 'a', text: '“问题不大，至少把小怪的地形杀机制试出来了。”' },
      { id: 'b', text: '“太耻辱了，我要去找这个小怪报仇。”' },
      { id: 'c', text: '“我只是想极限闪避，秀一下小怪，没想到失误了。”' },
      { id: 'd', text: '“不能怪我，主要是摔倒的动作太搞笑了，再看亿遍。”' },
    ],
  },
  {
    id: 'q02',
    title: '你在路边捡到了装备“布鲁斯的墨镜”，效果：“装备后，攻击时有概率召唤会骑摩托的狗子布鲁斯来帮你狠狠地踢敌人的屁股。”',
    options: [
      { id: 'a', text: '立刻装备。“好样的，布鲁斯！我只相信你。”' },
      { id: 'b', text: '装进背包。可以没用，不能没有，万一后面对付Boss有奇效呢。' },
      { id: 'c', text: '测一测。先搞明白召唤概率和布鲁斯的强度。' },
      { id: 'd', text: '分解。不能让我数值稳定变强的东西没有意义。' },
    ],
  },
];

const archiveSignatureSample = {
  id: 'q24',
  title: '最终，你来到一间没有门牌的档案室。管理员戴着一副看不出情绪的眼镜，把一本厚厚的冒险档案推到你面前。封面上写着：“请确认：这一路是否由你本人操作。”最后一页只有一个空格：你的结算签名。',
  options: [
    { id: 'a', text: '把名字写得像战斗宣言：别问，问就是我打出来的。' },
    { id: 'b', text: '打开完整结算面板，逐项核对' },
    { id: 'c', text: '先不签。你发现档案右下角还有三个没点亮的小图标。' },
    { id: 'd', text: '停顿很久。不是不签，只是有些名字不该被系统结算。' },
  ],
};

const terminalPressureQuestions18To23 = [
  {
    id: 'q18',
    title: 'boss副本刚开，你的队友在语音里说“我有复活币，随便打”。下一秒，队友被机关弹进坑里，还给你连打三个问号。',
    options: [
      { id: 'a', text: '先把机关节奏报清楚，再决定谁下去捞人。', keywords: ['控场', '机制', '稳健'] },
      { id: 'b', text: '暂停推进，检查复活币到底能不能跨地形生效。', keywords: ['稳健', '对冲', '机制'] },
      { id: 'c', text: '先安抚语音频道：问号可以打，知道你很急，但你先别急。', keywords: ['羁绊', '情绪', '控场'] },
      { id: 'd', text: '尝试卡bug，把队友卡回来，系统不讲武德你也会。', keywords: ['开图', '探索', '漏洞'] },
    ],
  },
  {
    id: 'q19',
    title: '最终补给点前，背包红点还亮着。一个道具写着：“带上我也许没用，但不带我会一直在你心里闪。”',
    options: [
      { id: 'a', text: '红点不灭不进门，翻烂背包也要先把道具找出来消掉红点。', keywords: ['清空', '上头', '收集'] },
      { id: 'b', text: '读完每条道具描述，确认哪些真能救命。', keywords: ['面板', '机制', '稳健'] },
      { id: 'c', text: '留下有故事的旧物，数值不高，但它陪你很久。', keywords: ['怀旧', '沉浸', '剧情'] },
      { id: 'd', text: '去地图边缘再刮一圈，说不定有隐藏扩容。', keywords: ['开图', '捡漏', '探索'] },
    ],
  },
  {
    id: 'q20',
    title: 'Boss血条终于清空，BGM却没有停。它慢慢站起来，头顶刷新第二行字：“刚才是热身。”',
    options: [
      { id: 'a', text: '趁它起身读条，赶紧把爆发全打出来。', keywords: ['莽', '速通', '压线'] },
      { id: 'b', text: '收手观察，假死血条一般都在骗贪刀的人。', keywords: ['预判', '稳健', '机制'] },
      { id: 'c', text: '提醒队友别庆祝，刚才谁喊赢了谁负责引仇恨。', keywords: ['控场', '羁绊', '嘴硬'] },
      { id: 'd', text: '看场地边缘有没有新机关，二阶段多半藏在那里。', keywords: ['探索', '机制', '开图'] },
    ],
  },
  {
    id: 'q21',
    title: '你刚被机制杀送回存档点，死亡回放里清楚写着：“贪了最后一刀。”你对自己说：',
    options: [
      { id: 'a', text: '刚才不算，我是在确认机制杀。', keywords: ['嘴硬', '机制', '莽'] },
      { id: 'b', text: '先重看回放，把安全区和读条时机记下来。', keywords: ['复盘', '背板', '稳健'] },
      { id: 'c', text: '给队友发一句：别学我，我这是反面教材。', keywords: ['整活', '羁绊', '氛围组'] },
      { id: 'd', text: '换条路进场，世界这么大，不该只有一种死法。', keywords: ['开图', '探索', '冷门'] },
    ],
  },
  {
    id: 'q22',
    title: '最终城门旁边突然冒出一个支线问号。NPC开口第一句是：“勇者，听我讲完这十年前的早饭。”',
    options: [
      { id: 'a', text: '先问奖励和流程，没收益直接跳过。', keywords: ['效率', '速通', '推理'] },
      { id: 'b', text: '听，但边听边找跳过点，尊重和进度都要。', keywords: ['稳健', '控场', '对冲'] },
      { id: 'c', text: '认真听完。万一这是全队最痛的伏笔呢？', keywords: ['剧情', '沉浸', '共鸣'] },
      { id: 'd', text: '绕着NPC后面的墙摸一圈，问号常藏第二层。', keywords: ['探索', '细节', '开图'] },
    ],
  },
  {
    id: 'q23',
    title: '最终战门口，系统弹出“请确认配装、药水、Buff和截图”。倒计时开始，你只够做一件事。',
    options: [
      { id: 'a', text: '直接进。药会过期，气势不会。', keywords: ['莽', '上头', '刺激'] },
      { id: 'b', text: '核对配装和抗性，别让最终战变成装备教学。', keywords: ['面板', '稳健', '机制'] },
      { id: 'c', text: '先截一张队伍合照，万一这是最后一个存档点。', keywords: ['羁绊', '仪式感', '怀旧'] },
      { id: 'd', text: '把门口两侧再搜一遍，最终战前必有遗漏。', keywords: ['收集', '开图', '捡漏'] },
    ],
  },
];

const terminalPressureScoring18To23 = [
  {
    id: 'q18',
    options: [
      { id: 'a', poles: { A: 1, T: 2, C: 1 } },
      { id: 'b', poles: { P: 2, T: 1, C: 2 } },
      { id: 'c', poles: { P: 1, I: 2, R: 2 } },
      { id: 'd', poles: { P: 1, W: 2, C: 1 } },
    ],
  },
  {
    id: 'q19',
    options: [
      { id: 'a', poles: { P: 1, T: 2, C: 2 } },
      { id: 'b', poles: { P: 1, T: 2, C: 1 } },
      { id: 'c', poles: { P: 1, I: 1, R: 2 } },
      { id: 'd', poles: { A: 1, W: 2, B: 1 } },
    ],
  },
  {
    id: 'q20',
    options: [
      { id: 'a', poles: { A: 2, T: 2, B: 1 } },
      { id: 'b', poles: { P: 2, T: 1, C: 2 } },
      { id: 'c', poles: { A: 1, I: 2, R: 2 } },
      { id: 'd', poles: { P: 1, W: 2, B: 1 } },
    ],
  },
  {
    id: 'q21',
    options: [
      { id: 'a', poles: { A: 2, T: 2, B: 2 } },
      { id: 'b', poles: { P: 2, T: 1, C: 2 } },
      { id: 'c', poles: { P: 1, I: 2, R: 2 } },
      { id: 'd', poles: { A: 1, W: 2, B: 1 } },
    ],
  },
  {
    id: 'q22',
    options: [
      { id: 'a', poles: { A: 1, T: 2, C: 1 } },
      { id: 'b', poles: { P: 1, I: 1, R: 2, C: 1 } },
      { id: 'c', poles: { P: 1, I: 2, R: 2 } },
      { id: 'd', poles: { P: 1, W: 2, C: 1 } },
    ],
  },
  {
    id: 'q23',
    options: [
      { id: 'a', poles: { A: 2, T: 1, B: 2 } },
      { id: 'b', poles: { P: 1, T: 2, C: 1 } },
      { id: 'c', poles: { P: 1, I: 1, R: 2 } },
      { id: 'd', poles: { P: 1, W: 2, C: 1 } },
    ],
  },
];

const archiveSignatureScoring = {
  id: 'q24',
  options: [
    { id: 'a', poles: { A: 2, T: 2, B: 2 } },
    { id: 'b', poles: { P: 2, T: 1, C: 2 } },
    { id: 'c', poles: { P: 1, W: 2, C: 1 } },
    { id: 'd', poles: { A: 1, W: 2, B: 1 } },
  ],
};

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function visibleCopyProjection(question) {
  return {
    id: question.id,
    title: question.title,
    options: question.options.map(({ id, text }) => ({ id, text })),
  };
}

function keywordProjection(question) {
  return {
    id: question.id,
    options: question.options.map(({ id, keywords }) => ({ id, keywords })),
  };
}

function scoringMetadataProjection(question) {
  return {
    id: question.id,
    options: question.options.map(({ id, poles }) => ({ id, poles })),
  };
}

function fallbackCopyProjection(question) {
  return {
    id: question.id,
    title: question.title,
    options: question.options.map(({ id, text, keywords }) => ({ id, text, keywords })),
  };
}

test('first 17 trial questions keep cleaned docx public copy and existing metadata', () => {
  const trialQuestions = questions.slice(0, 17);

  assert.equal(hash(trialQuestions.map(visibleCopyProjection)), TRIAL_Q01_Q17_VISIBLE_COPY_SHA256);
  assert.equal(hash(trialQuestions.map(keywordProjection)), TRIAL_Q01_Q17_KEYWORDS_SHA256);
  assert.equal(hash(trialQuestions.map(scoringMetadataProjection)), TRIAL_Q01_Q17_SCORING_METADATA_SHA256);
  assert.deepEqual(trialQuestions.slice(0, 2).map(visibleCopyProjection), firstTrialSamples);
});

test('questions 18 through 23 use terminal game-personality pressure-test copy', () => {
  assert.equal(questions.length, 24);
  assert.notEqual(hash(questions.slice(18).map(fallbackCopyProjection)), PREVIOUS_Q19_Q24_COPY_SHA256);
  assert.deepEqual(questions.slice(17, 23).map(fallbackCopyProjection), terminalPressureQuestions18To23);
});

test('questions 18 through 23 keep bounded GPTI scoring metadata by option position', () => {
  assert.deepEqual(questions.slice(17, 23).map(scoringMetadataProjection), terminalPressureScoring18To23);
});

test('original archive signature question moves from q18 to q24 with its metadata', () => {
  assert.deepEqual(visibleCopyProjection(questions[23]), archiveSignatureSample);
  assert.deepEqual(keywordProjection(questions[23]), {
    id: 'q24',
    options: [
      { id: 'a', keywords: ['莽', '嘴硬'] },
      { id: 'b', keywords: ['面板', '复盘', '背板'] },
      { id: 'c', keywords: ['清空', '开图'] },
      { id: 'd', keywords: ['沉浸', '剧情', '氛围组'] },
    ],
  });
  assert.deepEqual(scoringMetadataProjection(questions[23]), archiveSignatureScoring);
});

test('full fallback content version is declared consistently across runtime entry points', () => {
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');
  const analyticsSource = readFileSync(resolve(projectRoot, 'src/analytics.mjs'), 'utf8');
  const htmlVersion = html.match(/contentVersion:\s*'([^']+)'/)?.[1];
  const appVersion = appSource.match(/CONTENT_VERSION\s*=\s*'([^']+)'/)?.[1];
  const analyticsVersion = analyticsSource.match(/contentVersion:\s*'([^']+)'/)?.[1];

  assert.equal(htmlVersion, EXPECTED_CONTENT_VERSION);
  assert.equal(appVersion, EXPECTED_CONTENT_VERSION);
  assert.equal(analyticsVersion, EXPECTED_CONTENT_VERSION);
});
