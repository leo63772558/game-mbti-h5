# GPTI 新体系迁移设计

## 1. 设计结论

第一版 GPTI 迁移采用稳定优先方案：

- 保持 24 题作为第一版目标题量。
- 用户端默认不展示 `ATRB` / `ATRC` 等内部 type code，只展示中文结果名、身份、标签和短解释。
- 标准 16 型是唯一主结果。
- 隐藏人格收敛为“隐藏特质 / 稀有变体”，作为附加展示，不覆盖主结果。
- 前端先完成 GPTI 数据结构、评分、四选项答题、结果页和分享图适配。
- CloudBase rollup / dashboard 第一阶段尽量兼容现有结果分布和题目选项分布；关键词热度、四轴分布和隐藏特质分布放到后续阶段。

## 2. 架构边界

当前项目是纯静态 H5，继续保持：

```text
index.html
src/
  app.mjs
  scoring.mjs
  share.mjs
  state.mjs
  html.mjs
  tracking-state.mjs
  data/
    gpti.mjs
    questions.mjs
    results.mjs
    traits.mjs
tests/
cloudbase/
admin/
```

GPTI 迁移会影响：

- `src/data/questions.mjs`
- `src/data/results.mjs`
- `src/scoring.mjs`
- `src/app.mjs`
- `src/share.mjs`
- `src/styles.css`
- `tests/content.test.mjs`
- `tests/scoring.test.mjs`
- 相关分享、analytics、build 测试

GPTI 第一阶段不直接修改：

- CloudBase 环境配置。
- CloudBase 静态托管。
- HTTP 访问服务路由。
- 数据库权限、索引或集合。
- dashboard token 或密钥配置。

## 3. 数据模型

### 3.1 GPTI 常量

已新增独立内容定义文件，避免 scorer 内硬编码过多常量：

```text
src/data/gpti.mjs
```

建议结构：

```js
export const GPTI_POLES = ['A', 'P', 'T', 'I', 'R', 'W', 'B', 'C'];

export const GPTI_AXES = [
  { id: 'initiative', left: 'A', right: 'P', label: '行动发起' },
  { id: 'mode', left: 'T', right: 'I', label: '行为模式' },
  { id: 'focus', left: 'R', right: 'W', label: '关注对象' },
  { id: 'risk', left: 'B', right: 'C', label: '风险偏好' },
];

export const GPTI_TYPES = [
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

export const GPTI_KEYWORDS = [
  '莽',
  '上头',
  '预判',
  '复盘',
  '稳健',
  '效率',
  '速通',
  '嘴硬',
  '机制',
  '公式',
  '漏洞',
  '背板',
  '推理',
  '拆解',
  '控场',
  '冷门',
  '探索',
  '支线',
  '开图',
  '漫游',
  '收集',
  '氛围',
  '细节',
  '沉浸',
  '剧情',
  '羁绊',
  '共鸣',
  '审美',
  '仪式感',
  '怀旧',
  '情绪',
  '白月光',
];
```

### 3.2 题库

旧结构：

```js
{
  id: 'q01',
  chapter: 1,
  dimension: 'EI',
  weight: 1,
  title: '...',
  leftChoice: '...',
  rightChoice: '...',
}
```

新结构：

```js
{
  id: 'q01',
  chapter: 1,
  title: '...',
  options: [
    {
      id: 'a',
      text: '...',
      keywords: ['莽', '效率', '速通'],
      poles: { A: 2, T: 2, B: 1 },
    },
    {
      id: 'b',
      text: '...',
      keywords: ['稳健', '推理', '细节'],
      poles: { P: 1, W: 1, C: 2 },
    },
    {
      id: 'c',
      text: '...',
      keywords: ['机制', '漏洞', '冷门'],
      poles: { A: 1, T: 1, B: 2 },
    },
    {
      id: 'd',
      text: '...',
      keywords: ['预判', '剧情', '沉浸'],
      poles: { P: 1, I: 1, W: 2 },
    },
  ],
}
```

章节结构继续保留：

```js
export const chapters = [
  { id: 1, title: '...', feedback: '...' },
];
```

章节结束不再按每 6 题写死，应通过“下一题所属章节是否变化”判断。

### 3.3 结果

旧结果字段基本可保留一部分，但建议收敛为 GPTI 结果结构：

```js
{
  type: 'ATRB',
  name: '狂战士',
  alias: ['莽穿肠', '人形推土机'],
  identity: '高风险开团位',
  headline: '...',
  tags: ['莽', '上头', '速通', '嘴硬'],
  summary: '...',
  behaviorFragments: ['...', '...', '...'],
  charges: ['...', '...'],
  talent: '...',
  weakness: '...',
  bestPartners: ['ATRC'],
  nemesis: ['PIWC'],
  shareCTA: '...',
  longCopy: '...',
  image: './assets/results/ATRB.png',
  avatar: './assets/avatars/ATRB.png',
}
```

页面层只使用短字段：

