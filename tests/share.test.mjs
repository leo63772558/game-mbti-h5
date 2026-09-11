import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArchiveCode,
  getVersionedAssetSource,
  getResultAvatarSource,
  buildPlatformShareText,
  buildShareHref,
  buildShareText,
  buildResultSvg,
  splitTextLines,
} from '../src/share.mjs';
import { results } from '../src/data/results.mjs';

const result = {
  type: 'ATRB',
  rarity: '标准档案',
  identity: '高风险开团位',
  name: '狂战士',
  headline: '你先把世界按自己的方式撞开。',
  summary: '这是一段短解释，用于结果页和分享图首屏。',
  behaviorFragments: ['先动起来，再修正路线。'],
  charges: ['经常把普通选择玩成个人流派。', '嘴上说随便，实际已经在心里排完优先级。'],
  talent: '能快速找到适合自己的玩法入口。',
  weakness: '容易忽略完全相反的解法。',
  shareCTA: '把这张卡发给你的开黑搭子。',
  tags: ['莽', '上头'],
};

const report = {
  type: 'ATRB',
  answerCount: 24,
  keywordCounts: { 莽: 4 },
  poleScores: { A: 12, T: 10, R: 8, B: 6 },
  hiddenTrait: {
    id: 'scripted_gambler',
    name: '脚本赌徒',
    headline: '看起来像押命，其实全是练过。',
    copy: '你把高风险操作练成肌肉记忆。',
  },
};

const forbiddenPublicTokens = /#MBTI|INTJ|ENFP|EI|SN|TF|JP|ATRB|ATRC|ATWB|ATWC|AIRB|AIRC|AIWB|AIWC|PTRB|PTRC|PTWB|PTWC|PIRB|PIRC|PIWB|PIWC/;
const forbiddenInternalFieldTokens = /keywordCounts|poleScores|keywords|poles|pole|type code/i;

test('splitTextLines wraps long CJK strings without dropping characters', () => {
  const text = '世界末日倒计时还剩十分钟你在研究路边那只发光蘑菇能不能对话';
  const lines = splitTextLines(text, 12);

  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), text);
  assert.ok(lines.every((line) => line.length <= 12));
});

test('buildShareText includes result name and the current URL including channel parameters', () => {
  const text = buildShareText(result, 'https://example.com/?h5_channel=wechat_group');

  assert.match(text, /狂战士/);
  assert.match(text, /h5_channel=wechat_group/);
});

test('buildShareHref keeps the current h5_channel or adds the active channel', () => {
  assert.equal(
    buildShareHref('https://example.com/play?foo=1&h5_channel=friend_circle#result', 'wechat_group'),
    'https://example.com/play?foo=1&h5_channel=friend_circle'
  );

  assert.equal(
    buildShareHref('https://example.com/play?foo=1', 'xiaohongshu'),
    'https://example.com/play?foo=1&h5_channel=xiaohongshu'
  );
});

test('buildShareHref replaces invalid existing h5_channel with normalized current channel', () => {
  const href = buildShareHref('https://example.com/?h5_channel=<script>', 'wechat_group');
  const url = new URL(href);

  assert.equal(url.searchParams.get('h5_channel'), 'wechat_group');
});

test('buildArchiveCode creates public archive numbers without internal type codes', () => {
  assert.equal(buildArchiveCode(24), 'ARCHIVE-024');
  assert.equal(buildArchiveCode(6), 'ARCHIVE-006');
  assert.equal(buildArchiveCode(undefined), 'ARCHIVE-024');
  assert.doesNotMatch(buildArchiveCode(24), forbiddenPublicTokens);
});

