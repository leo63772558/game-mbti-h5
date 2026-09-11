# Phase 5A 数据看板来源与内容版本筛选 - Requirements

> 历史说明：本目录记录 Phase 5A 核心指标来源筛选方案。Phase 5B 已在 `specs/dashboard-source-detail-filter/` 继续扩展为来源看板快照口径；同步当前共享文档时，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 1. 背景

当前「异界开局人格测试 / 游戏人格 H5」已经接入 CloudBase 数据链路：

```text
analytics_collect -> analytics_events -> analytics_rollup -> 聚合表 -> dashboard_api -> admin/dashboard.html
```

前端埋点明细已经包含：

- `host`
- `origin`
- `content_version`
- `channel`

当前 P0 看板仍按 `date + channel` 汇总，不支持按部署来源或内容版本筛选。如果同一天同渠道同时存在 Vercel、CloudBase 默认域名、自定义域名或多个内容版本流量，现有看板会合并展示。

Phase 5A 的目标是在继续保持看板只读聚合表的前提下，补齐 `host` 和 `contentVersion` 筛选能力。

## 2. 已确认决策

- 新增轻量聚合表，而不是扩展现有 5 张聚合表。
- 新表建议命名为 `analytics_source_daily`。
- 新表粒度为 `date + channel + host + content_version`。
- 旧数据或缺失字段统一归类为 `unknown`。
- Phase 5A 只支持 `host` 和 `contentVersion` 筛选，不引入 `origin` 筛选。
- 允许后续实施阶段新增 CloudBase 集合、索引并部署相关云函数，但实施前仍需单独确认。

## 3. 目标

1. 看板支持按 `host` 筛选核心指标。
2. 看板支持按 `contentVersion` 筛选核心指标。
3. 看板继续只通过 `dashboard_api` 读取聚合表。
4. `admin/dashboard.html` 不直接读取 `analytics_events` 明细表。
5. 不改题库结构、打分逻辑、结果配置结构和用户侧 H5 主流程。
6. 不引入 React / Vue / Next / Vite。
7. 不把 dashboard token、密钥或敏感信息写入前端代码或仓库。

## 4. 非目标

- 不扩展 `analytics_daily_summary`、`analytics_funnel_daily`、`analytics_question_daily`、`analytics_result_daily`、`analytics_share_daily` 的维度。
- 不保证题目表现、结果分布、分享明细和漏斗全部随 `host` / `contentVersion` 精确过滤。
- 不让后台页面执行明细查询或聚合管道。
- 不改 CORS allowlist。
- 不改 CloudBase 网关路径、环境变量或 dashboard token 配置。
- 不新增用户身份采集字段。
- 不改 `analytics_collect` 采集入口，除非实施中发现数据质量问题并另行确认。

## 5. 用户故事

### Story 1：运营按部署来源查看核心数据

作为运营人员，我希望在数据看板中选择 `host`，查看 Vercel、CloudBase 默认域名或未来自定义域名的核心表现，避免不同入口数据混在一起。

### Story 2：内容负责人按内容版本查看核心数据

作为文案或内容负责人，我希望在数据看板中选择 `contentVersion`，查看不同题库 / 结果文案版本的核心表现，避免新版数据被旧版数据影响。

### Story 3：技术维护者保持看板安全边界

作为技术维护者，我希望筛选能力仍由 `analytics_rollup` 生成聚合表，再由 `dashboard_api` 读取聚合表返回，避免后台页面直接访问事件明细。

### Story 4：项目负责人控制资源点和回归风险

作为项目负责人，我希望 Phase 5A 不改现有 5 张聚合表结构，先用轻量新表满足核心来源和版本判断，降低 CloudBase 资源点和线上回归风险。

## 6. 功能需求与验收标准

### Requirement 1：新增来源与内容版本日聚合

When `analytics_rollup` 聚合包含 `host` / `content_version` 的事件时，the rollup function shall 写入 `analytics_source_daily` 聚合记录。

