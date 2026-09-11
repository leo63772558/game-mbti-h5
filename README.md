# 异界开局人格测试 H5 Demo

这是早期按 `02-产品技术Spec-游戏MBTI-H5.md` 搭起的静态开发框架，当前正式内容体系已迁移到 GPTI 玩家人格体系。

内部说明：项目早期代号为“游戏 MBTI H5”。当前正式内容体系为 GPTI，内部标准类型 key 为 `ATRB`、`ATRC` 等 16 个 GPTI code；对外用户端目标口径是“游戏人格 / 游戏灵魂职业 / 异界职业档案”，默认不直接暴露 MBTI、16 型人格、INTJ/ENFP 或 ATRB/ATRC 等内部编码。

## 当前能力

- “异界档案终端”首页。
- 24 道 GPTI 四选项沉浸式 RPG 情境题。
- 4 个章节反馈。
- GPTI 八极四轴内部打分，输出标准 16 型主结果。
- 16 个游戏灵魂职业结果映射，内部 key 使用 GPTI 标准类型编码。
- 隐藏特质 / 稀有变体作为附加展示，不覆盖主结果。
- “异界职业档案卡”结果页。
- Canvas/PNG 分享图预览弹层。
- 保存图片、平台晒图文案、复制测试链接闭环。
- SVG 结果卡 fallback 保留。
- localStorage 进度保存。
- CloudBase 埋点采集，含 `host`、`origin`、`content_version`、渠道、设备、题目漏斗和分享行为字段。
- CloudBase 数据看板，链路为 `analytics_collect` -> `analytics_events` -> `analytics_rollup` -> 聚合表 -> `dashboard_api` -> `admin/dashboard.html`。
- 看板代码层支持按 `host` / `contentVersion` 筛选；有来源筛选时，核心指标、漏斗、题目、结果和分享明细均来自 `analytics_source_daily` 来源快照，同一来源/版本口径展示。CloudBase 部署、回填和真实浏览器验证状态以 analytics 文档记录为准。
- `h5_channel` 渠道参数保留与安全校验。
- Node 内置测试覆盖打分、内容、分享、渠道、时序、埋点、聚合、看板 API 和构建产物。
- 基础 SEO/OG meta，含 `assets/og/cover.png`。
- `assets/avatars/` 已接入 16 张 512x512 PNG 结果头像，当前为白底低多边形人物卡风格；`assets/questions/` 已接入 24 张题目场景插画初版；`assets/results/` 仍作为可选结果大图目录预留。

## 用户端口径状态

- 用户可见页面、分享图、平台文案、SEO/OG 已按“游戏人格 / 游戏灵魂职业 / 异界职业档案”清理。
- 结果页和分享图使用 `ARCHIVE-024`、`职业谱系`、`档案类型`、`档案稳定度` 等外部口径。
- 答题选项只展示用户可见选项文案，不展示关键词、pole 或内部 type code。
- 内部代码和配置保留 GPTI 类型编码作为结果映射 key；这些编码不应直接进入用户端展示文案。
- localStorage 只恢复同 `schemaVersion`、同 `contentVersion` 的 GPTI 状态；旧 `score_*` 答题状态会回到首页，避免旧样稿误出新结果。
- legacy analytics 测试中的 `content-2026-05-21`、`dimension`、`score_*` 只用于验证历史数据兼容，不代表当前 GPTI payload。

## 文件结构

```text
demo/
  index.html
  edgeone.json
  vercel.json
  package.json
  admin/
    dashboard.html
    dashboard.mjs
    dashboard.css
  scripts/
    build.mjs
  cloudbase/
    functions/
      analytics_collect/
      analytics_rollup/
      dashboard_api/
  docs/
    analytics/
    content/
  assets/
    results/
    avatars/
    og/
  src/
    app.mjs
    analytics.mjs
    channel.mjs
    scoring.mjs
    share.mjs
    styles.css
    timing.mjs
    data/
      gpti.mjs
      questions.mjs
      results.mjs
      traits.mjs
  tests/
    build.test.mjs
    channel.test.mjs
    content.test.mjs
    analytics.test.mjs
    analytics-rollup.test.mjs
    dashboard-api.test.mjs
    dashboard-ui.test.mjs
    scoring.test.mjs
    share.test.mjs
    timing.test.mjs
```

