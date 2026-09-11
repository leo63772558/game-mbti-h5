# Phase 5B 数据看板来源明细筛选 - Design

## 1. 总体方案

Phase 5B 推荐把 `analytics_source_daily` 从“来源核心指标表”升级为“来源看板快照表”：

```text
analytics_events
  -> analytics_rollup
  -> analytics_source_daily
  -> dashboard_api
  -> admin/dashboard.html
```

无来源筛选时，仍走原有 5 张聚合表：

```text
analytics_daily_summary
analytics_funnel_daily
analytics_question_daily
analytics_result_daily
analytics_share_daily
```

有 `host` 或 `contentVersion` 筛选时，dashboard API 不再混用原 5 张 `date + channel` 明细表，而是只用 `analytics_source_daily` 中同一来源粒度的快照字段生成所有可见模块。

## 2. 方案取舍

### 方案 A：扩展现有 5 张聚合表维度

做法：把 `host` / `content_version` 加进现有 5 张表的 `_id` 和索引。

优点：
- 每张表职责保持单一。
- 查询模型与现有模块天然对应。

缺点：
- 需要修改 5 张表的写入、读取、测试和索引口径。
- 会改变核心聚合表的记录粒度，回归面较大。
- 无筛选旧口径和新维度口径更容易混淆。

### 方案 B：新增 4 张来源明细聚合表

做法：保留 `analytics_source_daily`，再新增 source 维度的 funnel/question/result/share 表。

优点：
- 结构清晰，适合长期扩展更多筛选维度。
- 单条文档较小。

缺点：
- 需要新增多张 CloudBase 集合、权限和索引。
- 部署和回滚步骤更多。
- 当前 H5 只有 24 题和有限分享动作，第一版资源点偏重。

### 方案 C：扩展 `analytics_source_daily` 为来源看板快照

做法：保持粒度 `date + channel + host + content_version`，在单条来源记录内嵌入 summary、funnel、questions、results、share 聚合。

优点：
- 不新增集合、权限或索引。
- 有来源筛选时 dashboard API 读取一张聚合表即可生成完整看板。
- 不影响原 5 张表和无筛选旧口径。
- 回滚时扩展字段可以保留，不影响 Phase 5A 核心指标。

缺点：
- 单条文档会变大。
- 如果未来题量、结果数量或筛选维度显著增加，可能需要拆回多表模型。

结论：Phase 5B 推荐方案 C。当前活动尚未上线，题量固定 24 题，结果和分享动作数量有限，单表快照能以最低资源点补齐决策需要。

## 3. 数据模型

集合保持：

```text
analytics_source_daily
```

文档粒度保持：

```text
date + channel + host + content_version
```

现有顶层字段继续保留：

| 字段 | 说明 |
|---|---|
| `_id` | `source__{date}__{channel}__{host}__{content_version}` |
| `date` | Asia/Shanghai 自然日 |
| `channel` | `all` 或具体渠道 |
| `host` | `location.host`，缺失归 `unknown` |
| `content_version` | 内容版本，缺失归 `unknown` |
| `timezone` | 固定 `Asia/Shanghai` |
| `pv` / `uv` / `sessions` | 来源粒度核心指标 |
| `page_view_sessions` / `test_start_sessions` / `test_complete_sessions` / `result_view_sessions` / `share_action_sessions` | 来源粒度会话指标 |
| `start_rate` / `completion_rate` / `result_share_rate` | 来源粒度转化率 |
| `avg_completion_duration_ms` | 来源粒度平均完成时长 |
| `event_counts` | 来源粒度事件计数 |
| `source_event_count` | 本来源快照扫描事件数 |
| `excluded_channel_prefixes` | 默认排除前缀 |
| `updated_at` | 聚合更新时间 |

Phase 5B 新增嵌入字段：

