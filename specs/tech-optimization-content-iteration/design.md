# 技术优化与内容迭代 Spec - Design

> 历史说明：本目录记录从基础埋点、内容版本到 Phase 5A 的技术优化过程，部分示例版本号仍保留当时的 `content-2026-05-20` 草案值。当前内容版本、上线入口和 Phase 5B 看板口径，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 1. 总体设计

本次设计以“最小稳定改动”为原则，不改变现有产品结构，不引入框架，不重写业务逻辑。

核心链路保持不变：

```text
静态 H5
  -> src/analytics.mjs
  -> analytics_collect
  -> analytics_events
  -> analytics_rollup
  -> 聚合表
  -> dashboard_api
  -> admin/dashboard.html
```

新增优化只在现有边界内扩展：

- 前端埋点公共字段增加部署来源和内容版本。
- 文档增加内容版本维护规则。
- README / DEPLOYMENT 更新为当前 CloudBase 埋点和看板现状。
- 为文案同学增加配置说明和修改边界。
- 后续拆分 `src/app.mjs` 只拆低耦合模块。

## 2. 模块影响

### 2.1 前端埋点模块

文件：

```text
src/analytics.mjs
```

建议新增字段：

```js
host: getLocationValue('host')
origin: getLocationOrigin()
content_version: config.contentVersion
```

`DEFAULT_CONFIG` 建议增加：

```js
contentVersion: 'content-2026-05-20'
```

新增 helper：

```js
function getLocationOrigin() {
  return String(globalThis.location?.origin ?? '');
}
```

注意：

- 不把 token、管理员信息或用户身份信息加入埋点。
- `origin` / `host` 是页面来源，不是用户身份。
- 如果本地 `file://` 打开导致 `origin` 为 `null` 或空，允许为空字符串。

### 2.2 应用初始化

文件：

```text
index.html
src/app.mjs
```

当前 `index.html` 已注入：

```js
window.GH_ANALYTICS_CONFIG = {
  endpoint: '...',
  appVersion: 'pre-p0-2026-05-20',
};
```

建议增加：

```js
contentVersion: 'content-2026-05-20',
```

`src/app.mjs` 中保留默认值：

```js
const CONTENT_VERSION = 'content-2026-05-20';
```

初始化时传入：

```js
contentVersion: runtimeAnalyticsConfig.contentVersion ?? CONTENT_VERSION,
```

这样后续文案改题时，只需要同步改一个版本号。

### 2.3 采集云函数

文件：

```text
cloudbase/functions/analytics_collect/index.js
```

当前服务端对事件字段基本采取白名单事件名 + 基础字段存在性校验，不强限制公共字段。因此前端新增 `host`、`origin`、`content_version` 不需要大改。

建议补充可选校验：

- 如果 `host` 存在，必须为字符串且长度不超过 200。
- 如果 `origin` 存在，必须为字符串且长度不超过 300。
- 如果 `content_version` 存在，必须为字符串且长度不超过 80。

这不是强制 P0，但可提高数据质量。

### 2.4 聚合函数与聚合表

文件：

```text
cloudbase/functions/analytics_rollup/rollup-core.js
cloudbase/functions/dashboard_api/dashboard-data.js
```

原始 P0 阶段的约束是暂缓把 `host` / `content_version` 加为聚合维度，避免聚合表数量和看板查询复杂度扩大。

P0 只要求：

- 明细表保留 `host` / `origin` / `content_version`。
- 聚合表仍按 `date + channel` 聚合。
- 文档明确当前看板是全 host / 全 content version 汇总。

P1 可选升级：

- `analytics_daily_summary` 增加 `host` 维度。
- `analytics_result_daily` / `analytics_question_daily` 增加 `content_version` 维度。
- `dashboard_api` 支持 `host`、`contentVersion` query 参数。
- 看板页面增加筛选控件。

考虑免费体验版资源点，P1 前不建议贸然扩展全部聚合表维度。

2026-05-22 更新：上述 P1 能力中的核心指标筛选已通过 Phase 5A 落地，采用新增轻量聚合表 `analytics_source_daily`，没有扩展全部聚合表维度。后续 Phase 5B 已在代码层把 `analytics_source_daily` 升级为来源看板快照表；有 `host` / `contentVersion` 筛选时，summary、funnel、questions、results、share 均按同一来源/版本口径生成。CloudBase 部署和真实浏览器验证仍以后续部署记录为准。

### 2.5 文档

建议更新：

```text
README.md
DEPLOYMENT.md
docs/analytics/2026-05-19-埋点架构与事件方案.md
docs/analytics/2026-05-20-数据看板与汇总方案.md
```

