# Phase 5A 数据看板来源与内容版本筛选 - Tasks

> 历史说明：本目录记录 Phase 5A 核心指标来源筛选方案。Phase 5B 已在 `specs/dashboard-source-detail-filter/` 继续扩展为来源看板快照口径；同步当前共享文档时，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 执行规则

- 本任务清单确认前不得进入实现。
- 实施时继续保持纯静态 H5 主体，不引入 React / Vue / Next / Vite。
- 不修改题库结构、打分逻辑、结果配置结构。
- `admin/dashboard.html` 不得直接读取 `analytics_events` 明细表。
- 不把 dashboard token、密钥或敏感信息写入前端代码或仓库。
- 不提交 `dist/`、日志、`.playwright-cli/`、`output/` 等产物。
- 涉及 CloudBase 集合、索引、权限、部署时，先使用 CloudBase MCP / 官方文档确认操作方式。

## Phase 5A.0：实施前确认

- [x] 0.1 用户确认本 spec。
  - 确认新增 `analytics_source_daily`。
  - 确认旧数据缺失字段归为 `unknown`。
  - 确认 Phase 5A 只做核心指标筛选。
  - _Requirement: 1, 2, 3, 4, 5, 6_

- [x] 0.2 复核工作区状态。
  - `git status --short --branch`
  - `git status --short --ignored`
  - 确认没有需要保护的未提交用户改动。
  - _Requirement: 7_

## Phase 5A.1：Rollup 新增轻量聚合表

- [x] 1.1 扩展 rollup collection 常量。
  - 在 `cloudbase/functions/analytics_rollup/rollup-core.js` 新增 `analytics_source_daily` collection。
  - 不改现有 5 张聚合表 collection 名。
  - _Requirement: 1, 2_

- [x] 1.2 新增来源维度 bucket。
  - 维度为 `date + channel + host + content_version`。
  - 同步生成 `all` 和具体 channel 两类记录。
  - 缺失 `host` / `content_version` 归为 `unknown`。
  - _Requirement: 1_

- [x] 1.3 复用核心指标统计。
  - 统计 PV、UV、sessions、start、complete、result、share。
  - 计算 start rate、completion rate、result share rate。
  - 不保存 `anon_id`、`session_id`、完整 `payload`。
  - _Requirement: 1, 5_

- [x] 1.4 保持现有聚合输出兼容。
  - 现有 5 张聚合表 `_id` 和字段不变。
  - 现有测试继续通过。
  - _Requirement: 2_

## Phase 5A.2：Dashboard API 支持筛选

- [x] 2.1 扩展 dashboard range 参数。
  - 在 `cloudbase/functions/dashboard_api/dashboard-data.js` 支持 `host`。
  - 支持 `contentVersion`，内部映射到 `content_version`。
  - 非法值安全归一化。
  - _Requirement: 3, 5_

- [x] 2.2 扩展 HTTP query 解析。
  - 在 `cloudbase/functions/dashboard_api/index.js` 读取 `host` 和 `contentVersion`。
  - 继续校验 `DASHBOARD_TOKEN`。
  - 不新增或写死任何 token。
  - _Requirement: 3, 5_

- [x] 2.3 读取 `analytics_source_daily`。
  - 有 `host` 或 `contentVersion` 筛选时读取新聚合表。
  - 无筛选时保持旧响应兼容。
  - 不扫描 `analytics_events`。
  - _Requirement: 3, 5_

- [x] 2.4 扩展 API 响应。
  - 返回筛选后的核心 `summary` 或 `source_summary`。
  - 在 `range` 和 `meta` 中标注筛选口径。
  - 响应不包含明细隐私字段。
  - _Requirement: 3, 5_

## Phase 5A.3：后台页面筛选控件

- [x] 3.1 更新 `admin/dashboard.html`。
  - 增加 `Host` 输入控件。
  - 增加 `Content Version` 输入控件。
  - 不写入任何默认 token。
  - _Requirement: 4, 5_

- [x] 3.2 更新 `admin/dashboard.mjs`。
  - 读取两个筛选值。
  - 空值不传 query 参数。
  - 提交时带上 `host` / `contentVersion`。
  - 状态栏展示当前筛选口径。
  - _Requirement: 4_