```js
{
  summary: {
    pv,
    uv,
    sessions,
    page_view_sessions,
    test_start_count,
    test_start_sessions,
    test_complete_count,
    test_complete_sessions,
    result_view_count,
    result_view_sessions,
    share_action_count,
    share_action_sessions,
    start_rate,
    completion_rate,
    result_share_rate,
    avg_completion_duration_ms,
    event_counts,
    source_event_count
  },
  funnel: {
    steps: [
      {
        key,
        label,
        event_count,
        session_count,
        from_previous_rate,
        from_start_rate
      }
    ]
  },
  questions: [
    {
      question_id,
      question_index,
      chapter,
      dimension,
      view_count,
      view_sessions,
      answer_count,
      answer_sessions,
      answer_rate,
      avg_time_spent_ms,
      time_spent_count,
      change_count,
      option_distribution
    }
  ],
  results: [
    {
      result_type_internal,
      result_name,
      complete_count,
      complete_sessions,
      result_view_count,
      result_view_sessions,
      share_of_completions,
      avg_confidence,
      confidence_count,
      avg_duration_ms,
      duration_count
    }
  ],
  share: {
    share_intent_count,
    share_intent_sessions,
    action_counts,
    action_sessions,
    platform_distribution,
    result_distribution
  }
}
```

隐私边界：
- 不保存 `anon_id`。
- 不保存 `session_id`。
- 不保存完整 `payload`。
- 只保存不可逆聚合值和业务维度汇总。

## 4. Rollup 设计

涉及文件：

```text
cloudbase/functions/analytics_rollup/rollup-core.js
cloudbase/functions/analytics_rollup/index.js
```

实现思路：

1. 保持当前 `date + channel` bucket 和原 5 张表 finalize 逻辑不变。
2. 将 source bucket 从 summary-only 扩展为完整看板 bucket，包含 summary、funnel、questions、results、share 状态。
3. 复用现有 `updateSummary()`、`updateFunnel()`、`updateQuestion()`、`updateResult()`、`updateShare()` 逻辑，避免复制指标公式。
4. 对每条有效事件继续写入两个 source bucket：
   - `channel=all`
   - 具体 `channel`
5. `finalizeSourceSummary()` 扩展为来源看板快照输出，保留顶层 Phase 5A 字段，同时新增嵌入明细字段。

推荐内部结构：

```text
createBucket(date, channel)
createSourceBucket(date, channel, host, contentVersion)
  -> 复用 createSummaryState()
  -> 复用 funnel/questions/results/share state
updateBucket(bucket, event)
updateSourceBucket(sourceBucket, event)
  -> updateSummary
  -> updateFunnel
  -> updateQuestion
  -> updateResult
  -> updateShare
```

这样可以确保来源筛选口径和原始 `date + channel` 口径的计算公式一致，只是 bucket 维度不同。

## 5. Dashboard API 设计

涉及文件：

```text
cloudbase/functions/dashboard_api/index.js
cloudbase/functions/dashboard_api/dashboard-data.js
```

### 无来源筛选

当 `host` 和 `contentVersion` 都为空：

- 读取原 5 张聚合表。
- 不读取 `analytics_source_daily`，或保持空 source records。
- `summary`、`funnel`、`questions`、`results`、`share` 保持当前响应兼容。
- `meta.summary_scope = "date_channel"`。
- `meta.detail_tables_scope = "date_channel"`。

### 有来源筛选

当 `host` 或 `contentVersion` 任一存在：

- 读取 `analytics_source_daily`。
- 查询条件包含：
  - `date` range
  - `channel`
  - 可选 `host`
  - 可选 `content_version`
- 从 source records 合并生成：
  - `summary`
  - `funnel`
  - `questions`
  - `results`
  - `share`
- `meta.summary_scope = "source_daily"`。
- `meta.detail_tables_scope = "source_daily"`。

重要边界：有来源筛选时，不应再用原 5 张表填充漏斗、题目、结果和分享模块，否则会重新出现“核心指标被筛选、明细未筛选”的混合口径。

### 旧记录兼容

如果 source record 只有 Phase 5A 顶层 summary 字段，没有嵌入明细：

- `summary` 继续返回来源筛选后的核心指标。
- `funnel`、`questions`、`results`、`share` 返回空态。
- `meta.source_detail_coverage` 可返回 `missing` 或 `partial`，提示需要重新 rollup 回填。
- 不 fallback 到 `date_channel` 明细。

## 6. Dashboard UI 设计

涉及文件：