test('getResultAvatarSource only returns ready non-empty avatar paths', () => {
  assert.equal(getResultAvatarSource({ ...result, avatarReady: true, avatar: './assets/avatars/ATRB.png' }), './assets/avatars/ATRB.png');
  assert.equal(
    getResultAvatarSource({ ...result, avatarReady: true, avatar: './assets/avatars/ATRB.png' }, 'content-2026-06-10-gpti-scoring-calibration-a'),
    './assets/avatars/ATRB.png?v=content-2026-06-10-gpti-scoring-calibration-a'
  );
  assert.equal(getResultAvatarSource({ ...result, avatarReady: false, avatar: './assets/avatars/ATRB.png' }), '');
  assert.equal(getResultAvatarSource({ ...result, avatarReady: true, avatar: '   ' }), '');
  assert.equal(getResultAvatarSource({ ...result, avatarReady: true }), '');
});

test('getVersionedAssetSource appends cache busting before hash fragments', () => {
  assert.equal(getVersionedAssetSource('./assets/avatars/ATRB.png', 'v1'), './assets/avatars/ATRB.png?v=v1');
  assert.equal(getVersionedAssetSource('./assets/avatars/ATRB.png?size=512', 'v1'), './assets/avatars/ATRB.png?size=512&v=v1');
  assert.equal(getVersionedAssetSource('./assets/avatars/ATRB.png#hero', 'v1'), './assets/avatars/ATRB.png?v=v1#hero');
  assert.equal(getVersionedAssetSource('data:image/png;base64,abc', 'v1'), 'data:image/png;base64,abc');
});

test('buildPlatformShareText returns platform-specific copy with the share URL', () => {
  const href = 'https://example.com/?h5_channel=xiaohongshu';

  const friendCircle = buildPlatformShareText(result, report, href, 'friend_circle');
  assert.match(friendCircle, /狂战士/);
  assert.match(friendCircle, /h5_channel=xiaohongshu/);
  assert.doesNotMatch(friendCircle, /#游戏搭子/);

  const xiaohongshu = buildPlatformShareText(result, report, href, 'xiaohongshu');
  assert.match(xiaohongshu, /#游戏人格测试/);

  const bilibili = buildPlatformShareText(result, report, href, 'bilibili');
  assert.match(bilibili, /动态/);

  const xiaoheihe = buildPlatformShareText(result, report, href, 'xiaoheihe');
  assert.match(xiaoheihe, /档案类型：高风险开团位/);
});

test('platform share copy does not expose MBTI tags or internal type codes', () => {
  const href = 'https://example.com/?h5_channel=xiaohongshu';

  for (const platform of ['friend_circle', 'xiaohongshu', 'bilibili', 'xiaoheihe', 'generic']) {
    const text = buildPlatformShareText(result, report, href, platform);

    assert.doesNotMatch(text, forbiddenPublicTokens, platform);
    assert.doesNotMatch(text, forbiddenInternalFieldTokens, platform);
  }
});

test('configured result-specific platform share copy stays public-safe', () => {
  const href = 'https://example.com/?h5_channel=xiaohongshu';

  for (const resultCopy of Object.values(results)) {
    for (const platform of ['friend_circle', 'xiaohongshu', 'bilibili', 'xiaoheihe', 'generic']) {
      const text = buildPlatformShareText(resultCopy, report, href, platform);

      assert.match(text, new RegExp(resultCopy.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(text, /h5_channel=xiaohongshu/);
      assert.doesNotMatch(text, forbiddenPublicTokens, `${resultCopy.name}.${platform}`);
      assert.doesNotMatch(text, forbiddenInternalFieldTokens, `${resultCopy.name}.${platform}`);
    }
  }
});

test('buildResultSvg uses GPTI short copy and hidden trait without exposing internal type codes', () => {
  const svg = buildResultSvg(result, report, 'https://example.com/?h5_channel=wechat_group');

  assert.match(svg, /标准档案/);
  assert.match(svg, /这是一段短解释/);
  assert.match(svg, /脚本赌徒/);
  assert.match(svg, /h5_channel=wechat_group/);
  assert.ok(svg.includes('<svg'));
  assert.ok((svg.match(/<text/g) ?? []).length > 8);
  assert.doesNotMatch(svg, /undefined/);
  assert.doesNotMatch(svg, forbiddenPublicTokens);
  assert.doesNotMatch(svg, forbiddenInternalFieldTokens);
});
