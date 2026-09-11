# GPTI 迁移加固与文档同步 Implementation Plan

> 当前状态说明：本文是 2026-05-23 迁移加固执行计划和过程记录，包含待办式步骤、历史 fixture 示例和实现片段，不是当前唯一状态文档。当前实现状态以 `README.md`、`specs/gpti-system-migration/tasks.md` 和 `docs/content/2026-05-23-GPTI内容输入模板与校验规则.md` 为准；同步到腾讯文档时不建议全文作为主口径发布。

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项实施本计划。步骤使用 checkbox（`- [ ]`）追踪。

**目标：** 在不改变 GPTI 已确认策略、不部署、不提交的前提下，完成 GPTI 新体系迁移的安全加固、兼容测试补齐和全量文档口径同步。

**架构：** 保持纯静态 H5 架构，前端仍由 `index.html` + 原生 ESM + CSS 组成。优先通过小型纯函数模块承载状态校验、HTML 转义和埋点去重逻辑，让风险点可用 Node 内置测试覆盖；CloudBase rollup/dashboard 行为默认保持不变，仅补 GPTI 新 payload 回归测试和文档解释。

**Tech Stack：** 原生 JavaScript ESM、Node.js 内置 `node:test`、静态资源构建脚本、CloudBase 云函数代码、中文 Markdown 文档。

---

## 执行约束

- 全程中文沟通，新增或修改的 Markdown 文档使用中文。
- 不引入 React / Vue / Next / Vite。
- 不部署、不提交、不推送，除非用户单独确认。
- 不把 token、密钥或敏感信息写入前端代码或仓库。
- 不提交 `dist/`、`server-*.log`、`.playwright-cli/`、`.vercel/`、`output/` 等产物。
- CloudBase 云函数行为、dashboard 统计口径、CORS、安全域名、环境变量、数据库集合、索引、权限和部署配置属于关键节点；本计划中只有用户确认后才执行对应变更。
- 已确认 GPTI 策略不改：24 题、标准 16 型唯一主结果、用户端默认不展示内部 type code、隐藏特质/稀有变体不覆盖主结果。

## 统一口径

- **当前正式体系：** GPTI 玩家人格体系。
- **当前内容版本：** `content-2026-05-23-gpti-a`。
- **用户端表达：** “异界开局人格测试”“游戏人格”“游戏灵魂职业”“异界职业档案”“隐藏特质 / 稀有变体”。
- **内部表达：** `ATRB / ATRC / ATWB / ATWC / AIRB / AIRC / AIWB / AIWC / PTRB / PTRC / PTWB / PTWC / PIRB / PIRC / PIWB / PIWC` 只作为代码、配置、测试和埋点内部 key。
- **历史表达：** `content-2026-05-21`、`dimension: EI`、`score_2` 属于旧样稿或历史数据兼容测试，不代表当前 GPTI payload。
- **CloudBase 口径：** 第一阶段保持现有 rollup/dashboard 指标形态，不新增正式的四轴分布、关键词热度、隐藏特质分布统计；只补兼容性与 GPTI payload 回归测试。
- **第一批短文案口径：** 当前可使用短兜底文案承载 GPTI 基础链路，但用户可见页面和分享图不应出现“GPTI 占位”“后续替换”等工程提示；正式长文案应通过新内容版本迭代。

## 文件边界

### 预计修改

- `scripts/build.mjs`：限制 `--out` 输出目录安全边界。
- `src/app.mjs`：接入状态版本校验、HTML 转义、埋点去重、隐藏特质 copy 展示。
- `src/state.mjs`：新增纯函数，管理 GPTI 状态 schema 与旧状态丢弃。
- `src/html.mjs`：新增纯函数，统一 HTML 文本与属性转义。
- `src/tracking-state.mjs`：新增纯函数，管理 `chapter_complete` / `test_complete` 去重标记。
- `src/share.mjs`：清洗已存在但非法的 `h5_channel`。
- `src/channel.mjs`：按需导出 `normalizeChannel`，供分享链接复用同一规则。
- `src/data/results.mjs`：替换用户可见工程占位文案为可上线的短兜底文案。
- `tests/build.test.mjs`：增加危险输出目录拒绝用例。
- `tests/state.test.mjs`：新增状态 schema 迁移测试。
- `tests/html.test.mjs`：新增 HTML 转义测试。
- `tests/tracking-state.test.mjs`：新增埋点去重状态测试。
- `tests/content.test.mjs`：加强用户端不可见字段、占位文案、HTML 转义接入和隐藏特质 copy guard。
- `tests/analytics-rollup.test.mjs`：新增 GPTI 当前 payload 聚合测试，保留 legacy fixture。
- `tests/dashboard-api.test.mjs`：新增 GPTI 当前聚合记录组合测试，保留 legacy fixture。
- `tests/share.test.mjs`：补非法 `h5_channel` 清洗测试。
- `README.md`：同步当前 GPTI 口径、文档索引、测试命令和历史文档说明。
- `DEPLOYMENT.md`：同步当前部署边界、CloudBase/CORS 风险和不部署约束。
- `specs/gpti-system-migration/requirements.md`：同步“当前实现状态 / 非目标 / 关键风险”。
- `specs/gpti-system-migration/design.md`：同步状态 schema、转义、埋点去重和 dashboard 兼容设计。
- `specs/gpti-system-migration/tasks.md`：补“迁移收敛加固”任务组和验收命令。
- `docs/content/2026-05-23-GPTI内容输入模板与校验规则.md`：补内容版本、占位文案、用户可见字段禁词和状态迁移说明。
- `docs/content/2026-05-22-内容输入与版本化迭代方案.md`：补 GPTI 当前版本与旧内容兼容说明。
- `docs/content/2026-05-21-题库与人格配置维护说明.md`：保留历史提示，补链接到 2026-05-23 标准模板。
- `docs/analytics/2026-05-19-埋点架构与事件方案.md`：补 GPTI payload 示例、隐藏特质字段和旧 payload 兼容说明。
- `docs/analytics/2026-05-20-数据看板与汇总方案.md`：补 GPTI option id、空 `dimension`、来源快照和 CORS 风险说明。
- `admin/dashboard.html` / `admin/dashboard.mjs`：仅同步可见标签与输入框提示文案；不改变统计口径。