```text
admin/dashboard.html
admin/dashboard.mjs
admin/dashboard.css
```

Phase 5A 已有 Host / Content Version 输入控件，Phase 5B 不需要新增复杂筛选 UI。

需要调整状态说明：

- 无来源筛选：

```text
核心指标和细分模块按 date + channel 汇总。
```

- 有来源筛选且 `detail_tables_scope=source_daily`：

```text
核心指标、漏斗、题目、结果和分享明细均已按来源/版本筛选。
```

- 有来源筛选但 `source_detail_coverage` 为 `missing` 或 `partial`：

```text
核心指标已按来源/版本筛选；明细字段缺少回填，请重新执行 rollup。
```

UI 不新增 token 默认值，token 继续只来自管理员输入和 `sessionStorage`。

## 7. CloudBase 资源与部署

预期不新增 CloudBase 资源：

- 不新增集合。
- 不修改集合权限。
- 不新增索引。
- 不修改 CORS allowlist。
- 不修改网关路径。
- 不修改环境变量。

现有 `analytics_source_daily` 索引仍满足第一版查询：

```text
channel ASC
date ASC
host ASC
content_version ASC
```

实施后需要部署：

```text
analytics_rollup
dashboard_api
静态 admin 页面
```

部署后需要对目标日期重新触发 `analytics_rollup`，因为旧的 `analytics_source_daily` 记录只有 Phase 5A summary-only 字段。

如果实施中发现必须新增集合、索引、权限、环境变量、网关配置或 CORS 配置，必须先停下确认。

## 8. 测试策略

Rollup 测试：
- 同一天同渠道不同 host 的题目、结果、分享、漏斗数据互不混入。
- 同一天同渠道不同 content version 的题目、结果、分享、漏斗数据互不混入。
- `unknown` 来源仍生成完整来源快照。
- 默认排除 `e2e_*`、`debug_*`、`test_*`。
- 原 5 张聚合表输出不变。

Dashboard API 测试：
- 无来源筛选时保持旧响应兼容。
- 有 `host` 筛选时，`summary/funnel/questions/results/share` 均来自 source records。
- 有 `contentVersion` 筛选时，`summary/funnel/questions/results/share` 均来自 source records。
- 只有 summary-only source records 时，不 fallback 到未筛选明细。
- 响应不包含 `anon_id`、`session_id`、`payload`。

Dashboard UI 测试：
- Host / Content Version 参数继续随请求发送。
- 来源筛选生效时状态文案不再说“明细仍按 date + channel 汇总”。
- 无来源筛选时状态文案仍说明 `date + channel` 口径。

完整验证：

```powershell
node --test .\tests\*.test.mjs
npm run build
```

敏感信息检查：

```powershell
rg -n "ghd_|DASHBOARD_TOKEN|SECRET|TOKEN" -S . --glob "!dist/**" --glob "!.git/**"
```

## 9. 上线前验证策略

由于活动尚未正式上线，生产环境验证数据必须清楚标记为验证数据。

建议验证渠道：

```text
phase5b_browser_YYYYMMDD
```

验证步骤：

1. 用真实浏览器打开生产 H5，并带验证渠道参数。
2. 完成一轮 24 题到结果页，并触发至少一种分享行为。
3. 触发 `analytics_rollup` 聚合目标上海自然日。
4. 查询 `analytics_source_daily`，确认目标记录包含嵌入 `funnel/questions/results/share`。
5. 打开 `/admin/dashboard.html`，带 `host` / `contentVersion` 筛选确认所有模块口径一致。

验证汇报中必须说明该数据不是正式运营数据。正式活动分析时应排除或单独分组这些验证渠道。

## 10. 回滚方案

如果 Phase 5B 实施后出现问题：

1. 回滚 `analytics_rollup` 到 Phase 5A 版本，停止写入嵌入明细字段。
2. 回滚 `dashboard_api` 到 Phase 5A 版本，来源筛选只影响核心指标。
3. 回滚 `admin/` 静态看板文案。
4. 保留 `analytics_source_daily` 中已写入的嵌入字段，旧 API 可忽略这些字段。
5. 原 5 张聚合表不变，无来源筛选看板应不受影响。
