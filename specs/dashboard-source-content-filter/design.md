# Phase 5A 数据看板来源与内容版本筛选 - Design

> 历史说明：本目录记录 Phase 5A 核心指标来源筛选方案。Phase 5B 已在 `specs/dashboard-source-detail-filter/` 继续扩展为来源看板快照口径；同步当前共享文档时，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 1. 总体方案

Phase 5A 采用新增轻量聚合表方案：

```text
analytics_events
  -> analytics_rollup
  -> analytics_source_daily
  -> dashboard_api
  -> admin/dashboard.html
```

现有 5 张聚合表继续保持当前结构：

```text
analytics_daily_summary
analytics_funnel_daily
analytics_question_daily
analytics_result_daily
analytics_share_daily
```

这样可以在不重写现有看板主体、不扩大所有聚合维度的情况下，先让运营按部署来源和内容版本查看核心表现。

## 2. 数据模型

新增集合：

```text
analytics_source_daily
```

文档粒度：

```text
date + channel + host + content_version
```

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | `source__{date}__{channel}__{host}__{content_version}` |
| `date` | string | Asia/Shanghai 自然日 |
| `channel` | string | 渠道，含 `all` 总览和具体渠道 |
| `host` | string | 页面 `location.host`，缺失归为 `unknown` |
| `content_version` | string | 内容版本，缺失归为 `unknown` |
| `timezone` | string | 固定 `Asia/Shanghai` |
| `pv` | number | `page_view` 次数 |
| `uv` | number | 当日匿名用户数 |
| `sessions` | number | 当日会话数 |
| `page_view_sessions` | number | 首页或页面曝光会话数 |
| `test_start_sessions` | number | 开始测试会话数 |
| `test_complete_sessions` | number | 完成测试会话数 |
| `result_view_sessions` | number | 结果页会话数 |
| `share_action_sessions` | number | 分享意图会话数 |
| `start_rate` | number | `test_start_sessions / page_view_sessions` |
| `completion_rate` | number | `test_complete_sessions / test_start_sessions` |
| `result_share_rate` | number | `share_action_sessions / result_view_sessions` |
| `event_counts` | object | 各事件名计数 |
| `source_event_count` | number | 本聚合记录来源事件数 |
| `excluded_channel_prefixes` | string[] | 默认排除前缀 |
| `updated_at` | string | 聚合更新时间 |

说明：

- 不保存 `anon_id`、`session_id`、完整 `payload`。
- `uv` / `sessions` 只在单日精确；跨日范围仍为每日去重值求和，与现有看板口径一致。
- `origin` 不进入 Phase 5A 聚合维度，避免 host 与 origin 双维度导致记录数膨胀。

## 3. Rollup 设计

文件：

```text
cloudbase/functions/analytics_rollup/rollup-core.js
cloudbase/functions/analytics_rollup/index.js
```

新增 `COLLECTIONS.sourceDaily = 'analytics_source_daily'`。

在 `aggregateEvents()` 中保留现有 `date + channel` bucket，同时新增 source bucket：

```text
date + channel + host + content_version
```

同一条事件应写入：

- source `all` 渠道 bucket
- source 具体渠道 bucket，除非 channel 本身为 `all`

归一化规则：

- `channel` 继续使用现有 `normalizeChannel()`。
- `host` 使用 `normalizeSourceValue(event.host)`，缺失、空字符串或非法值归为 `unknown`。
- `content_version` 使用 `normalizeSourceValue(event.content_version)`，缺失、空字符串或非法值归为 `unknown`。
- 维度值长度建议限制在 120 字符内。

复用现有 summary 统计逻辑：

- 事件计数
- UV / sessions set
- page view / start / complete / result / share session set
- rate 计算

实现上可以新增独立 bucket 类型，避免改动现有 5 张聚合表的 finalize 逻辑。

## 4. Dashboard API 设计

文件：

```text
cloudbase/functions/dashboard_api/index.js
cloudbase/functions/dashboard_api/dashboard-data.js
```

新增 query 参数：

```http
GET /dashboard/summary?from=2026-05-21&to=2026-05-21&channel=all&host=demo-phi-pearl.vercel.app&contentVersion=content-2026-05-21
Authorization: Bearer <DASHBOARD_TOKEN>
```

参数规则：

- `host` 可选；为空时不筛选 host。
- `contentVersion` 可选；为空时不筛选 content version。
- 参数值仅允许普通来源值字符，非法值忽略或归为未设置，避免注入和异常查询。

读取策略：