- `name`
- `identity`
- `headline`
- `tags`
- `summary`
- `behaviorFragments`
- `charges`
- `talent`
- `weakness`
- `bestPartners`
- `nemesis`
- `shareCTA`

`longCopy` 第一版可不展示，或放到折叠区域。

### 3.4 隐藏特质

已新增：

```text
src/data/traits.mjs
```

结构：

```js
export const hiddenTraits = [
  {
    id: 'scripted_gambler',
    name: '人形脚本外挂',
    priority: 10,
    triggerType: 'keyword_combo',
    conditions: {
      keywordsAll: ['背板'],
      polesMin: { B: 4, C: 4 },
    },
    headline: '看起来像赌，其实全是练过。',
    copy: '...',
  },
];
```

第一版隐藏特质数量建议控制在 3 到 5 个。

## 4. 评分设计

### 4.1 答案结构

旧答案：

```js
{
  questionId: 'q01',
  optionId: 'score_2',
  dimension: 'EI',
  score: 2,
  answeredAt: 1234567890,
}
```

新答案：

```js
{
  questionId: 'q01',
  optionId: 'a',
  keywords: ['莽', '效率', '速通'],
  poles: { A: 2, T: 2, B: 1 },
  answeredAt: 1234567890,
}
```

### 4.2 Score report

`buildScoreReport(questions, answers)` 返回：

```js
{
  type: 'ATRB',
  poleScores: {
    A: 12,
    P: 5,
    T: 14,
    I: 4,
    R: 9,
    W: 7,
    B: 10,
    C: 6,
  },
  axes: {
    initiative: {
      left: 'A',
      right: 'P',
      winner: 'A',
      leftScore: 12,
      rightScore: 5,
      confidence: 0.41,
      tied: false,
    },
  },
  keywordCounts: {
    莽: 4,
    效率: 3,
  },
  hiddenTrait: {
    id: 'scripted_gambler',
    name: '人形脚本外挂',
  },
}
```

### 4.3 标准类型判定

对每组轴：

1. `leftScore > rightScore`，选择左极。
2. `rightScore > leftScore`，选择右极。
3. 平局时查找该轴最后一次有非零贡献的答案。
4. 如果仍然平局，使用默认极并标记 `tied: true`。

默认极建议：

```text
A / T / R / B
```

默认极只用于技术兜底，用户端不展示“默认选择”。

### 4.4 置信度

推荐：

```text
confidence = abs(leftScore - rightScore) / max(1, leftScore + rightScore)
```

总稳定度可使用四轴置信度平均值。

### 4.5 隐藏特质判定

隐藏特质在标准类型之后计算。

触发类型：

- `keyword_combo`：关键词组合 + 可选极向阈值。
- `single_pole_spike`：某个极向占比过高。
- `dual_high_conflict`：同一轴两极都高，且差值小。

第一版不使用用户分位数。

示例固定阈值：

```text
single_pole_spike:
  poleScore / totalPoleScore >= 0.35

dual_high_conflict:
  leftScore >= 6
  rightScore >= 6
  abs(leftScore - rightScore) <= 2
```

最终按 `priority` 选择第一个命中的隐藏特质。

## 5. UI 设计

### 5.1 设计规格

Purpose Statement:
GPTI H5 的核心用户是游戏玩家和泛游戏内容受众。界面需要让用户快速沉浸到异界情境题中，并在结果页获得足够强的“像我、好笑、愿意分享”的反馈。

Aesthetic Direction:
Industrial/utilitarian with game archive flavor。延续当前“异界档案局 / 终端 / 档案卡”的方向，不另起一套营销式落地页。

Color Palette:
沿用当前项目色彩资产，不在本阶段重做品牌色。继续使用深色底、纸色文字、青色高亮和金色强调，避免因为 GPTI 迁移引入新的强品牌冲突。

Typography:
沿用当前静态 H5 的字体策略，不在本阶段引入外部字体依赖，避免纯静态项目增加加载和授权风险。

Layout Strategy:
继续使用手机优先的单屏答题流程。题目页从二选一扩展为四个纵向选项块；结果页采用“首屏档案摘要 + 下滑展开细节”的信息层级，避免长文占满首屏。

### 5.2 题目页

四选项页结构：

```text
章节标题 / 题号
进度条
题干
选项 A
选项 B
选项 C
选项 D
上一题 / 下一题
```

要求：

- 选项不展示关键词、pole、type。
- 选项 id 使用 `a` / `b` / `c` / `d`，不使用 A 极向语义。
- 选项卡固定宽度，长文换行，不因 hover 或 selected 改变布局尺寸。
- 移动端小屏优先保证四个选项可读。

### 5.3 结果页

首屏优先级：

1. 结果名。
2. 身份。
3. headline。
4. tags。
5. hidden trait，如果存在。
6. summary。

下方展示：

- 行为碎片。
- 游戏行为罪状。
- 隐藏天赋。
- 致命弱点。
- 适配队友 / 天敌队友。
- 分享操作。

内部 type code 默认不展示。需要调试时可写入 data attribute 或 analytics payload，不进入用户可见文本。

### 5.4 分享图

分享图只使用短字段：

