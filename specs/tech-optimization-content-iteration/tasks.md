# 技术优化与内容迭代 Spec - Tasks

> 历史说明：本目录记录从基础埋点、内容版本到 Phase 5A 的技术优化过程，部分示例版本号仍保留当时的 `content-2026-05-20` 草案值。当前内容版本、上线入口和 Phase 5B 看板口径，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 执行规则

- 开始实现前必须先读 `requirements.md` 和 `design.md`。
- 开始实现前必须先向用户汇报理解、风险和任务顺序。
- 用户确认前不得修改代码。
- 每个阶段只做对应范围，避免顺手重构题库、打分和结果结构。

## Phase 0：项目现状复核

- [x] 0.1 读取项目基础文件。
  - `README.md`
  - `DEPLOYMENT.md`
  - `index.html`
  - `src/app.mjs`
  - `src/analytics.mjs`
  - `src/scoring.mjs`
  - `src/share.mjs`
  - `src/data/questions.mjs`
  - `src/data/results.mjs`
  - _Requirement: 7_

- [x] 0.2 读取 CloudBase 与看板文件。
  - `cloudbase/functions/analytics_collect/index.js`
  - `cloudbase/functions/analytics_rollup/index.js`
  - `cloudbase/functions/analytics_rollup/rollup-core.js`
  - `cloudbase/functions/dashboard_api/index.js`
  - `cloudbase/functions/dashboard_api/dashboard-data.js`
  - `admin/dashboard.html`
  - `admin/dashboard.mjs`
  - _Requirement: 6, 7_

- [x] 0.3 读取测试文件。
  - `tests/analytics.test.mjs`
  - `tests/analytics-rollup.test.mjs`
  - `tests/dashboard-api.test.mjs`
  - `tests/content.test.mjs`
  - `tests/build.test.mjs`
  - _Requirement: 4, 5_

- [x] 0.4 输出第一阶段汇报，等待用户确认。
  - 当前埋点字段。
  - 当前 Vercel / CloudBase 数据采集口径。
  - 本轮拟改文件。
  - 风险与回滚方式。
  - _Requirement: 7_

## Phase 1：埋点字段补充

- [x] 1.1 在 `src/analytics.mjs` 增加部署来源字段。
  - 新增 `host`。
  - 新增 `origin`。
  - 保持字段为字符串。
  - _Requirement: 1_

- [x] 1.2 在 `src/analytics.mjs` 增加内容版本配置。
  - `DEFAULT_CONFIG.contentVersion`。
  - 事件中写入 `content_version`。
  - _Requirement: 2_

- [x] 1.3 在 `src/app.mjs` 初始化埋点时传入内容版本。
  - 新增 `CONTENT_VERSION` 常量。
  - 从 `window.GH_ANALYTICS_CONFIG.contentVersion` 支持覆盖。
  - _Requirement: 2_

- [x] 1.4 在 `index.html` 中补充当前内容版本。
  - `contentVersion: 'content-2026-05-20'` 或经用户确认的新版本名。
  - _Requirement: 2_

- [x] 1.5 更新 `tests/analytics.test.mjs`。
  - 验证 `host`。
  - 验证 `origin`。
  - 验证 `content_version`。
  - _Requirement: 1, 2_

## Phase 2：文档同步

- [x] 2.1 更新 `README.md`。
  - 删除“基础埋点 console 输出”的旧口径。
  - 增加 CloudBase 埋点和看板说明。
  - 增加 analytics docs 链接。
  - _Requirement: 3_

- [x] 2.2 更新 `DEPLOYMENT.md`。
  - 说明 Vercel 和 CloudBase 静态站都会向 CloudBase endpoint 上报。
  - 说明如何确认线上 HTML 是否包含 endpoint。
  - _Requirement: 3_

- [x] 2.3 更新埋点方案文档。
  - 增加 `host` / `origin` / `content_version` 字段说明。
  - 增加内容版本维护规则。
  - _Requirement: 1, 2, 3_

- [x] 2.4 更新数据看板方案文档。
  - 说明 P0 看板仍按 `date + channel` 汇总。
  - 明确 P1 才考虑 host / contentVersion 过滤。
  - _Requirement: 2, 6_

## Phase 3：文案配置维护说明

- [x] 3.1 新增文案配置说明文档。
  - 建议路径：`docs/content/2026-05-21-题库与人格配置维护说明.md`
  - _Requirement: 4_

- [x] 3.2 在文档中说明题库字段。
  - `id`
  - `chapter`
  - `dimension`
  - `weight`
  - `title`
  - `leftChoice`
  - `rightChoice`
  - _Requirement: 4_

- [x] 3.3 在文档中说明结果字段。
  - `type`
  - `name`
  - `identity`
  - `headline`
  - `worldCopy`
  - `playerCopy`
  - `tags`
  - `charges`
  - `talent`
  - `weakness`
  - `bestPartners`
  - `nemesis`
  - `shareCTA`
  - _Requirement: 4_

- [x] 3.4 在文档中标注低风险 / 中风险 / 高风险改动。
  - 低风险：纯文本替换。
  - 中风险：题序、章节、维度、权重调整。
  - 高风险：题量、维度体系、结果体系改变。
  - _Requirement: 4_

## Phase 4：验证

- [x] 4.1 运行单元测试。
  - `node --test .\tests\*.test.mjs`
  - _Requirement: 1, 2, 3, 4_

- [x] 4.2 运行构建。
  - `npm run build`
  - _Requirement: 5_

- [x] 4.3 检查敏感信息。
  - `rg -n "ghd_|DASHBOARD_TOKEN|SECRET|TOKEN" -S . --glob "!dist/**" --glob "!.git/**"`
  - 确认没有真实 token 写入源码。
  - _Requirement: 6_

- [x] 4.4 检查 Git 状态。
  - 确认 `dist/`、日志、本地产物未进入提交。
  - _Requirement: 6_

## Phase 5：可选后续

- [x] 5.1 看板支持 `host` 筛选。
  - 扩展 rollup 维度。
  - 扩展 dashboard_api query 参数。
  - 扩展后台页面筛选控件。
  - 已在 `specs/dashboard-source-content-filter/` Phase 5A 落地为核心指标筛选；细分模块仍按 `date + channel`。
  - 后续 Phase 5B 已在 `specs/dashboard-source-detail-filter/` 进入代码层实现，细分模块来源快照口径待 CloudBase 部署验证。
  - _Requirement: 1, 6_

- [x] 5.2 看板支持 `contentVersion` 筛选。
  - 扩展聚合表结构。
  - 更新测试。
  - 明确旧数据兼容策略。
  - 已在 `specs/dashboard-source-content-filter/` Phase 5A 落地为 `analytics_source_daily`；缺失字段归 `unknown`。
  - 后续 Phase 5B 已把 `analytics_source_daily` 扩展为来源看板快照表，当前共享说明应以最新 analytics docs 为准。
  - _Requirement: 2, 6_

- [ ] 5.3 拆分 `src/app.mjs`。
  - 优先拆分享图绘制。
  - 再拆状态管理。
  - 再拆分享动作。
  - 每次拆分都保持测试通过。
  - _Requirement: 5_

- [ ] 5.4 文案同学定稿后替换题库和结果配置。
  - 保持当前结构时只改配置。
  - 改结构时先更新 spec 和测试。
  - _Requirement: 4_