When 事件缺少 `host` 或 `content_version` 时，the rollup function shall 将对应维度归类为 `unknown`。

When 同一自然日、同一渠道、同一 host、同一内容版本存在多条事件时，the rollup function shall 合并为一条聚合记录。

When rollup 默认执行时，the rollup function shall 继续排除 `e2e_*`、`debug_*`、`test_*` 渠道。

### Requirement 2：保持现有聚合表兼容

When Phase 5A 新增来源聚合时，the rollup function shall 保持现有 5 张聚合表的记录结构和 `_id` 规则不变。

When `analytics_source_daily` 写入失败时，the implementation shall 不要求修改现有 5 张聚合表才能回滚。

### Requirement 3：dashboard_api 支持筛选参数

When dashboard API 收到 `host` query 参数时，the API shall 从 `analytics_source_daily` 返回匹配 host 的核心指标。

When dashboard API 收到 `contentVersion` query 参数时，the API shall 从 `analytics_source_daily` 返回匹配内容版本的核心指标。

When dashboard API 同时收到 `host` 和 `contentVersion` 时，the API shall 返回同时匹配两个条件的核心指标。

When dashboard API 未收到 `host` 和 `contentVersion` 时，the API shall 保持当前 `date + channel` 聚合响应兼容。

### Requirement 4：后台页面提供筛选控件

When 管理员打开 `admin/dashboard.html` 时，the dashboard page shall 显示 `Host` 和 `Content Version` 筛选输入控件。

When 管理员提交筛选条件时，the dashboard page shall 将 `host` 和 `contentVersion` 作为 query 参数传给 `dashboard_api`。

When 筛选条件为空时，the dashboard page shall 不传对应参数。

When API 返回筛选后的来源核心指标时，the dashboard page shall 明确展示当前筛选口径。

### Requirement 5：只读聚合表安全边界

When 后台页面加载数据时，the dashboard page shall only call `dashboard_api` and shall not query `analytics_events` directly.

When dashboard API 返回数据时，the API shall not return `anon_id`、`session_id` or full `payload`.

When dashboard API 支持来源筛选时，the API shall read only aggregate collections and shall not scan `analytics_events`.

### Requirement 6：CloudBase 数据库资源

When entering implementation, the maintainer shall create CloudBase collection `analytics_source_daily` before deploying rollup code that writes to it.

When creating `analytics_source_daily`, the maintainer shall configure collection permission as `ADMINONLY`.

When creating indexes for `analytics_source_daily`, the maintainer shall add only the minimal indexes needed for dashboard query patterns.

### Requirement 7：测试与构建

When implementation changes rollup logic, the test suite shall cover `analytics_source_daily` aggregation by host and content version.

When implementation changes dashboard API behavior, the test suite shall cover `host` / `contentVersion` query handling and privacy boundaries.

When implementation is complete, the maintainer shall run:

```powershell
node --test .\tests\*.test.mjs
npm run build
```

## 7. 口径说明

Phase 5A 的筛选只覆盖核心来源与版本指标。现有看板中的题目表现、结果分布、分享行为细项和关键漏斗仍来自原 5 张聚合表；若 UI 同屏保留这些模块，需要清晰标注它们仍按当前 `date + channel` 汇总，除非后续 Phase 5B 扩展更多维度聚合。

## 8. 风险

1. 如果 UI 没有清楚区分来源核心指标和原有细分模块，使用者可能误以为所有模块都已按 host / contentVersion 精确过滤。
2. `analytics_source_daily` 是新增集合，CloudBase 集合、权限或索引未配置时，rollup 写入会失败。
3. 旧数据缺少 `host` / `content_version` 时会进入 `unknown`，无法反推出真实来源或版本。
4. 如果未来正式入口增多，host 输入框可能不如服务端返回可选列表易用，但 Phase 5A 优先控制复杂度。
5. 如果后来要求所有题目、结果和分享明细都支持筛选，轻量表不足，需要进入 Phase 5B 扩展聚合维度或新增更多聚合表。
