# Phase 5B 数据看板来源明细筛选 - Requirements

## 1. 背景

Phase 5A 已让看板核心指标支持按 `host` / `contentVersion` 筛选，链路保持为：

```text
analytics_collect -> analytics_events -> analytics_rollup -> 聚合表 -> dashboard_api -> admin/dashboard.html
```

当前限制是：有 `host` 或 `contentVersion` 筛选时，只有核心指标来自 `analytics_source_daily`，漏斗、题目、结果、分享明细仍来自原 `date + channel` 聚合表。这会导致运营或内容复盘时无法判断某个部署入口或某个内容版本下，具体是哪一道题、哪类结果、哪类分享行为或哪一步漏斗出了问题。

活动当前尚未正式上线，生产库中的 `phase5a_browser_0522` 等数据属于上线前验证数据，不应被表述为真实运营数据。Phase 5B 需要支持上线前和上线后都能按 `host` / `contentVersion` 查看完整看板模块，用于判断后续开发动作。

## 2. 已确认方向

- 继续保持看板只读聚合表，不允许 `admin/dashboard.html` 直接读取 `analytics_events`。
- `analytics_events` 只由 `analytics_rollup` 扫描。
- 不扩展现有 5 张 `date + channel` 聚合表的主键维度。
- 优先复用并扩展 `analytics_source_daily`，把它从“来源核心指标表”升级为“来源看板快照表”。
- 粒度继续保持 `date + channel + host + content_version`。
- 第一版不新增 CloudBase 集合、权限或索引，除非实施中发现现有索引无法支撑查询并再次确认。

## 3. 目标

1. 当看板带有 `host` 和/或 `contentVersion` 筛选时，核心指标、漏斗、题目、结果和分享明细都按相同来源粒度筛选。
2. 当看板没有来源筛选时，继续保持现有 `date + channel` 五张聚合表响应兼容。
3. 支持运营和产品判断后续开发动作：入口流失、题目流失、结果分布异常、分享转化弱点、内容版本差异。
4. 继续不返回 `anon_id`、`session_id`、完整 `payload` 等明细隐私字段。
5. 继续保持纯静态 H5 主体，不引入 React / Vue / Next / Vite。

## 4. 非目标

- 不让 `admin/dashboard.html` 或其他前端页面直接读取 `analytics_events`。
- 不让 `dashboard_api` 在请求时扫描 `analytics_events`。
- 不改题库结构、打分逻辑、结果配置结构或用户侧 H5 主流程。
- 不新增 `origin`、设备、浏览器、地域等筛选维度。
- 不新增 dashboard token 默认值，不把 token、密钥或敏感信息写入仓库。
- 不把上线前验证数据伪装成正式运营数据。
- 不在本阶段引入 A/B 测试、短链归因或真实稀有度统计。

## 5. 用户故事

### Story 1：运营按入口分析漏斗

作为运营人员，我希望选择 `host` 后，漏斗每一步都只展示该入口的数据，便于判断 Vercel、CloudBase 默认域名或后续自定义域名是否存在入口体验差异。

### Story 2：内容负责人按版本分析题目

作为内容负责人，我希望选择 `contentVersion` 后，题目曝光、答题率、耗时和选项分布都只来自该内容版本，便于判断改题后是否造成新的流失或偏向。

### Story 3：产品负责人分析结果与分享

作为产品负责人，我希望按 `host` / `contentVersion` 查看结果分布和分享行为，判断是否要调整结果文案、分享图、平台文案或分享入口。

### Story 4：技术维护者保持安全边界

作为技术维护者，我希望这些明细筛选仍由 `analytics_rollup` 预聚合，再由 `dashboard_api` 读取聚合结果，避免后台页面或 API 请求时读取用户行为明细。

## 6. 功能需求与验收标准

### Requirement 1：扩展来源看板快照聚合

