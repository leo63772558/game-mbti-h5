# 技术优化与内容迭代 Spec - Requirements

> 历史说明：本目录记录从基础埋点、内容版本到 Phase 5A 的技术优化过程，部分示例版本号仍保留当时的 `content-2026-05-20` 草案值。当前内容版本、上线入口和 Phase 5B 看板口径，请以 README、DEPLOYMENT 和最新 analytics docs 为准。

## 1. 背景

当前项目是纯静态 H5「异界开局人格测试 / 游戏人格 H5」，已经具备：

- 24 题游戏人格测试主流程。
- 16 个结果类型配置。
- 结果卡、分享图和平台文案闭环。
- CloudBase 埋点采集：`analytics_collect` -> `analytics_events`。
- CloudBase 数据看板：`analytics_rollup` -> 聚合表 -> `dashboard_api` -> `admin/dashboard.html`。
- GitHub 分支：`feature/cloudbase-analytics-dashboard`。
- Draft PR：`https://github.com/shenbo1264/game-mbti-h5/pull/1`。

本轮优化不是重做产品，而是在现有架构上提升后续迭代可维护性、数据可解释性和文案配置效率。

## 2. 目标

1. 让埋点数据能明确区分部署来源，例如 Vercel、CloudBase 静态站、后续自定义域名。
2. 让不同题库 / 结果文案版本的数据可区分，避免文案调整后新旧数据混在一起。
3. 同步项目文档，消除 README 中与当前 CloudBase 埋点 / 看板现状不一致的描述。
4. 降低后续文案同学修改题目、结果人格配置的技术风险。
5. 在不引入框架、不重构业务核心的前提下，为后续拆分 `src/app.mjs` 做安全准备。

## 3. 非目标

- 不引入 React / Vue / Next / Vite。
- 不改变当前 24 题、4 维、16 结果的产品结构，除非用户另行确认。
- 不重写打分算法，除非文案方案明确要求更换人格体系。
- 不直接把看板页面改成读取 `analytics_events` 明细表。
- 不把 dashboard token 或任何密钥写入仓库。
- 不提交 `dist/`、日志、Playwright 产物或本地输出目录。

## 4. 当前事实与约束

### 4.1 Vercel 数据采集现状

已确认 Vercel 线上页面包含：

- `window.GH_ANALYTICS_CONFIG`
- CloudBase endpoint：`/analytics/collect`

因此 Vercel 上的用户行为会写入同一个 `analytics_events` 明细表。

当前埋点公共字段有 `path`、`query`、`referrer`，但没有明确的 `host` / `origin` 字段。不同部署站点的数据目前主要靠 `channel` 区分，不能稳定按部署域名拆分。

### 4.2 内容配置现状

题库文件：

```text
src/data/questions.mjs
```

结果配置：

```text
src/data/results.mjs
```

打分逻辑：

```text
src/scoring.mjs
```

当前技术结构允许文案直接替换题目、选项、结果名、headline、标签、罪状、天赋、弱点等文本。只要不改变题目数量、维度、结果 key 和打分规则，技术成本较低。

## 5. 用户故事

### Story 1：运营希望区分不同部署来源的数据

作为运营或项目维护者，我希望看板能区分来自 Vercel、CloudBase 静态站和未来自定义域名的数据，以便判断不同传播入口和部署入口的表现。

### Story 2：运营希望区分不同内容版本的数据

作为运营或文案负责人，我希望题库和结果文案更新后，数据能按内容版本拆开分析，以免旧版题库数据影响新版判断。

### Story 3：文案同学希望低成本更新题目和人格配置

作为文案同学，我希望能按一个清晰模板修改题目和结果文案，而不是理解整个前端逻辑后才能改。

### Story 4：技术维护者希望减少主应用文件继续膨胀

作为技术维护者，我希望后续新增功能时能逐步拆分 `src/app.mjs`，降低页面渲染、分享图、状态管理和埋点混在一起的维护风险。

### Story 5：项目负责人希望新对话中的 AI 先读项目再行动

作为项目负责人，我希望下一轮 AI 先充分阅读项目现状和本 spec，先汇报理解与计划，经我确认后再改代码。

## 6. 功能需求与验收标准

### Requirement 1：埋点公共字段补充部署来源

When 前端触发任意白名单埋点事件，the analytics module shall 在事件公共字段中写入当前页面的 `host` 和 `origin`。