新增文案配置说明可放在：

```text
docs/content/2026-05-21-题库与人格配置维护说明.md
```

文案配置说明应包含：

- 当前结构说明。
- 哪些字段可以直接改。
- 哪些字段改动会影响打分。
- 题目数量变化的影响。
- 结果类型变化的影响。
- 修改后必须跑的测试。

## 3. 文案改动技术边界

### 3.1 低风险改动

只改以下文本字段，通常不需要改代码逻辑：

- 题目标题。
- 左右选项文案。
- 章节标题和章节反馈。
- 结果名称。
- 结果身份。
- headline。
- worldCopy。
- playerCopy。
- tags。
- charges。
- talent。
- weakness。
- bestPartners。
- nemesis。
- shareCTA。

预计技术时间：

- 小批量替换：1-2 小时。
- 完整 24 题 + 16 结果一轮替换：0.5-1 天，含检查和部署。

### 3.2 中风险改动

以下改动需要同步测试和数据解释：

- 调整题目顺序。
- 调整题目所属章节。
- 调整题目所属维度。
- 调整题目权重。
- 调整中立选项逻辑。

预计技术时间：

- 0.5-1.5 天，取决于改动范围。

### 3.3 高风险改动

以下改动需要重新设计 scoring：

- 题目数量不再是 24。
- 维度不再是 EI / SN / TF / JP。
- 结果不再是 16 个 type key。
- 结果不是按四维字母组合映射。
- 希望加入多个并列结果、概率结果或标签型结果。

预计技术时间：

- 2-5 天，复杂版本更久。

## 4. 测试策略

每轮实现至少运行：

```powershell
node --test .\tests\*.test.mjs
npm run build
```

如果修改埋点字段：

- 更新 `tests/analytics.test.mjs`。
- 验证新增字段存在。
- 验证 payload 大小限制仍生效。

如果修改题库：

- 更新 / 运行 `tests/content.test.mjs`。
- 验证题目数量、维度分布、章节合法。
- 如果内容版本更新，验证 `contentVersion` 已同步。

如果修改结果配置：

- 验证 16 个结果 key 完整。
- 验证用户端不展示内部类型码。
- 验证分享文案仍不带禁用词，例如不重新暴露 `MBTI`。

如果修改看板聚合：

- 更新 / 运行 `tests/analytics-rollup.test.mjs`。
- 更新 / 运行 `tests/dashboard-api.test.mjs`。
- 验证 API 不返回 `anon_id`、`session_id`、`payload`。

## 5. 部署与数据策略

### 5.1 Vercel 与 CloudBase 同时采集

只要页面包含 `GH_ANALYTICS_CONFIG.endpoint`，对应部署环境的访问都会上报到 CloudBase。

当前 Vercel 已包含该配置，因此会入库。

后续如果要临时关闭某个部署环境的采集，可以：

- 移除该环境 HTML 中的 endpoint。
- 或将 endpoint 留空。
- 或在 CloudBase 采集函数增加 origin allowlist。

### 5.2 内容版本切换

建议命名：

```text
content-2026-05-20
content-2026-05-xx
```

当题库或结果文案有会影响用户选择 / 结果理解的改动时，递增 `contentVersion`。

只改 README 或后台页面，不需要递增内容版本。

### 5.3 看板解释

P0 阶段看板按 `date + channel` 汇总。

2026-05-22 更新：Phase 5A 后，核心指标可以用 `host` / `contentVersion` 精确筛选；Phase 5B 代码层已补齐漏斗、题目、结果和分享明细的同来源/版本快照口径。同步共享文档时，应以 `README.md`、`DEPLOYMENT.md` 和 `docs/analytics/2026-05-20-数据看板与汇总方案.md` 的当前说明为准。

## 6. 推荐执行顺序

1. 补 `host` / `origin` / `contentVersion`。
2. 更新埋点测试。
3. 更新 README / DEPLOYMENT / analytics docs。
4. 新增文案配置维护说明。
5. 用户确认后，再决定是否做 P1 看板筛选。
6. 文案定稿后，再替换 `questions.mjs` 和 `results.mjs`。
7. 如果 app 继续变大，再拆分 `src/app.mjs`。

## 7. 回滚策略

- 前端字段新增是向后兼容的，若出现异常，可把 `contentVersion` 配置移除或回退到旧 commit。
- 采集函数若新增严格校验导致上报失败，应先恢复宽松校验。
- 文案配置改动可通过 git revert 单独回滚。
- 看板聚合维度如 P1 扩展失败，不影响 P0 聚合表，可继续使用旧查询。