When `analytics_rollup` 聚合包含 `host` / `content_version` 的事件时，the rollup function shall 在 `analytics_source_daily` 中写入同一来源粒度下的核心指标、漏斗、题目、结果和分享聚合。

When 事件缺少或带有非法 `host` / `content_version` 时，the rollup function shall 继续将对应维度归类为 `unknown`。

When 同一自然日、同一渠道、同一 host、同一 content version 有多条事件时，the rollup function shall 合并为一条来源看板快照记录。

When rollup 默认执行时，the rollup function shall 继续排除 `e2e_*`、`debug_*`、`test_*` 渠道。

### Requirement 2：保持现有聚合表兼容

When Phase 5B 扩展 `analytics_source_daily` 时，the rollup function shall 保持现有 5 张聚合表的 `_id`、粒度和字段结构不变。

When `analytics_source_daily` 写入扩展字段时，the implementation shall 保留 Phase 5A 已有顶层核心指标字段，避免破坏现有 dashboard API 兼容逻辑。

### Requirement 3：来源筛选下所有看板模块同口径

When dashboard API 收到 `host` query 参数时，the API shall 使用 `analytics_source_daily` 生成核心指标、漏斗、题目、结果和分享响应。

When dashboard API 收到 `contentVersion` query 参数时，the API shall 使用 `analytics_source_daily` 生成核心指标、漏斗、题目、结果和分享响应。

When dashboard API 同时收到 `host` 和 `contentVersion` 时，the API shall 返回同时匹配两个条件的来源看板快照聚合结果。

When dashboard API 返回来源筛选结果时，the API shall set `meta.summary_scope` to `source_daily` and `meta.detail_tables_scope` to `source_daily`。

### Requirement 4：无来源筛选时保持旧口径

When dashboard API 未收到 `host` 和 `contentVersion` 时，the API shall 继续读取原 5 张 `date + channel` 聚合表，并保持现有响应结构兼容。

When dashboard page 未填写来源筛选条件时，the dashboard page shall 继续展示当前 `date + channel` 汇总口径。

### Requirement 5：旧来源记录兼容

When `analytics_source_daily` 中存在 Phase 5A 生成的 summary-only 记录时，the dashboard API shall not fall back to unfiltered detail tables for a filtered request.

When 来源筛选命中记录但缺少嵌入明细字段时，the dashboard API shall 返回来源筛选后的核心指标，并让明细模块保持空态或标记缺少回填，而不是混入 `date + channel` 明细。

### Requirement 6：只读聚合表安全边界

When 后台页面加载数据时，the dashboard page shall only call `dashboard_api` and shall not query `analytics_events` directly.

When dashboard API 处理请求时，the API shall read only aggregate collections and shall not scan `analytics_events`.

When dashboard API 返回数据时，the API shall not return `anon_id`, `session_id`, or full `payload`.

### Requirement 7：后台页面口径提示

When 来源筛选生效且 API 返回 `detail_tables_scope=source_daily` 时，the dashboard page shall 显示“核心指标、漏斗、题目、结果和分享明细均按来源/版本筛选”的口径提示。

When 没有来源筛选时，the dashboard page shall 继续提示当前模块按 `date + channel` 汇总。

### Requirement 8：上线前验证数据口径

When 使用生产环境做上线前验证时，the maintainer shall 使用明确的验证渠道名，并在文档或汇报中标注这些数据不是正式运营数据。

When 需要分析正式活动效果时，the maintainer shall exclude or separately segment pre-launch verification channels.

### Requirement 9：测试、构建和检查

When implementation changes rollup logic, the test suite shall cover source-filtered funnel, question, result, and share aggregates without cross-host or cross-content-version mixing.

When implementation changes dashboard API behavior, the test suite shall cover source-filtered detail modules, no-filter compatibility, old source record compatibility, and privacy boundaries.

When implementation is complete, the maintainer shall run:

```powershell
node --test .\tests\*.test.mjs
npm run build
```

The maintainer shall also check sensitive strings and git status before commit.