- 无 `host` / `contentVersion`：保持现有响应逻辑，只读原 5 张聚合表。
- 有 `host` 或 `contentVersion`：额外读取 `analytics_source_daily`，按 `date + channel` 范围查询后在 API 层按可选维度过滤，或通过数据库 where 条件过滤。
- API 响应新增 `source_summary` 和 `source_daily.summary`，用于筛选后的核心指标。
- 为兼容现有前端，`summary` 可以在筛选存在时替换为 `source_summary`，但必须在 `meta` 中标注 `summary_scope: 'source_daily'`。

推荐响应扩展：

```json
{
  "range": {
    "from": "2026-05-21",
    "to": "2026-05-21",
    "channel": "all",
    "host": "demo-phi-pearl.vercel.app",
    "contentVersion": "content-2026-05-21",
    "timezone": "Asia/Shanghai"
  },
  "summary": {},
  "source_summary": {},
  "source_daily": {
    "summary": []
  },
  "meta": {
    "source": "aggregates",
    "summary_scope": "source_daily",
    "detail_tables_scope": "date_channel"
  }
}
```

隐私边界：

- 不返回 `anon_id`。
- 不返回 `session_id`。
- 不返回完整 `payload`。
- 不扫描 `analytics_events`。

## 5. Dashboard UI 设计

文件：

```text
admin/dashboard.html
admin/dashboard.mjs
admin/dashboard.css
```

表单新增两个控件：

- `Host`
- `Content Version`

行为：

- 空值不传。
- 有值时随查询提交给 `dashboard_api`。
- 状态栏展示当前筛选口径，例如：

```text
已加载 2026-05-21 至 2026-05-21，channel=all，host=demo-phi-pearl.vercel.app，contentVersion=content-2026-05-21
```

UI 说明：

- 核心指标卡展示筛选后的 `summary`。
- 题目表现、结果分布、分享行为和漏斗如果仍来自原 5 张表，应在状态或模块说明中标注“细分模块仍按 date + channel 汇总”。
- 不新增任何 token 默认值。
- Token 继续只存在管理员输入框和 sessionStorage。

## 6. CloudBase 资源设计

实施阶段需要新增集合：

```text
analytics_source_daily
```

权限：

```text
ADMINONLY
```

建议索引：

```text
idx_channel_date_source:
  channel ASC
  date ASC
  host ASC
  content_version ASC
```

如果 CloudBase 控制台或 MCP 对复合索引字段顺序有更优建议，实施时以实际查询条件为准，但只创建必要索引。

部署顺序：

1. 创建 `analytics_source_daily` 集合。
2. 配置 `ADMINONLY` 权限。
3. 创建最小必要索引。
4. 部署 `analytics_rollup`。
5. 手动触发 rollup 回填目标日期。
6. 部署 `dashboard_api`。
7. 构建并发布静态看板产物。
8. 使用真实 API 验证筛选响应。

## 7. 测试策略

Rollup 测试：

- 同一天同渠道不同 host 生成不同 `analytics_source_daily` 记录。
- 同一天同渠道不同 `content_version` 生成不同记录。
- 缺失 host / content_version 归为 `unknown`。
- 测试渠道默认排除。
- 现有 5 张聚合表输出不变。

Dashboard API 测试：

- `resolveDashboardRange()` 支持并归一化 `host` / `contentVersion`。
- `buildDashboardResponse()` 在有 source records 时返回 `source_summary`。
- 响应不包含 `anon_id`、`session_id`、`payload`。
- 无筛选时保持旧响应兼容。

构建测试：

- `npm run build` 后 `admin/` 仍被复制到 `dist/`。
- 不发布 `docs/`、`tests/`、`README.md`。

## 8. 回滚方案

如果 Phase 5A 实施后出现问题：

1. 回滚 `analytics_rollup` 到旧版本，停止写入 `analytics_source_daily`。
2. 回滚 `dashboard_api` 到旧版本，移除筛选参数逻辑。
3. 回滚 `admin/` 静态看板文件。
4. 保留或删除 `analytics_source_daily` 均不影响现有 5 张聚合表。
5. 主 H5 和 `analytics_collect` 不受影响。

## 9. 后续 Phase 5B 方向

如果需要所有模块随来源和内容版本精确筛选，可以另开 Phase 5B：

- 扩展现有 5 张聚合表维度；或
- 新增 question/result/share/funnel 的 source 维度聚合表；或
- 提供预计算的多维 dashboard aggregate。

Phase 5B 需要重新评估 CloudBase 记录数、索引数量、查询成本和 UI 解释成本。