### 仅在用户确认后修改

- `cloudbase/functions/dashboard_api/index.js`：修复 dashboard API CORS `Access-Control-Allow-Origin`。
- `cloudbase/functions/dashboard_api/cors.js`：如确认修复 CORS，新增纯函数承载 allowlist 逻辑。
- `tests/dashboard-cors.test.mjs`：如确认修复 CORS，新增 CORS 行为测试。

### 明确不修改

- CloudBase 数据库集合、索引、权限。
- CloudBase rollup/dashboard 聚合口径。
- 静态托管、HTTP 访问服务路由、安全域名、正式域名。
- 线上环境变量和密钥。
- 正式未定稿长文案。
- 正式头像、结果图、美术资源。

---

## 阶段 0：执行前基线确认

**Files:**
- Read only: 全项目
- Modify: 无
- Test: 无

- [ ] **Step 1：确认工作树与 ignored 产物**

Run:

```powershell
git status --short --ignored
git diff --stat
```

Expected:

```text
能解释所有已修改、新增和 ignored 产物；不清理用户未授权的产物；不提交。
```

- [ ] **Step 2：跑一次当前基线测试**

Run:

```powershell
node --test .\tests\*.test.mjs
npm run build
```

Expected:

```text
全部测试通过，构建通过。若失败，停下汇报失败命令、错误摘要和怀疑原因。
```

- [ ] **Step 3：确认实施方式**

推荐使用 subagent-driven，但边界必须固定：

```text
Subagent A：只改测试相关文件和新增纯函数测试草案，不改 src 实现。
Subagent B：只改 docs / specs / README / DEPLOYMENT / admin 可见说明，不改 src / tests。
Subagent C：只审查 src / scripts / cloudbase 设计，不直接落 CloudBase 行为变更。
主 agent：负责最终代码修改、冲突整合、测试运行和汇报。
```

如果用户选择 inline execution，则主 agent 按阶段顺序执行，每个关键节点停下确认。

---

## 阶段 1：构建输出目录安全加固

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`
- Test: `tests/build.test.mjs`

- [ ] **Step 1：先写危险输出目录测试**

在 `tests/build.test.mjs` 中增加 `spawnSync`：

```js
import { spawnSync } from 'node:child_process';
```

将现有构建产物测试的输出目录从系统临时目录改为项目内临时目录：

```js
const outDir = resolve(projectRoot, '.tmp-build-test');
```

新增测试：

```js
test('build script rejects output directories outside the project root', () => {
  const unsafeOutDir = mkdtempSync(join(tmpdir(), 'unsafe-game-mbti-build-'));

  try {
    const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out', unsafeOutDir], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside project root|unsafe output directory/i);
  } finally {
    rmSync(unsafeOutDir, { recursive: true, force: true });
  }
});

test('build script rejects project source directories as output targets', () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out', 'src'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe output directory|protected project path/i);
});
```

- [ ] **Step 2：运行测试确认失败**

Run:

```powershell
node --test .\tests\build.test.mjs
```

Expected:

```text
新增拒绝用例失败，说明当前脚本仍允许危险输出目录。
```

- [ ] **Step 3：实现输出目录边界**

在 `scripts/build.mjs` 中扩展 import：

```js
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
```

替换 `assertSafeOutputDir`：

```js
const protectedProjectEntries = new Set([
  'admin',
  'assets',
  'cloudbase',
  'docs',
  'index.html',
  'node_modules',
  'scripts',
  'specs',
  'src',
  'tests',
  'README.md',
  'DEPLOYMENT.md',
  'package.json',
  'vercel.json',
]);

function assertSafeOutputDir(targetDir) {
  if (!targetDir || targetDir === projectRoot || targetDir === parse(targetDir).root) {
    throw new Error(`Refusing to clear unsafe output directory: ${targetDir}`);
  }

  const relativeTarget = relative(projectRoot, targetDir);
  if (!relativeTarget || relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
    throw new Error(`Refusing to clear output directory outside project root: ${targetDir}`);
  }

  const [topLevelEntry] = relativeTarget.split(sep);
  if (protectedProjectEntries.has(topLevelEntry)) {
    throw new Error(`Refusing to clear protected project path as output directory: ${targetDir}`);
  }
}
```

- [ ] **Step 4：验证构建测试通过**

Run:

```powershell
node --test .\tests\build.test.mjs
```

Expected:

```text
全部 PASS，且 `.tmp-build-test` 被 finally 清理。
```

---

## 阶段 2：localStorage GPTI 状态 schema 迁移

**Files:**
- Create: `src/state.mjs`
- Modify: `src/app.mjs`
- Create: `tests/state.test.mjs`
- Test: `tests/state.test.mjs`

- [ ] **Step 1：新增状态纯函数失败测试**

创建 `tests/state.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATE_SCHEMA_VERSION,
  createInitialState,
  normalizeSavedState,
} from '../src/state.mjs';

