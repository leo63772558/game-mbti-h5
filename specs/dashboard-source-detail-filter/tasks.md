# Phase 5B 数据看板来源明细筛选 - Tasks

## 执行规则

- 本任务清单确认前不得进入实现。
- 实施时继续保持纯静态 H5 主体，不引入 React / Vue / Next / Vite。
- 不修改题库结构、打分逻辑、结果配置结构或用户侧 H5 主流程。
- `admin/dashboard.html` 不得直接读取 `analytics_events`。
- `dashboard_api` 不得在请求时扫描 `analytics_events`。
- 不把 dashboard token、密钥或敏感信息写入前端代码或仓库。
- 不提交 `dist/`、日志、`.playwright-cli/`、`.vercel/`、`output/` 等 ignored 产物。
- 涉及 CloudBase 集合、索引、权限、环境变量、网关、CORS 或部署方式变化时，先停下确认，并使用 CloudBase MCP / 官方文档确认操作方式。

## Phase 5B.0：Spec 确认

- [x] 0.1 用户确认 Phase 5B 方案。
  - 确认复用并扩展 `analytics_source_daily`。
  - 确认有来源筛选时所有可见模块都来自 source snapshot。
  - 确认旧 summary-only source records 不 fallback 到未筛选明细。
  - 确认第一版不新增 CloudBase 集合、权限或索引。
  - _Requirement: 1, 2, 3, 4, 5, 6_

- [x] 0.2 进入实现前复核工作区状态。
  - `git status --short --branch --ignored`
  - 确认没有需要保护的未提交用户改动。
  - _Requirement: 9_

## Phase 5B.1：Rollup TDD

- [x] 1.1 增加 source detail rollup 测试。
  - 覆盖不同 `host` 的漏斗、题目、结果、分享不混入。
  - 覆盖不同 `content_version` 的漏斗、题目、结果、分享不混入。
  - 覆盖 `unknown` 来源生成完整快照。
  - _Requirement: 1, 9_

- [x] 1.2 增加兼容性测试。
  - 原 5 张聚合表输出不变。
  - Phase 5A 顶层核心指标字段继续存在。
  - 测试渠道默认排除。
  - _Requirement: 2, 9_

## Phase 5B.2：Rollup 实现

- [x] 2.1 扩展 source bucket 状态。
  - 在 `cloudbase/functions/analytics_rollup/rollup-core.js` 中让 source bucket 包含 summary、funnel、questions、results、share。
  - 复用现有指标更新函数。
  - _Requirement: 1, 2_

- [x] 2.2 扩展 source finalize 输出。
  - 保留顶层 Phase 5A 核心指标字段。
  - 新增 `summary`、`funnel.steps`、`questions[]`、`results[]`、`share`。
  - 确认输出不包含 `anon_id`、`session_id`、完整 `payload`。
  - _Requirement: 1, 2, 6_

## Phase 5B.3：Dashboard API TDD

- [x] 3.1 增加来源筛选明细响应测试。
  - `host` 筛选下 `summary/funnel/questions/results/share` 全部来自 `analytics_source_daily`。
  - `contentVersion` 筛选下 `summary/funnel/questions/results/share` 全部来自 `analytics_source_daily`。
  - `host + contentVersion` 同时筛选时只合并同时匹配记录。
  - _Requirement: 3, 9_

- [x] 3.2 增加旧记录和隐私边界测试。
  - summary-only source records 不 fallback 到未筛选明细。
  - 无来源筛选时保持旧响应兼容。
  - 响应不包含 `anon_id`、`session_id`、`payload`。
  - _Requirement: 4, 5, 6, 9_

## Phase 5B.4：Dashboard API 实现

- [x] 4.1 调整聚合表读取策略。
  - 无来源筛选时读取原 5 张表。
  - 有来源筛选时读取 `analytics_source_daily` 并避免混用原 5 张明细表。
  - _Requirement: 3, 4, 5, 6_

- [x] 4.2 增加 source detail 合并函数。
  - 合并 source `summary`。
  - 合并 source `funnel.steps`。
  - 合并 source `questions[]`。
  - 合并 source `results[]`。
  - 合并 source `share`。
  - _Requirement: 3_