- [x] 3.3 更新 `admin/dashboard.css`。
  - 调整 toolbar 布局适配新增控件。
  - 保持移动端可用。
  - _Requirement: 4_

- [x] 3.4 标注细分模块口径。
  - 如果题目、结果、分享、漏斗仍来自原 5 张表，则在 UI 中说明细分模块仍按 `date + channel` 汇总。
  - _Requirement: 4_

## Phase 5A.4：测试

- [x] 4.1 更新 `tests/analytics-rollup.test.mjs`。
  - 覆盖 host 拆分。
  - 覆盖 content version 拆分。
  - 覆盖 `unknown` 归类。
  - 覆盖测试渠道默认排除。
  - _Requirement: 1, 2, 7_

- [x] 4.2 更新 `tests/dashboard-api.test.mjs`。
  - 覆盖 `host` / `contentVersion` 参数。
  - 覆盖 source summary 合并。
  - 覆盖隐私字段不返回。
  - 覆盖无筛选兼容。
  - _Requirement: 3, 5, 7_

- [x] 4.3 如需要，更新 `tests/build.test.mjs`。
  - 确认新增 admin UI 文件仍在构建产物中。
  - _Requirement: 4, 7_

## Phase 5A.5：CloudBase 资源准备

- [x] 5.1 使用 CloudBase MCP / 官方文档复核集合和索引操作。
  - 确认创建集合方式。
  - 确认索引字段格式。
  - 确认权限配置方式。
  - _Requirement: 6_

- [x] 5.2 创建 `analytics_source_daily` 集合。
  - 仅在用户确认实施和 CloudBase 变更后执行。
  - _Requirement: 6_

- [x] 5.3 配置集合权限为 `ADMINONLY`。
  - 确认前端不能直接读取。
  - _Requirement: 5, 6_

- [x] 5.4 创建最小必要索引。
  - 建议 `channel + date + host + content_version`。
  - 不创建多余索引。
  - _Requirement: 6_

## Phase 5A.6：本地验证

- [x] 6.1 运行完整测试。

```powershell
node --test .\tests\*.test.mjs
```

  - _Requirement: 7_

- [x] 6.2 运行构建。

```powershell
npm run build
```

  - _Requirement: 7_

- [x] 6.3 检查敏感信息。

```powershell
rg -n "ghd_|DASHBOARD_TOKEN|SECRET|TOKEN" -S . --glob "!dist/**" --glob "!.git/**"
```

  - 确认没有真实 token 或密钥写入仓库。
  - _Requirement: 5_

- [x] 6.4 检查 git 状态。
  - 确认不提交 ignored 产物。
  - _Requirement: 7_

## Phase 5A.7：部署与真实数据验证

- [x] 7.1 部署 `analytics_rollup`。
  - 仅在 CloudBase 集合和权限准备完成后。
  - _Requirement: 1, 6_

- [x] 7.2 手动触发 rollup 回填目标日期。
  - 验证 `analytics_source_daily` 有记录写入。
  - 验证 `debug_*` 默认排除。
  - _Requirement: 1, 6_

- [x] 7.3 部署 `dashboard_api`。
  - 验证无 token 返回 401。
  - 验证带 token 且带筛选参数返回聚合结果。
  - 验证响应不包含 `anon_id`、`session_id`、`payload`。
  - _Requirement: 3, 5_

- [x] 7.4 构建并发布静态看板。
  - 不提交 `dist/`。
  - 通过真实浏览器打开 `/admin/dashboard.html` 验证筛选控件。
  - _Requirement: 4, 7_

## Phase 5A.8：提交

- [x] 8.1 复查改动文件。
  - 确认没有题库、打分、结果结构改动。
  - 确认没有敏感信息。
  - _Requirement: 5, 7_

- [x] 8.2 提交并推送。
  - 不提交 ignored 产物。
  - 提交信息建议：`feat: add dashboard source filters`
  - _Requirement: 7_

## 停止点

本 spec 已经按用户确认进入实施阶段；后续如要扩大到题目、结果、分享或漏斗明细筛选，应另开 Phase 5B 并重新确认数据模型。