When 事件从 Vercel、CloudBase 默认域名或本地预览产生，the analytics module shall 能通过 `host` 或 `origin` 区分来源。

When 采集云函数收到包含 `host` / `origin` 的事件，the collect function shall 继续接受并写入数据库。

When 看板 API 聚合数据时，the dashboard shall 不默认返回明细级 `host` / `origin`，除非后续明确设计为聚合维度。

### Requirement 2：引入内容版本字段

When 前端初始化埋点配置，the application shall 设置一个明确的 `contentVersion`。

When 任意埋点事件被创建，the analytics module shall 在公共字段或 payload 中携带内容版本。

When 文案同学更新题库或结果配置，the maintainer shall 同步递增内容版本。

When 看板聚合默认执行，the rollup shall 至少保留内容版本信息用于后续扩展；如果本轮不改聚合维度，则必须在文档中明确当前看板仍为全版本汇总。

### Requirement 3：README 与部署文档同步

When 用户阅读 README，the documentation shall 准确描述当前已接入 CloudBase 埋点采集和数据看板，而不是继续描述为 console 埋点。

When 用户阅读 README，the documentation shall 指向已有的 analytics / dashboard 方案文档。

When 用户阅读部署文档，the documentation shall 说明 Vercel 与 CloudBase 静态站都会向 CloudBase 采集 endpoint 上报数据。

### Requirement 4：文案配置模板与校验

When 文案同学准备改题，the project shall 提供清晰的字段说明：`id`、`chapter`、`dimension`、`weight`、`title`、`leftChoice`、`rightChoice`。

When 文案同学准备改人格结果，the project shall 提供清晰的字段说明：`type`、`name`、`identity`、`headline`、`worldCopy`、`playerCopy`、`tags`、`charges`、`talent`、`weakness`、`bestPartners`、`nemesis`、`shareCTA`。

When 题库仍保持当前 24 题、4 维结构，the existing tests shall validate 题目数量、维度分布、结果 key 完整性和用户端不暴露内部类型码。

When 文案改动改变题目数量、维度或结果体系，the maintainer shall 先更新 spec 和测试，再进入实现。

### Requirement 5：主应用拆分前置准备

When 技术侧进行模块拆分，the implementation shall preserve existing user behavior and test results.

When 拆分 `src/app.mjs`，the implementation shall 优先拆出纯函数或低耦合模块，例如分享图绘制、状态读写、结果视图渲染辅助函数。

When 拆分完成，the test suite shall 继续通过，且构建产物仍为纯静态 H5。

### Requirement 6：资源消耗与隐私边界

When 新增字段或版本口径，the implementation shall not increase dashboard queries against `analytics_events` from the browser.

When dashboard_api returns data, the API shall not return `anon_id`、`session_id`、完整 `payload`。

When analytics_rollup runs on a schedule, the function shall continue to default-exclude `e2e_*`、`debug_*`、`test_*` channels.

### Requirement 7：执行流程约束

When a new AI conversation starts from this spec, the AI shall first read README, deployment docs, analytics docs, this spec, and relevant source files before proposing code changes.

When the AI finishes initial reading, the AI shall report current understanding, risks, file plan, and proposed task order.

When the user has not confirmed the report, the AI shall not modify project files.

## 7. 风险

1. 内容版本加在公共字段后，聚合表不立刻按版本拆分，会导致看板仍是全版本混合；需要在实现时明确本轮范围。
2. 如果后续文案改动不只是文本替换，而是改变维度或人格体系，会影响打分逻辑和历史数据解释。
3. `src/app.mjs` 已经偏大，继续直接加功能会提高回归风险。
4. 如果 Vercel 与 CloudBase 同时作为正式入口，需要看板后续支持按 host / origin 筛选。
5. dashboard token 已在 CloudBase 环境变量中，不能写入仓库或 PR 描述。

## 8. 建议优先级

P0：

- 补 `host` / `origin` 埋点字段。
- 补 `contentVersion`。
- 更新 README / DEPLOYMENT 对当前线上数据采集口径的说明。
- 建立文案配置模板。

P1：

- 看板支持按 `host` 或 `contentVersion` 查询 / 筛选。
- 拆分 `src/app.mjs` 中的分享图绘制和状态管理。

P2：

- 如果内容体系改变，再设计新的 scoring / result mapping。
- 引入短链或二维码，完善分享图闭环。