- [x] 4.3 扩展 meta 口径。
  - 有来源筛选时设置 `summary_scope=source_daily`。
  - 有来源筛选且明细可用时设置 `detail_tables_scope=source_daily`。
  - 旧 source records 缺少明细时设置明确 coverage 标记。
  - _Requirement: 3, 5, 7_

## Phase 5B.5：Dashboard UI

- [x] 5.1 更新状态文案。
  - 来源筛选完整生效时提示所有模块均按来源/版本筛选。
  - 无来源筛选时提示 `date + channel` 汇总。
  - 明细缺少回填时提示需要重新 rollup。
  - _Requirement: 7_

- [x] 5.2 更新 UI 测试。
  - 确认页面仍发送 `host` / `contentVersion`。
  - 确认脚本不包含 `analytics_events` 直接读取逻辑。
  - 确认旧的“明细仍按 date + channel”文案只在对应口径出现。
  - _Requirement: 6, 7, 9_

## Phase 5B.6：文档同步

- [x] 6.1 更新数据看板方案文档。
  - 说明 Phase 5B 后来源筛选覆盖核心指标、漏斗、题目、结果和分享。
  - 说明 `analytics_source_daily` 已升级为来源看板快照表。
  - 说明上线前验证数据不是正式运营数据。
  - _Requirement: 3, 8_

- [x] 6.2 更新 README / DEPLOYMENT。
  - README 当前能力同步 Phase 5B 口径。
  - DEPLOYMENT 中的埋点与看板说明同步 Phase 5B 口径。
  - _Requirement: 7, 8_

## Phase 5B.7：本地验证

- [x] 7.1 运行完整测试。

```powershell
node --test .\tests\*.test.mjs
```

  - _Requirement: 9_

- [x] 7.2 运行构建。

```powershell
npm run build
```

  - _Requirement: 9_

- [x] 7.3 检查敏感信息。

```powershell
rg -n "ghd_|DASHBOARD_TOKEN|SECRET|TOKEN" -S . --glob "!dist/**" --glob "!.git/**"
```

  - 确认没有真实 token 或密钥写入仓库。
  - _Requirement: 6, 9_

- [x] 7.4 检查 git 状态。
  - 确认不提交 ignored 产物。
  - 确认改动文件符合本阶段范围。
  - _Requirement: 9_

## Phase 5B.8：CloudBase 部署与真实浏览器验证

- [ ] 8.1 部署前确认 CloudBase 变更范围。
  - 如果仍只部署云函数和静态看板，按现有部署链路执行。
  - 如果需要新增或修改集合、权限、索引、环境变量、网关或 CORS，先停下确认。
  - _Requirement: 6, 8_

- [ ] 8.2 部署 `analytics_rollup`。
  - 部署后对目标日期重新触发 rollup。
  - 验证 `analytics_source_daily` 包含嵌入明细字段。
  - _Requirement: 1, 8_

- [ ] 8.3 部署 `dashboard_api`。
  - 验证无 token 返回 401。
  - 验证带 token 且带来源筛选时所有模块同口径。
  - 验证响应不包含明细隐私字段。
  - _Requirement: 3, 6_

- [ ] 8.4 发布静态看板并用真实浏览器验证。
  - 打开 `/admin/dashboard.html`。
  - 输入 `host` / `contentVersion` 筛选。
  - 确认状态文案和模块数据口径一致。
  - _Requirement: 7, 8_

## Phase 5B.9：提交与推送

- [ ] 9.1 复查改动。
  - 确认没有业务逻辑、题库结构、打分逻辑、结果配置结构的无关改动。
  - 确认没有敏感信息。
  - _Requirement: 2, 6, 9_

- [ ] 9.2 提交并推送。
  - 建议提交信息：`feat: add source-filtered dashboard details`
  - 不提交 ignored 产物。
  - _Requirement: 9_

## 停止点

当前 Phase 5B 已完成代码层实现、本地测试、构建和文档同步；尚未完成 CloudBase 部署、真实浏览器验证、提交与推送。进入 Phase 5B.8 之前，仍必须先确认 CloudBase 变更范围和部署动作。