const CONTENT_VERSION = 'content-2026-05-23-gpti-a';

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
        keywords: ['旧'],
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
```

- [ ] **Step 2：运行测试确认失败**

Run:

```powershell
node --test .\tests\state.test.mjs
```

Expected:

```text
FAIL：`src/state.mjs` 不存在。
```

- [ ] **Step 3：实现 `src/state.mjs`**

新增：

```js
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

export function normalizeSavedState(savedState, { contentVersion, fallbackChannel = 'default_channel' } = {}) {
  const channel = getString(savedState?.channel) || fallbackChannel;
  const initialState = createInitialState({ channel, contentVersion });

  if (!savedState || typeof savedState !== 'object' || Array.isArray(savedState)) return initialState;
  if (savedState.schemaVersion !== STATE_SCHEMA_VERSION) return initialState;
  if (savedState.contentVersion !== contentVersion) return initialState;

  const answers = Array.isArray(savedState.answers)
    ? savedState.answers.map(normalizeAnswer).filter(Boolean)
    : [];

  return {
    ...initialState,
    view: VALID_VIEWS.has(savedState.view) ? savedState.view : 'home',
    currentIndex: normalizeIndex(savedState.currentIndex),
    answers,
    startedAt: normalizeTimestamp(savedState.startedAt),
    trackedChapterCompletes: normalizeChapterIds(savedState.trackedChapterCompletes),
    testCompleteTracked: savedState.testCompleteTracked === true,
  };
}

