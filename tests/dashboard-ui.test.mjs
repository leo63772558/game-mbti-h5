import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('dashboard UI exposes source filters without directly reading analytics_events', () => {
  const html = readFileSync(resolve(projectRoot, 'admin/dashboard.html'), 'utf8');
  const script = readFileSync(resolve(projectRoot, 'admin/dashboard.mjs'), 'utf8');

  assert.match(html, /id="host-filter"/);
  assert.match(html, /id="content-version"/);
  assert.match(html, /placeholder="content-2026-06-10-gpti-scoring-calibration-a"/);
  assert.match(html, /正式复盘建议填写 Host 和 Content Version/);
  assert.match(html, /分享相关操作/);
  assert.match(html, /当前选项：a\/b\/c\/d/);
  assert.match(html, /内部类型码/);
  assert.doesNotMatch(html, /score_\*/);
  assert.doesNotMatch(html, /分享意图/);
  assert.match(script, /searchParams\.set\('host'/);
  assert.match(script, /searchParams\.set\('contentVersion'/);
  assert.match(script, /核心指标、漏斗、题目、结果和分享明细均已按 Host \/ Content Version 筛选/);
  assert.match(script, /核心指标和细分模块按 date \+ channel 汇总；正式复盘请填写 Host \/ Content Version/);
  assert.match(script, /generate_share_image_click: '生成分享图'/);
  assert.match(script, /platform_share_click: '去平台晒图'/);
  assert.doesNotMatch(script, /analytics_events/);
});