- 结果名。
- 身份。
- headline。
- 3 个标签。
- 1 条隐藏特质或 1 条行为罪状。
- CTA。
- 测试链接。

不放 `longCopy`、推荐作品长列表或大段人格分析。

## 6. Analytics 设计

### 6.1 前端事件

事件名尽量保持现有白名单：

- `question_view`
- `question_answer`
- `test_complete`
- `result_view`
- `generate_share_image_click`
- `copy_share_click`
- `platform_share_click`

`question_answer` payload 调整：

```js
{
  question_id: 'q01',
  question_index: 1,
  chapter: 1,
  option_id: 'a',
  keywords: ['莽', '效率', '速通'],
  poles: { A: 2, T: 2, B: 1 },
  time_spent_ms: 1234,
  is_change: false,
}
```

当前 GPTI 前端不再发送旧 `dimension`、`score` 或 `score_*` 字段。`content-2026-05-21`、`dimension: EI`、`score_2` / `score_-2` 只作为历史数据兼容 fixture 和旧聚合解释保留。

`test_complete` / `result_view` payload 增加：

```js
{
  result_type_internal: 'ATRB',
  result_name: '狂战士',
  hidden_trait_id: 'scripted_gambler',
  hidden_trait_name: '人形脚本外挂',
  confidence_avg: 0.62,
  low_confidence_count: 1,
}
```

为避免 payload 过大，第一版只传被选项关键词和 pole，不传全部 score report。

### 6.2 Rollup 和 dashboard

若保持 24 题，现有 funnel 节点 `1 / 8 / 16 / 24` 可以暂时继续使用。

如果正式题量不是 24，则必须更新：

- `analytics_rollup` funnel steps。
- dashboard 漏斗文案。
- 相关 tests。
- 文档中的验收说明。

关键词热度、四轴分布、隐藏特质分布建议第二阶段单独设计，不在首轮和 GPTI 前端迁移混做。

## 7. Content Version

GPTI 迁移必须使用新内容版本。

建议命名：

```text
content-2026-05-23-gpti-a
```

若正式文案进入预览时日期已变化，按实际日期生成，例如：

```text
content-2026-06-01-gpti-a
```

不要复用 `content-2026-05-21`。

## 8. 测试策略

### 8.1 内容测试

更新 `tests/content.test.mjs`：

- 24 题。
- 每题 4 个选项。
- 选项 id 不重复。
- 关键词来自白名单。
- pole key 合法。
- pole 分值为正整数。
- 16 个 GPTI 结果完整。
- 用户可见文案不暴露内部 code。
- 文案长度符合移动端和分享图 guardrails。
- `bestPartners` / `nemesis` 引用存在。

### 8.2 评分测试

更新 `tests/scoring.test.mjs`：

- 累计八极分。
- 解析四轴 winner。
- 生成标准 type。
- 平局 tie-break。
- 低置信度标记。
- 关键词计数。
- 隐藏特质优先级。
- 无隐藏特质时回退标准结果。

### 8.3 UI 和分享测试

更新或补充：

- 四选项渲染。
- 答案存储结构。
- 结果页不展示内部 code。
- 分享文案不展示内部 code。
- 分享图字段长度。

### 8.4 Analytics 测试

更新：

- `question_answer` payload 包含 `option_id`、`keywords`、`poles`。
- `test_complete` / `result_view` 支持 GPTI result type。
- contentVersion 同步。

## 9. 迁移顺序

推荐按以下顺序实施：

1. 新增 GPTI 常量、schema 和内容测试。
2. 重写 scorer 和 scoring tests。
3. 更新题库和结果数据结构，第一批 GPTI 接入允许使用短文案跑通链路，但用户可见页面和分享图不得出现工程提示。
4. 更新答题 UI 为四选项。
5. 更新结果页和分享图字段。
6. 更新 analytics payload。
7. 全量接入文案确认版。
8. 浏览器验证移动端和分享图。
9. 视题量和看板诉求决定是否改 CloudBase rollup / dashboard。

## 10. 回滚方案

GPTI 迁移应保持与当前样稿内容分版本隔离。

若开发或预览发现问题：

- 回滚前端代码和内容配置到上一稳定 commit。
- 保留异常 `contentVersion` 数据，不删除。
- 若只是文案问题，新建补丁内容版本。
- 若是 scoring 或结果映射问题，暂停该 GPTI 入口继续投放，修复后使用新内容版本。

## 11. 当前确认状态

已确认并按第一版执行：

1. 使用 `src/data/gpti.mjs` 和 `src/data/traits.mjs` 承载 GPTI 常量与隐藏特质。
2. 隐藏特质第一版在结果页附加展示，但不覆盖标准 16 型主结果。
3. 第一批 GPTI 内容接入允许使用短兜底文案承载基础链路，但用户可见页面和分享图不得出现“GPTI 占位”“后续替换”“跑通技术链路”等工程提示。
4. CloudBase rollup / dashboard 第一阶段保持现有口径，不新增关键词热度、四轴分布或隐藏特质分布。