function normalizeAnswer(answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const questionId = getString(answer.questionId);
  const optionId = getString(answer.optionId);
  if (!questionId || !VALID_OPTION_IDS.has(optionId)) return null;

  const poles = normalizePoles(answer.poles);
  return {
    questionId,
    optionId,
    keywords: Array.isArray(answer.keywords) ? answer.keywords.filter((item) => typeof item === 'string') : [],
    poles,
    answeredAt: normalizeTimestamp(answer.answeredAt),
  };
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
```

- [ ] **Step 4：接入 `src/app.mjs`**

在 `src/app.mjs` import：

```js
import { createInitialState, normalizeSavedState, STATE_SCHEMA_VERSION } from './state.mjs';
```

替换初始化：

```js
let state = mergeStateWithChannel(
  normalizeSavedState(loadState(), { contentVersion: CONTENT_VERSION }),
  window.location.search,
);
```

替换 `saveState`：

```js
function saveState() {
  state.schemaVersion = STATE_SCHEMA_VERSION;
  state.contentVersion = CONTENT_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

替换 `resetState` 中的 state 对象：

```js
state = createInitialState({
  channel: state.channel,
  contentVersion: CONTENT_VERSION,
});
```

在开始答题时确保 `startedAt` 初始化：

```js
state.startedAt = state.startedAt || Date.now();
```

- [ ] **Step 5：验证状态测试和核心测试**

Run:

```powershell
node --test .\tests\state.test.mjs
node --test .\tests\scoring.test.mjs .\tests\content.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 3：HTML 转义与用户可见字段防注入

**Files:**
- Create: `src/html.mjs`
- Modify: `src/app.mjs`
- Create: `tests/html.test.mjs`
- Modify: `tests/content.test.mjs`
- Test: `tests/html.test.mjs`, `tests/content.test.mjs`

- [ ] **Step 1：新增 HTML 转义测试**

创建 `tests/html.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeAttribute, escapeHtml } from '../src/html.mjs';

test('escapeHtml escapes text nodes without changing normal Chinese copy', () => {
  assert.equal(escapeHtml('异界职业档案'), '异界职业档案');
  assert.equal(escapeHtml('<script>alert("x")</script>&'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;');
});

test('escapeAttribute escapes attribute values', () => {
  assert.equal(escapeAttribute('" onerror="alert(1)'), '&quot; onerror=&quot;alert(1)');
  assert.equal(escapeAttribute("a'b"), 'a&#39;b');
});
```

- [ ] **Step 2：运行测试确认失败**

Run:

```powershell
node --test .\tests\html.test.mjs
```

Expected:

```text
FAIL：`src/html.mjs` 不存在。
```

- [ ] **Step 3：实现 `src/html.mjs`**

新增：

```js
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
```

- [ ] **Step 4：接入 `src/app.mjs` 动态内容**

在 `src/app.mjs` import：

```js
import { escapeAttribute, escapeHtml } from './html.mjs';
```

新增短别名：

```js
const text = escapeHtml;
const attr = escapeAttribute;
```

修改动态配置渲染点，包括：

```js
<span class="channel-pill">${text(state.channel)}</span>
<span>${text(chapter.title)}</span>
<h2>${text(question.title)}</h2>
<button class="choice${selected}" data-option-id="${attr(option.id)}" style="--choice-index:${index}">
  <span class="choice-prefix">路径 ${text(option.id.toUpperCase())}</span>
  <span class="choice-text">${text(option.text)}</span>
</button>
<h2>${text(completedChapter.feedback)}</h2>
```

结果页动态字段按同一规则改造：

```js
<article id="result-card" class="result-card" data-archive="${attr(archiveCode)}" data-rarity="${attr(result.rarity)}">
  <span>${text(result.rarity)}</span>
  <div class="identity-strip">职业谱系｜${text(result.identity)}</div>
  <img src="${attr(result.avatar)}" alt="${attr(`${result.name} 头像`)}" onerror="this.hidden=true; this.nextElementSibling.hidden=false" />
  <div class="avatar-placeholder" hidden>${text(result.name.slice(0, 2))}</div>
  <h1>${text(result.name)}</h1>
  <p class="headline">${text(result.headline)}</p>
  <div class="tags">${result.tags.map((tag) => `<span>#${text(tag)}</span>`).join('')}</div>
  <p>${text(result.summary)}</p>
</article>
```

数组字段改成：

```js
<ul class="behavior-list">${result.behaviorFragments.map((fragment) => `<li>${text(fragment)}</li>`).join('')}</ul>
<ul>${result.charges.map((charge) => `<li>${text(charge)}</li>`).join('')}</ul>
```

分享弹层中 `result.name`、`shareOverlayState.imageUrl`、`shareOverlayState.toast`、`platform.label` 等动态字段也使用 `text()` 或 `attr()`。

- [ ] **Step 5：补源码 guard**

在 `tests/content.test.mjs` 新增：

```js
test('app escapes dynamic content before inserting configuration copy into innerHTML templates', () => {
  const appSource = readFileSync(resolve(projectRoot, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /import\s+\{\s*escapeAttribute,\s*escapeHtml\s*\}\s+from '\.\/html\.mjs'/);
  assert.match(appSource, /const text = escapeHtml/);
  assert.match(appSource, /const attr = escapeAttribute/);
  assert.doesNotMatch(appSource, /\$\{option\.text\}/);
  assert.doesNotMatch(appSource, /\$\{question\.title\}/);
  assert.doesNotMatch(appSource, /\$\{result\.summary\}/);
  assert.doesNotMatch(appSource, /\$\{hiddenTrait\.headline\}/);
});
```

- [ ] **Step 6：验证**

Run:

```powershell
node --test .\tests\html.test.mjs .\tests\content.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 4：章节完成与测试完成埋点去重

**Files:**
- Create: `src/tracking-state.mjs`
- Modify: `src/app.mjs`
- Create: `tests/tracking-state.test.mjs`
- Test: `tests/tracking-state.test.mjs`

- [ ] **Step 1：新增去重状态测试**

创建 `tests/tracking-state.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  markChapterCompleteTracked,
  markTestCompleteTracked,
} from '../src/tracking-state.mjs';

test('markChapterCompleteTracked tracks each chapter once', () => {
  const state = { trackedChapterCompletes: [] };

  assert.equal(markChapterCompleteTracked(state, 1), true);
  assert.deepEqual(state.trackedChapterCompletes, [1]);
  assert.equal(markChapterCompleteTracked(state, 1), false);
  assert.deepEqual(state.trackedChapterCompletes, [1]);
  assert.equal(markChapterCompleteTracked(state, 2), true);
  assert.deepEqual(state.trackedChapterCompletes, [1, 2]);
});

test('markTestCompleteTracked tracks test_complete once', () => {
  const state = {};

  assert.equal(markTestCompleteTracked(state), true);
  assert.equal(state.testCompleteTracked, true);
  assert.equal(markTestCompleteTracked(state), false);
});
```

- [ ] **Step 2：运行测试确认失败**

Run:

```powershell
node --test .\tests\tracking-state.test.mjs
```

Expected:

```text
FAIL：`src/tracking-state.mjs` 不存在。
```

- [ ] **Step 3：实现 `src/tracking-state.mjs`**

新增：

```js
export function markChapterCompleteTracked(state, chapterId) {
  const normalizedChapterId = Number(chapterId);
  if (!Number.isInteger(normalizedChapterId) || normalizedChapterId <= 0) return false;

  if (!Array.isArray(state.trackedChapterCompletes)) state.trackedChapterCompletes = [];
  if (state.trackedChapterCompletes.includes(normalizedChapterId)) return false;

  state.trackedChapterCompletes.push(normalizedChapterId);
  return true;
}

export function markTestCompleteTracked(state) {
  if (state.testCompleteTracked === true) return false;
  state.testCompleteTracked = true;
  return true;
}
```

- [ ] **Step 4：接入 `src/app.mjs`**

import：

```js
import { markChapterCompleteTracked, markTestCompleteTracked } from './tracking-state.mjs';
```

替换 `renderChapterBreak()` 中的直接 track：

```js
if (markChapterCompleteTracked(state, completedChapter.id)) {
  saveState();
  track('chapter_complete', {
    page_id: 'quiz',
    chapter: completedChapter.id,
    answered_count: state.answers.length,
    duration_ms: getTestDurationMs(),
  });
}
```

替换 `renderGenerating()` 中的 `test_complete` 直接 track：

```js
if (markTestCompleteTracked(state)) {
  saveState();
  track('test_complete', {
    page_id: 'generating',
    duration_ms: getTestDurationMs(),
    result_type_internal: report.type,
    result_name: result.name,
    hidden_trait_id: report.hiddenTrait?.id ?? '',
    hidden_trait_name: report.hiddenTrait?.name ?? '',
    confidence_avg: getConfidenceAverage(report),
    low_confidence_count: getLowConfidenceCount(report),
  });
  void flushAnalytics();
}
```

- [ ] **Step 5：验证去重测试与埋点测试**

Run:

```powershell
node --test .\tests\tracking-state.test.mjs .\tests\analytics.test.mjs .\tests\content.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 5：用户可见占位文案收敛

**Files:**
- Modify: `src/data/results.mjs`
- Modify: `tests/content.test.mjs`
- Test: `tests/content.test.mjs`, `tests/share.test.mjs`

- [ ] **Step 1：先加用户可见占位文案 guard**

在 `tests/content.test.mjs` 增加：

```js
const USER_VISIBLE_PLACEHOLDER_PATTERN = /占位|后续|替换|GPTI\s*占位|跑通|校验|结果结构/i;
```

扩展 `assertPublicCopy`：

```js
assert.doesNotMatch(String(value), USER_VISIBLE_PLACEHOLDER_PATTERN, `${label} exposes implementation placeholder copy`);
```

仅对用户可见字段调用。内部字段、文档和测试 fixture 不走这个断言。

- [ ] **Step 2：运行测试确认失败**

Run:

```powershell
node --test .\tests\content.test.mjs
```

Expected:

```text
FAIL：`src/data/results.mjs` 中 summary / longCopy / worldCopy / playerCopy 至少有用户可见工程占位描述。
```

- [ ] **Step 3：替换 `src/data/results.mjs` 用户可见兜底短文案**

保持结构，不补正式长文案。将当前工程提示改为用户可见的中性短文案：

```js
summary: '你会先把局面拆成能行动的线索，再用自己的节奏推进这场冒险。',
longCopy: '你不是单纯跟着任务走的人，更像会把规则、队友和风险一起读进地图里的玩家。',
worldCopy: '在异界档案里，这类角色通常先找到自己的行动入口，再决定要不要相信世界给出的路线。',
playerCopy: '你做选择时会留下明显风格：有人看见效率，有人看见情绪，有人看见你对未知的敏感。',
```

如果要让 16 型更有差异，不改变结构的最小做法是增加四组短文案数组，并按 `index` 轮换；正式文案接入时再替换为每型独立内容。

- [ ] **Step 4：隐藏特质 copy 展示**

在 `renderResultCard()` 的隐藏特质区域增加：

```js
<p>${text(hiddenTrait.headline)}</p>
${hiddenTrait.copy ? `<p>${text(hiddenTrait.copy)}</p>` : ''}
```

同时在 `tests/content.test.mjs` 对 `trait.copy` 继续校验公开文案：

```js
assertPublicCopy(trait.copy, `${trait.id}.copy`);
```

- [ ] **Step 5：验证**

Run:

```powershell
node --test .\tests\content.test.mjs .\tests\share.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 6：GPTI payload 到 rollup/dashboard 的回归测试

**Files:**
- Modify: `tests/analytics-rollup.test.mjs`
- Modify: `tests/dashboard-api.test.mjs`
- Test: `tests/analytics-rollup.test.mjs`, `tests/dashboard-api.test.mjs`

- [ ] **Step 1：rollup 增加当前 GPTI payload 用例**

在 `tests/analytics-rollup.test.mjs` 增加常量：

```js
const GPTI_CONTENT_VERSION = 'content-2026-05-23-gpti-a';
```

新增测试：

```js
test('aggregateEvents supports current GPTI four-option payload without legacy score fields', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }, {
      session_id: 'gpti-session-1',
      anon_id: 'gpti-anon-1',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('test_start', { page_id: 'home' }, {
      session_id: 'gpti-session-1',
      anon_id: 'gpti-anon-1',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('question_view', {
      page_id: 'quiz',
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
    }, {
      session_id: 'gpti-session-1',
      anon_id: 'gpti-anon-1',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('question_answer', {
      page_id: 'quiz',
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      option_id: 'a',
      keywords: ['莽', '效率'],
      poles: { A: 2, T: 2, B: 1 },
      time_spent_ms: 4800,
      is_change: false,
    }, {
      session_id: 'gpti-session-1',
      anon_id: 'gpti-anon-1',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('test_complete', {
      page_id: 'generating',
      duration_ms: 93000,
      result_type_internal: 'ATRB',
      result_name: '狂战士',
      hidden_trait_id: 'scripted_gambler',
      hidden_trait_name: '脚本赌徒',
      confidence_avg: 0.62,
      low_confidence_count: 1,
    }, {
      session_id: 'gpti-session-1',
      anon_id: 'gpti-anon-1',
      content_version: GPTI_CONTENT_VERSION,
    }),
  ]);

  const question = records[COLLECTIONS.questionDaily].find((item) => item.question_id === 'q01');
  assert.equal(question.dimension, '');
  assert.deepEqual(question.option_distribution, { a: 1 });

  const result = records[COLLECTIONS.resultDaily].find((item) => item.result_type_internal === 'ATRB');
  assert.equal(result.result_name, '狂战士');
  assert.equal(result.complete_sessions, 1);
  assert.equal(result.avg_confidence, 0.62);
});
```

- [ ] **Step 2：dashboard API 增加当前 GPTI 聚合记录用例**

在 `tests/dashboard-api.test.mjs` 增加：

```js
const GPTI_CONTENT_VERSION = 'content-2026-05-23-gpti-a';
```

新增测试：

```js
test('buildDashboardResponse combines current GPTI aggregate records with option ids a-d', () => {
  const response = buildDashboardResponse({
    [COLLECTIONS.dailySummary]: [{
      date: '2026-05-23',
      channel: 'wechat_group',
      pv: 2,
      uv: 1,
      sessions: 1,
      test_start_sessions: 1,
      test_complete_sessions: 1,
      result_view_sessions: 1,
      share_action_sessions: 0,
      completion_rate: 1,
      result_share_rate: 0,
      event_counts: { question_answer: 1 },
    }],
    [COLLECTIONS.funnelDaily]: [],
    [COLLECTIONS.questionDaily]: [{
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: '',
      view_count: 1,
      view_sessions: 1,
      answer_count: 1,
      answer_sessions: 1,
      answer_rate: 1,
      avg_time_spent_ms: 4800,
      time_spent_count: 1,
      option_distribution: { a: 1 },
    }],
    [COLLECTIONS.resultDaily]: [{
      result_type_internal: 'ATRB',
      result_name: '狂战士',
      complete_count: 1,
      complete_sessions: 1,
      result_view_count: 1,
      result_view_sessions: 1,
      share_of_completions: 1,
      avg_confidence: 0.62,
      confidence_count: 1,
      avg_duration_ms: 93000,
      duration_count: 1,
    }],
    [COLLECTIONS.shareDaily]: [],
    [COLLECTIONS.sourceDaily]: [],
  }, {
    from: '2026-05-23',
    to: '2026-05-23',
    days: 1,
    channel: 'wechat_group',
    host: '',
    contentVersion: '',
    timezone: 'Asia/Shanghai',
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.questions[0].option_distribution, { a: 1 });
  assert.equal(response.questions[0].dimension, '');
  assert.equal(response.results[0].result_type_internal, 'ATRB');
  assert.equal(response.results[0].result_name, '狂战士');
});
```

- [ ] **Step 3：验证**

Run:

```powershell
node --test .\tests\analytics-rollup.test.mjs .\tests\dashboard-api.test.mjs
```

Expected:

```text
全部 PASS；legacy fixture 继续保留，当前 GPTI fixture 明确独立。
```

---

## 阶段 7：分享链接与内容校验小修

**Files:**
- Modify: `src/channel.mjs`
- Modify: `src/share.mjs`
- Modify: `tests/share.test.mjs`
- Modify: `tests/content.test.mjs`
- Test: `tests/share.test.mjs`, `tests/content.test.mjs`

- [ ] **Step 1：补非法已有 `h5_channel` 测试**

在 `tests/share.test.mjs` 增加：

```js
test('buildShareHref replaces invalid existing h5_channel with normalized current channel', () => {
  const href = buildShareHref('https://example.com/?h5_channel=<script>', 'wechat_group');
  const url = new URL(href);

  assert.equal(url.searchParams.get('h5_channel'), 'wechat_group');
});
```

- [ ] **Step 2：导出并复用 channel normalize**

在 `src/channel.mjs` 将：

```js
function normalizeChannel(channel) {
```

改为：

```js
export function normalizeChannel(channel) {
```

在 `src/share.mjs` import：

```js
import { normalizeChannel } from './channel.mjs';
```

修改 `buildShareHref`：

```js
const normalizedChannel = normalizeChannel(channel);
const existingChannel = url.searchParams.get('h5_channel');
if (existingChannel && normalizeChannel(existingChannel) !== existingChannel) {
  url.searchParams.delete('h5_channel');
}
if (!url.searchParams.get('h5_channel') && normalizedChannel !== 'default_channel') {
  url.searchParams.set('h5_channel', normalizedChannel);
}
```

- [ ] **Step 3：拆分 `polesMin` 校验语义**

在 `tests/content.test.mjs` 保留选项 `poles` 的小范围校验，但为隐藏特质阈值新增函数：

```js
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
```

将隐藏特质 `polesMin` 校验改为：

```js
if (trait.conditions.polesMin) assertPoleMinimumObject(trait.conditions.polesMin, `${trait.id}.conditions.polesMin`);
```

- [ ] **Step 4：验证**

Run:

```powershell
node --test .\tests\share.test.mjs .\tests\content.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 8：全量文档和 admin 可见说明同步

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`
- Modify: `specs/gpti-system-migration/requirements.md`
- Modify: `specs/gpti-system-migration/design.md`
- Modify: `specs/gpti-system-migration/tasks.md`
- Modify: `docs/content/2026-05-23-GPTI内容输入模板与校验规则.md`
- Modify: `docs/content/2026-05-22-内容输入与版本化迭代方案.md`
- Modify: `docs/content/2026-05-21-题库与人格配置维护说明.md`
- Modify: `docs/analytics/2026-05-19-埋点架构与事件方案.md`
- Modify: `docs/analytics/2026-05-20-数据看板与汇总方案.md`
- Modify: `admin/dashboard.html`
- Modify: `admin/dashboard.mjs`
- Test: `tests/content.test.mjs`, `tests/dashboard-ui.test.mjs`

- [ ] **Step 1：README 同步**

更新点：

```markdown
- 当前内容版本：`content-2026-05-23-gpti-a`。
- 当前状态 schema：localStorage 只恢复同 schema、同 contentVersion 的 GPTI 状态；旧 `score_*` 状态会回到首页。
- 2026-05-21 维护说明是历史旧样稿说明，当前内容录入以 2026-05-23 GPTI 模板为准。
- legacy analytics 测试中的 `content-2026-05-21`、`dimension`、`score_*` 只验证历史数据兼容。
- 用户可见页面和分享图不展示 ATRB/ATRC 等内部 type code。
```

测试命令保留 Windows 写法，并增加跨平台写法：

```powershell
npm test
node --test .\tests\*.test.mjs
```

```bash
node --test "tests/*.test.mjs"
```

- [ ] **Step 2：DEPLOYMENT 同步**

更新点：

```markdown
- 当前不部署；完成本地测试和用户确认后再部署。
- Vercel 预览入口与 CloudBase API 关系保持现状。
- Dashboard API 如跨域带 `Authorization`，需要明确 CORS allowlist；未确认前不改 CloudBase 函数和安全域名。
- 发布前必须确认用户端无工程占位文案、无内部 type code、无敏感信息。
```

- [ ] **Step 3：specs 同步**

`requirements.md` 增加：

```markdown
### 迁移收敛要求

- GPTI 24 题是第一版唯一正式题量。
- 标准 16 型是唯一主结果。
- 隐藏特质 / 稀有变体只作为附加解释。
- 用户端不展示内部 type code。
- 旧 `content-2026-05-21` analytics 数据保持兼容，不代表当前 payload。
```

`design.md` 增加：

```markdown
### 状态与安全设计

- 本地状态带 `schemaVersion` 和 `contentVersion`。
- 配置文案进入 `innerHTML` 前必须 HTML escape。
- `chapter_complete` 与 `test_complete` 通过持久化标记去重。
- rollup/dashboard 第一阶段保持旧聚合形态，GPTI option id 以 `a/b/c/d` 进入 `option_distribution`。
```

`tasks.md` 增加加固任务组：

```markdown
## 迁移收敛加固

- [ ] 构建输出目录安全边界。
- [ ] localStorage GPTI schema 迁移。
- [ ] 用户可见动态文案 HTML 转义。
- [ ] 章节完成和测试完成埋点去重。
- [ ] GPTI rollup/dashboard payload 回归测试。
- [ ] 全量文档口径同步。
```

- [ ] **Step 4：content 文档同步**

`2026-05-23-GPTI内容输入模板与校验规则.md` 增加：

```markdown
### 用户可见禁词

结果名、身份、标签、短解释、隐藏特质展示、分享文案中不得出现：

- `ATRB` / `ATRC` 等内部 type code
- `MBTI` / `16 型人格` / `INTJ` 等旧体系表达
- `GPTI 占位` / `后续替换` / `跑通技术链路` 等工程提示
```

`2026-05-22-内容输入与版本化迭代方案.md` 增加：

```markdown
当前 GPTI 内容版本为 `content-2026-05-23-gpti-a`。当题库、结果解释或隐藏特质规则影响用户理解或结果分布时，递增 `contentVersion`，并让旧 localStorage 状态失效回到首页。
```

`2026-05-21-题库与人格配置维护说明.md` 保留历史提示并补：

```markdown
当前内容录入、校验和版本化规则以 `2026-05-23-GPTI内容输入模板与校验规则.md` 为准。本文件只用于理解旧样稿迁移来源。
```

- [ ] **Step 5：analytics 文档同步**

`2026-05-19-埋点架构与事件方案.md` 增加 GPTI payload 示例：

```json
{
  "event_name": "question_answer",
  "content_version": "content-2026-05-23-gpti-a",
  "payload": {
    "question_id": "q01",
    "question_index": 1,
    "chapter": 1,
    "option_id": "a",
    "keywords": ["莽", "效率", "速通"],
    "poles": { "A": 2, "T": 2, "B": 1 },
    "time_spent_ms": 4800,
    "is_change": false
  }
}
```

并明确：

```markdown
`dimension` / `score` / `score_2` 属于旧 payload；新前端不再发送，但 rollup/dashboard 测试保留历史兼容 fixture。
```

`2026-05-20-数据看板与汇总方案.md` 增加：

```markdown
第一阶段看板不新增 GPTI 四轴分布、关键词热度或隐藏特质分布。题目选项分布中，当前 GPTI option id 为 `a/b/c/d`；旧数据可能仍显示 `score_*`。`dimension` 在当前 GPTI payload 下为空字符串，保留字段仅用于兼容历史聚合表。
```

- [ ] **Step 6：admin 可见说明同步**

`admin/dashboard.html` / `admin/dashboard.mjs` 的文案只做说明同步：

```text
contentVersion 输入框提示使用 `content-2026-05-23-gpti-a`。
题目分布说明使用 “选项分布（GPTI 为 a/b/c/d；历史数据可能为 score_*）”。
结果表仍显示内部 type code，因为 admin 是内部看板，不属于用户端。
```

- [ ] **Step 7：验证文档相关测试**

Run:

```powershell
node --test .\tests\content.test.mjs .\tests\dashboard-ui.test.mjs
```

Expected:

```text
全部 PASS。
```

---

## 阶段 9：CloudBase dashboard API CORS 修复确认点

**状态：关键节点，先停下让用户确认。**

**Files if approved:**
- Create: `cloudbase/functions/dashboard_api/cors.js`
- Modify: `cloudbase/functions/dashboard_api/index.js`
- Create: `tests/dashboard-cors.test.mjs`
- Test: `tests/dashboard-cors.test.mjs`

**不确认则不执行。**

- [ ] **Step 1：确认是否修改 CloudBase 函数行为**

需要用户明确确认：

```text
是否允许修改 `cloudbase/functions/dashboard_api/index.js`，增加 dashboard API CORS allowlist？
```

- [ ] **Step 2：如确认，先写 CORS 纯函数测试**

创建 `tests/dashboard-cors.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAllowedCorsOrigin,
  parseAllowedOrigins,
} from '../cloudbase/functions/dashboard_api/cors.js';

test('parseAllowedOrigins splits env allowlist', () => {
  assert.deepEqual(parseAllowedOrigins('https://a.example, https://b.example'), [
    'https://a.example',
    'https://b.example',
  ]);
});

test('getAllowedCorsOrigin returns matching allowed origin', () => {
  const allowedOrigins = parseAllowedOrigins('https://demo-phi-pearl.vercel.app,https://example.com');

  assert.equal(getAllowedCorsOrigin('https://demo-phi-pearl.vercel.app', allowedOrigins), 'https://demo-phi-pearl.vercel.app');
  assert.equal(getAllowedCorsOrigin('https://evil.example', allowedOrigins), '');
});
```

- [ ] **Step 3：新增 CORS helper**

`cloudbase/functions/dashboard_api/cors.js`：

```js
function parseAllowedOrigins(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedCorsOrigin(origin = '', allowedOrigins = []) {
  if (!origin) return '';
  return allowedOrigins.includes(origin) ? origin : '';
}

module.exports = {
  getAllowedCorsOrigin,
  parseAllowedOrigins,
};
```

- [ ] **Step 4：接入 dashboard API**

`cloudbase/functions/dashboard_api/index.js`：

```js
const {
  getAllowedCorsOrigin,
  parseAllowedOrigins,
} = require('./cors');
```

改造 `setCorsHeaders`：

```js
function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedCorsOrigin(
    req.headers.origin,
    parseAllowedOrigins(process.env.DASHBOARD_ALLOWED_ORIGINS),
  );
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dashboard-Token');
}
```

调用处改为：

```js
setCorsHeaders(req, res);
```

- [ ] **Step 5：验证**

Run:

```powershell
node --test .\tests\dashboard-cors.test.mjs .\tests\dashboard-api.test.mjs
```

Expected:

```text
全部 PASS。
```

**部署说明：** 代码修复后仍不部署。部署、环境变量 `DASHBOARD_ALLOWED_ORIGINS`、CloudBase 安全域名和正式域名配置必须单独确认。

---

## 阶段 10：总体验证与敏感信息检查

**Files:**
- Read only: 全项目
- Modify: 无
- Test: 全量测试与构建

- [ ] **Step 1：运行全量测试**

Run:

```powershell
node --test .\tests\*.test.mjs
```

Expected:

```text
所有测试 PASS。若失败，停下汇报失败文件、失败断言和最近改动。
```

- [ ] **Step 2：运行构建**

Run:

```powershell
npm run build
```

Expected:

```text
构建通过；`dist/` 是 ignored 产物，不提交。
```

- [ ] **Step 3：敏感信息扫描**

Run:

```powershell
rg -n --hidden --glob '!dist/**' --glob '!output/**' --glob '!.vercel/**' --glob '!.playwright-cli/**' --glob '!server-*.log' "(token|secret|password|DASHBOARD_TOKEN|apiKey|apikey|密钥|令牌)" .
```

Expected:

```text
只允许命中文档中的占位说明、环境变量名、输入框名或测试说明；不得出现真实 token、密钥或密码。
```

- [ ] **Step 4：检查 ignored 产物和工作树**

Run:

```powershell
git status --short --ignored
git diff --stat
```

Expected:

```text
能逐项解释修改文件；ignored 产物仍不纳入提交；不提交、不部署。
```

- [ ] **Step 5：最终汇报**

汇报必须包含：

```text
修改文件清单
验证命令与结果
敏感信息扫描结论
未触碰事项
剩余风险
下一阶段建议
需要用户确认的关键节点
```

---

## 风险与回滚方案

- **构建脚本安全边界过严：** 如果某个托管流程依赖项目外 `--out`，回滚方式是将测试输出改为项目内目录并保留默认 `dist`；不恢复任意路径递归删除能力。
- **状态迁移影响正在答题用户：** 只在 `schemaVersion` 或 `contentVersion` 不匹配时回首页，避免旧 `score_*` 状态误出结果。回滚方式是移除 `normalizeSavedState` 接入，但保留测试说明该风险会重新出现。
- **HTML 转义导致样式或文案显示变化：** 转义只作用于动态配置字段，静态模板不变。回滚方式是定位具体字段恢复，但不得恢复对题库/结果配置的裸插值。
- **埋点去重改变统计量：** 去重会降低刷新或恢复导致的重复 `chapter_complete` / `test_complete`。这是修复目标，不影响 `question_answer` 和 `result_view` 当前逻辑。
- **占位文案替换影响内容审稿：** 替换为中性短文案只去掉工程提示，不声明最终人格解释。正式文案接入时按 2026-05-23 模板替换。
- **GPTI 聚合测试暴露 dashboard 字段仍有 `dimension`：** 第一阶段保留该字段用于历史兼容；文档明确当前 GPTI 下为空字符串。
- **CORS 修复涉及 CloudBase 行为和环境变量：** 本计划将其隔离为关键确认阶段，不默认执行。

回滚方式统一使用文件级小补丁或反向补丁；不使用 `git reset --hard`、`git checkout --` 等破坏性命令，除非用户明确要求。

## 关键停止点

- 开始阶段 1 代码修改前，需要用户确认执行计划。
- 发现 spec 与代码/文档明显冲突时停下。
- 需要改变 GPTI 策略时停下。
- 需要修改 CloudBase 函数、路由、CORS、安全域名、环境变量、数据库集合、索引或权限时停下。
- 需要部署 CloudBase 或改正式域名时停下。
- 测试或构建结果与预期不一致时停下。
- 提交或推送前停下。

## 建议执行顺序

1. 阶段 0：基线确认。
2. 阶段 1：构建安全边界。
3. 阶段 2：状态 schema 迁移。
4. 阶段 3：HTML 转义。
5. 阶段 4：埋点去重。
6. 阶段 5：用户可见占位文案收敛。
7. 阶段 6：GPTI rollup/dashboard 回归测试。
8. 阶段 7：分享链接与内容校验小修。
9. 阶段 8：全量文档和 admin 可见说明同步。
10. 阶段 10：总体验证。
11. 阶段 9：CloudBase CORS 修复作为单独确认项执行。

## 自检

- 覆盖安全问题：阶段 1、阶段 3、阶段 10。
- 覆盖 GPTI 迁移状态问题：阶段 2、阶段 5、阶段 6、阶段 8。
- 覆盖 analytics legacy fixture 解释：阶段 6、阶段 8。
- 覆盖 `.choice-keywords` 死样式后续风险：已在现有清理中删除，本计划仅保留 content guard。
- 覆盖 2026-05-21 历史旧体系提示：阶段 8。
- 覆盖 CloudBase 保持不动：执行约束、阶段 6、阶段 9。
- 覆盖测试与构建：阶段 0、各阶段局部测试、阶段 10。
- 覆盖不做事项：执行约束和文件边界。