## 本地运行

在 `H5/demo` 目录启动静态服务器：

```powershell
python -m http.server 5178
```

访问：

```text
http://localhost:5178/
```

## 部署

部署说明见：

[DEPLOYMENT.md](./DEPLOYMENT.md)

当前入口状态：

- 正式 H5 入口走 EdgeOne Pages：`https://gameplayti.icu/`。
- 正式数据看板入口走 EdgeOne Pages：`https://gameplayti.icu/admin/dashboard.html`。
- 预览、手机验证和回滚入口继续放在 Vercel：`https://demo-phi-pearl.vercel.app`。
- CloudBase 默认静态托管域名只用于技术排查，不作为用户试玩或正式传播入口。
- CloudBase 继续承接埋点采集、rollup、看板 API 和聚合数据；前端当前仍使用 CloudBase 绝对 endpoint。
- EdgeOne `edgeone.json` 负责给 `.mjs` 模块资源补 `Content-Type: application/javascript`；不要给 `<script type="module">` 的 `.mjs` 入口追加 `?v=`。

埋点和看板方案见：

- [埋点架构与事件方案](./docs/analytics/2026-05-19-埋点架构与事件方案.md)
- [数据看板与汇总方案](./docs/analytics/2026-05-20-数据看板与汇总方案.md)
- [GPTI 内容输入模板与校验规则](./docs/content/2026-05-23-GPTI内容输入模板与校验规则.md)
- [题库与人格配置维护说明](./docs/content/2026-05-21-题库与人格配置维护说明.md)

## 测试

在项目根目录运行：

```powershell
node --test .\H5\demo\tests\*.test.mjs
```

或在 `H5/demo` 目录运行：

```powershell
npm test
node --test .\tests\*.test.mjs
```

跨平台 shell 可使用：

```bash
node --test "tests/*.test.mjs"
```

## 构建静态发布产物

如果托管平台需要干净发布目录，可在 `H5/demo` 目录运行：

```powershell
npm run build
```

脚本会生成 `dist/`，仅包含运行所需的：

- `index.html`
- `src/`
- `assets/`
- `admin/`
- `edgeone.json`

不会发布 `README.md`、`DEPLOYMENT.md`、`docs/`、`tests/` 或 `output/`。

## 后续接入方式

- 文案组优先按 `docs/content/2026-05-23-GPTI内容输入模板与校验规则.md` 整理结构化内容。
- 题库更新主要进入 `src/data/questions.mjs`；结果文案更新主要进入 `src/data/results.mjs`；隐藏特质规则进入 `src/data/traits.mjs`。
- 题库、结果文案、分享图或结果页承接会影响用户选择 / 结果理解 / 分享意愿时，同步递增 `contentVersion`，当前版本为 `content-2026-06-10-gpti-scoring-calibration-a`。本版本在 `content-2026-06-05-gpti-side-quest-c` 基础上校准题目 `poles`，降低选项位置导致的结果偏置；保留结果页支线任务承接区、分享图玩家群二维码、最终 16 型结果名称、结果头像和统计口径；结果头像与二维码 URL 会带当前 `contentVersion` 参数，避免 CloudBase 长缓存命中旧资源；不改 16 型主结果体系。
- 若后续有正式美术交付，优先替换 `assets/avatars/{TYPE}.png` 或补 `assets/results/{TYPE}.png`；纯视觉替换通常不需要递增 `contentVersion`。
- 技术组后续可继续优化 Canvas 分享图，如补真实二维码或短链入口。
- 部署时使用 `DEPLOYMENT.md`，并用 `?h5_channel=` 区分渠道来源；当前 EdgeOne 正式域名、Vercel 预览和本地预览都会向同一个 CloudBase endpoint 上报，复盘时必须用 `host` / `contentVersion` 区分来源。
- GPTI 第一阶段仍保持 24 题，因此 CloudBase rollup / dashboard 现有漏斗口径暂不改；关键词热度、四轴分布、隐藏特质分布放到后续单独评估。
