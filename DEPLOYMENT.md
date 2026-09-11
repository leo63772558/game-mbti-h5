# 部署与多端兼容说明

## 1. 当前项目适合怎么部署

当前 demo 是纯静态 H5：

- `index.html`
- `src/app.mjs`
- `src/styles.css`
- `src/data/questions.mjs`
- `src/data/results.mjs`
- `src/data/gpti.mjs`
- `src/data/traits.mjs`

不依赖后端，不需要数据库，不引入框架。最适合部署到静态托管平台。

当前项目新增了一个极轻量构建脚本，用于生成干净的静态发布目录：

```powershell
npm run build
```

构建输出为 `dist/`，只包含：

- `index.html`
- `src/`
- `assets/`
- `admin/`
- `edgeone.json`

不会把 `README.md`、`DEPLOYMENT.md`、`docs/`、`tests/`、`output/` 发布到线上。

当前入口策略：

1. **EdgeOne Pages + `gameplayti.icu`**：当前正式 H5 入口和同域数据看板入口。静态页面由 EdgeOne Pages 托管，埋点采集和看板 API 继续走 CloudBase 绝对 endpoint。
2. **Vercel**：继续作为预览、手机验证和回滚入口，使用 `https://demo-phi-pearl.vercel.app` 或 Vercel 生成的预览链接。
3. **CloudBase**：继续承接 `analytics_collect`、`analytics_rollup`、`dashboard_api` 和聚合表；默认静态托管域名只用于技术排查，不发给用户试玩。
4. **Netlify / GitHub Pages**：仅作为备选静态托管方案，当前不作为主入口。

当前可用公开链接：

- EdgeOne 正式 H5 入口：`https://gameplayti.icu/`
- EdgeOne 数据看板入口：`https://gameplayti.icu/admin/dashboard.html`
- Vercel 预览入口：`https://demo-phi-pearl.vercel.app`
- CloudBase 默认静态托管域名（仅技术排查）：`https://test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com`

注意：部分 Vercel deployment URL 可能返回 401，不适合直接发给手机用户；优先使用公开别名。CloudBase 官方文档说明默认域名仅适用于开发测试阶段，生产环境浏览器直接访问静态网站托管、云托管或 HTTP 访问服务应使用已备案自定义域名。当前 CloudBase 默认静态托管域名已复现 `content-disposition: attachment`，见本文件第 5.1 节排查记录，因此不作为正式用户入口。

当前 `index.html` 内置 CloudBase 埋点 endpoint：

```text
https://test1264-d0gzi7ut615711548-1434258997.ap-shanghai.app.tcloudbase.com/analytics/collect
```

因此 Vercel、CloudBase 静态站和本地静态预览只要发布/加载的是当前 `index.html`，都会向同一个 CloudBase endpoint 上报数据。区分部署来源依赖埋点公共字段 `host` / `origin`，区分题库与结果文案版本依赖 `content_version`，当前 GPTI 内容版本为 `content-2026-06-10-gpti-scoring-calibration-a`。

在正式域名和同源路由完成真实浏览器验证前，不要把 `GH_ANALYTICS_CONFIG.endpoint` 改成相对路径 `/analytics/collect`。当前 Vercel 预览仍需要使用绝对 CloudBase endpoint。

## 2. Vercel CLI 快速部署

### 2.1 首次安装

```powershell
npm i -g vercel
```

### 2.2 进入 demo 目录

```powershell
cd "D:\学工文档\光核\小组值周\H5\demo"
```

### 2.3 登录并部署预览版

```powershell
vercel
```

第一次运行会让你登录账号，并询问项目设置。

建议选择：

- Framework Preset：Other
- Build Command：`npm run build`
- Output Directory：`dist`
- Development Command：留空

部署成功后，Vercel 会返回一个预览链接。

部署后可打开线上 HTML，确认包含：

```text
window.GH_ANALYTICS_CONFIG
analytics/collect
content-2026-06-10-gpti-scoring-calibration-a
```

确认后，该 Vercel 入口产生的流量会进入 CloudBase `analytics_events` 明细表。

### 2.4 部署 Vercel 预览固定别名

确认预览没问题后：

```powershell
vercel --prod
```

得到的 `https://xxx.vercel.app` 可作为当前预览/内测入口。它不是当前正式用户入口；正式入口走 EdgeOne Pages 的 `https://gameplayti.icu/`。

## 3. GitHub + Vercel 自动部署

如果你们后续把项目传到 GitHub：

1. 把仓库推到 GitHub。
2. 打开 Vercel。
3. Import Project。
4. 选择仓库。
5. Root Directory 设置为：

```text
H5/demo
```

6. Framework Preset 选择 Other。
7. Build Command 填写：

```text
npm run build
```

8. Output Directory 填写：

```text
dist
```

9. Deploy。

之后每次推送 GitHub，Vercel 都会自动更新。

## 4. EdgeOne Pages 正式部署

当前正式域名：

```text
https://gameplayti.icu/
```

当前数据看板：

```text
https://gameplayti.icu/admin/dashboard.html
```

EdgeOne Pages 建议配置：

- Git 仓库：`https://github.com/shenbo1264/game-mbti-h5.git`
- Root Directory：`H5/demo`
- 安装命令：可留空；如平台要求可填 `npm install`
- 构建命令：`npm run build`
- 发布目录：`dist`
- 自定义域名：`gameplayti.icu`

`edgeone.json` 必须保留在仓库根发布目录内。当前 `scripts/build.mjs` 会把它复制进 `dist/`，用于给 ES Module 资源补充浏览器可执行的 MIME：

```json
{
  "source": "/src/*.mjs",
  "headers": [{ "key": "Content-Type", "value": "application/javascript" }]
}
```

同类规则还覆盖 `/src/data/*.mjs` 和 `/admin/*.mjs`。不要把真实 token、CloudBase 凭据或临时登录凭据写入 `edgeone.json`。

EdgeOne 缓存与 `.mjs` 规则：

- 当前线上实测无 query 的 `/src/app.mjs`、`/admin/dashboard.mjs`、`/src/data/questions.mjs` 均返回 `Content-Type: application/javascript`，H5 首页和数据看板可正常运行。
- 不要给 `<script type="module">` 的 `.mjs` 入口追加 `?v=`。带 query 的 `.mjs` 曾在线上返回 `application/octet-stream`，可能导致浏览器拒绝按 ES Module 执行。
- 首页 CSS、头像、题图、OG 图等非模块资源可以继续用 `?v=contentVersion` 做缓存刷新。
- 正式部署后的 JS 刷新优先依赖 EdgeOne Pages 新部署自动刷新边缘缓存；如出现旧资源，先在 EdgeOne 控制台做缓存刷新，不要临时给模块脚本加 query。

发布后应确认：

- `https://gameplayti.icu/` 返回 200，首页在真实浏览器渲染，不是空白页。
- `https://gameplayti.icu/src/app.mjs` 返回 200，`Content-Type` 为 `application/javascript`。
- `https://gameplayti.icu/admin/dashboard.mjs` 返回 200，`Content-Type` 为 `application/javascript`。
- `https://gameplayti.icu/admin/dashboard.html` 显示新版看板口径，包含“分享相关操作”“当前选项：a/b/c/d”“内部类型码”，不再出现“分享意图”或 `score_*`。
- `dashboard_api` 对 `Origin: https://gameplayti.icu` 的 CORS 预检返回允许。
- 看板用 `host = gameplayti.icu` 与 `contentVersion = content-2026-06-02-gpti-final-copy-d` 查询，确认读取的是同一来源/版本的聚合数据。

## 5. CloudBase Git 自动部署

CloudBase 环境：

```text
test1264-d0gzi7ut615711548
```

CloudBase 当前继续作为 HTTP 云函数和聚合数据承载层，不把默认 `*.tcloudbaseapp.com` 静态托管域名发给用户试玩。正式入口当前走 EdgeOne Pages + `gameplayti.icu`，Vercel 作为预览和回滚入口。

Git 仓库：

```text
https://github.com/shenbo1264/game-mbti-h5.git
```

建议在 CloudBase 控制台把 Git 部署配置为：

- Root Directory：`H5/demo`
- 安装命令：可留空；如平台要求可填 `npm install`
- 构建命令：`npm run build`
- 发布目录：`dist`

发布后应确认：

- 首页 200。
- `src/app.mjs` 200。
- `src/styles.css` 200。
- `docs/`、`tests/`、`README.md` 不再暴露。
- 线上 HTML 包含 `window.GH_ANALYTICS_CONFIG`、`analytics/collect` 和 `content-2026-06-10-gpti-scoring-calibration-a`。
- 结果页头像请求应带 `?v=content-2026-06-10-gpti-scoring-calibration-a`，用于绕开 CloudBase 静态资源长缓存；例如 `/assets/avatars/ATRB.png?v=content-2026-06-10-gpti-scoring-calibration-a` 应返回当前人物头像，而不是旧徽章缓存。
- 首页、`index.html`、JS、CSS、PNG 等资源的 `Content-Disposition` 尽量为 `inline` 或为空，不应是 `attachment`。
- 三个渠道 URL 可访问：
  - `?h5_channel=wechat_group`
  - `?h5_channel=friend_circle`
  - `?h5_channel=xiaohongshu`

### 5.1 CloudBase 默认域名 attachment 排查记录

2026-05-19 通过 `curl.exe -I -L` 复核：

| URL | 状态 | Content-Type | Content-Disposition |
|---|---:|---|---|
| CloudBase `/` | 200 | `text/html` | `attachment` |
| CloudBase `/index.html` | 200 | `text/html` | `attachment` |
| CloudBase `/src/app.mjs` | 200 | `application/javascript` | `attachment` |
| CloudBase `/src/styles.css` | 200 | `text/css` | 空 |
| CloudBase `/assets/og/cover.png` | 200 | `image/png` | `attachment` |
| Vercel `/` | 200 | `text/html; charset=utf-8` | `inline` |
| Vercel `/src/app.mjs` | 200 | `application/javascript; charset=utf-8` | `inline; filename="app.mjs"` |
| Vercel `/assets/og/cover.png` | 200 | `image/png` | `inline; filename="cover.png"` |

同时复核：

- CloudBase `/docs/...` 返回 404，`/tests/content.test.mjs` 返回 404，`/README.md` 返回 404。
- 这说明当前 CloudBase 线上大概率已经只发布运行产物，未暴露 `docs/`、`tests/`、`README.md`。
- `attachment` 同时出现在 HTML、JS 和 PNG 上，而 Vercel 同一批资源为 `inline`，因此更像 CloudBase 默认域名访问层或底层 COS 对象元数据问题，不是前端业务代码问题。

当前决策：

1. 不把 CloudBase 默认静态托管域名放进海报、二维码、对外测试群或正式传播物料。
2. `attachment` 问题保留为技术排查记录，不阻塞 Vercel 预览。
3. 正式传播优先使用 EdgeOne Pages 的 `gameplayti.icu`；CloudBase 默认静态托管域名只保留为技术排查入口。
4. 如后续仍需排查默认域名，可再检查静态托管对象元数据和响应头，但这不作为正式上线前置条件。

### 5.2 CloudBase 自定义域名备选方案

前置条件：

- 如后续决定从 EdgeOne Pages 切回 CloudBase 自定义域名，需先确认正式域名或子域名已完成 ICP 备案。
- 准备 HTTPS 证书，或拿到可在腾讯云/CloudBase 绑定的证书 ID。
- 确认 DNS 管理权限，能够按 CloudBase 返回值配置 CNAME。
- 确认是否把后台看板也放在同一正式域名下的 `/admin/dashboard.html`。

配置动作需要在执行前二次确认：

1. 在 CloudBase HTTP 访问服务中绑定正式自定义域名，选择适合静态托管的云开发 CDN，并按返回值配置 DNS CNAME。
2. 在同一正式域名下配置资源关联或路由：
   - `/`、`/index.html`、`/src/*`、`/assets/*`、`/admin/*` -> CloudBase 静态托管。
   - `/analytics/collect` -> HTTP 云函数 `analytics_collect`，网关鉴权关闭，函数内继续做 Origin allowlist。
   - `/dashboard/summary` -> HTTP 云函数 `dashboard_api`，网关鉴权关闭，访问仍由 `DASHBOARD_TOKEN` 校验。
3. 将正式域名加入 CloudBase 安全域名；将 `https://正式域名` 加入 `analytics_collect` 的 CORS allowlist。即使后续走同源 `/analytics/collect`，浏览器 POST 通常仍会带 `Origin: https://正式域名`，当前采集函数会校验该值。
4. 域名、HTTPS、CNAME 和路由真实可用后，再把前端入口切到同源路径：
   - `index.html`：`GH_ANALYTICS_CONFIG.endpoint` 改为 `/analytics/collect`。
   - `admin/dashboard.html`：看板 API endpoint 改为 `/dashboard/summary`。
5. 保持 `DASHBOARD_TOKEN` 只配置在 CloudBase 云函数环境变量中，不写入前端代码、文档示例或仓库。

真实浏览器验证清单：

- Chrome / Edge 打开正式域名首页，确认 HTML、JS、CSS、PNG 正常渲染，不下载。
- iPhone Safari、微信内置浏览器、Android Chrome 至少各完成一次打开验证。
- 完成一轮 24 题，确认 Network 中 `/analytics/collect` 返回 200，且请求 Origin 为正式域名。
- 触发 `analytics_rollup` 聚合目标上海自然日。
- 查询 `analytics_source_daily`，确认 `host = 正式域名`、`origin = https://正式域名`、`content_version = content-2026-06-10-gpti-scoring-calibration-a`。
- 看板按 `host = 正式域名` 与 `contentVersion = content-2026-06-10-gpti-scoring-calibration-a` 筛选，确认 summary、funnel、questions、results、share 均为同口径来源快照。
- 未带 token 访问 `/dashboard/summary` 仍返回 401；前端和仓库中不出现真实 token。

回滚方案：

- 用户入口回滚到 Vercel 预览别名，保持当前绝对 CloudBase endpoint。
- 撤回或暂停正式域名 DNS/CNAME 解析，不删除 CloudBase 聚合数据。
- 如已把前端 endpoint 改为同源路径，回滚 `index.html` 和 `admin/dashboard.html` 到绝对 CloudBase endpoint 后重新构建发布。
- 如新增了正式域名 CORS allowlist 或安全域名，可保留为待复测配置；如需删除，先确认没有正式流量。

## 5. 本地预览

在 `H5/demo` 目录运行：

```powershell
python -m http.server 5178
```

访问：

```text
http://localhost:5178/
```

不要直接双击 `index.html` 打开。ES Module 在 `file://` 下可能会因为浏览器安全策略加载失败。

注意：本地预览同样会加载当前 `GH_ANALYTICS_CONFIG.endpoint`，因此本地手测行为也会写入 CloudBase `analytics_events`。需要避免污染正式看板时，请使用 `?h5_channel=debug_local`、`?h5_channel=test_local` 等测试渠道；当前 `analytics_rollup` 默认排除 `e2e_*`、`debug_*`、`test_*` 渠道。

## 6. 多端兼容策略

### 6.1 当前布局策略

当前 demo 使用：

- 移动端优先。
- 页面最大宽度约 440px。
- PC 端居中显示为“手机 H5 画布”。
- 按钮高度、选项间距按手机点击设计。

这适合 H5 活动，因为主要传播场景是微信、QQ、小红书、朋友圈和移动浏览器。

### 6.2 PC 端要求

PC 端不需要重做成宽屏网站。建议保持：

- 中央手机画布。
- 两侧背景留白或氛围背景。
- 内容不拉宽，避免结果卡变散。

PC 验收：

- Chrome / Edge 能正常打开。
- 页面居中。
- 不出现横向滚动条。
- 结果卡文字不溢出。
- 按钮可点击。

### 6.3 移动端要求

重点测试：

- iPhone Safari。
- iPhone 微信内置浏览器。
- Android Chrome。
- Android 微信内置浏览器。
- QQ 内置浏览器。

移动端验收：

- 首屏标题和开始按钮完整露出。
- 答题选项不挤压。
- 24 题过程中页面不横向滚动。
- 返回上一题正常。
- 刷新后进度能恢复。
- 结果页大名和金句不溢出。
- 生成分享图弹层可打开和关闭。
- 保存图片可用，或能提示长按保存。
- 平台文案可复制。
- 复制测试链接保留当前 `h5_channel`。
- 复制分享文案可用。

## 7. 上线前检查清单

内容：

- 24 题题干无错字。
- 所有游戏人格结果文案无空字段。
- 结果文案没有攻击现实身份。
- 免责声明可见。
- 分享文案无错字。
- 用户可见页面、答题选项、分享图、平台文案、SEO/OG 中不直接出现 MBTI、16 型人格、INTJ/ENFP 或 ATRB/ATRC 等内部编码。
- 答题选项不展示关键词、pole 或内部 type code；关键词和 poles 仅进入答题数据结构与埋点 payload。

技术：

```powershell
node --test .\H5\demo\tests\*.test.mjs
npm --prefix .\H5\demo run build
```

必须全绿。

体验：

- 本地跑完整 24 题。
- 至少测出 3 个不同结果。
- 重新测试正常。
- 刷新恢复正常。
- 手机真机打开正常。
- 移动端 390x844 无横向滚动。
- PC 端 1280x720 手机画布居中。
- 跑完 24 题到结果页。
- 分享图弹层可打开和关闭。
- 平台文案复制可用。

传播：

- 链接标题正常。
- OG 封面图 `assets/og/cover.png` 可访问。
- 首发海报/二维码可扫。
- 分享文案能复制。
- 结果卡截图可读。

EdgeOne 正式域名上线时额外确认：

- 正式域名 HTTPS 证书有效，DNS 解析到 EdgeOne Pages 并已生效。
- `analytics_collect` 和 `dashboard_api` CORS allowlist 已包含 `https://gameplayti.icu`。
- 正式域名下 `/`、`/index.html`、`/src/app.mjs`、`/assets/og/cover.png`、`/admin/dashboard.html` 均能在真实浏览器正常打开。
- `/src/app.mjs`、`/admin/dashboard.mjs`、`/src/data/questions.mjs` 的无 query 请求返回 `Content-Type: application/javascript`。
- `Content-Disposition` 不应导致 HTML、JS、PNG 被浏览器下载。
- 前端当前仍使用 CloudBase 绝对 endpoint；除非完成同源路由设计和验证，不要改成 `/analytics/collect` 或 `/dashboard/summary`。
- 用正式域名完成一轮真实浏览器埋点 -> rollup -> 看板筛选验证，并明确标记上线前验证渠道不是正式运营数据。
- 当前 GPTI 第一版仍为 24 题，CloudBase rollup 漏斗节点 `1 / 8 / 16 / 24` 暂时保持不变；若后续题量变化或需要关键词热度、四轴分布、隐藏特质分布，需先单独确认看板口径。

## 8. 埋点与看板

当前已接入 CloudBase 埋点和数据看板：

- 采集入口：CloudBase 绝对 endpoint，前端配置在 `index.html` 的 `GH_ANALYTICS_CONFIG.endpoint`。
- 看板 API：CloudBase 绝对 endpoint，前端配置在 `admin/dashboard.html` 的 `GH_DASHBOARD_CONFIG.apiEndpoint`。
- 看板页面：EdgeOne 正式域名下的 `/admin/dashboard.html`。
- 看板 token 只应配置在 CloudBase 云函数环境变量 `DASHBOARD_TOKEN` 中，前端页面只提供输入框，不应写入仓库。

当前仓库的 Phase 5B 代码层支持按 `host` / `contentVersion` 筛选，读取的是 `analytics_source_daily` 来源看板快照，不是 `analytics_events` 明细表。有来源筛选时，核心指标、漏斗、题目、结果和分享明细均按同一来源/版本口径展示；无来源筛选时仍读取原 5 张 `date + channel` 聚合表。

注意：正式复盘应填写 `host = gameplayti.icu` 和当前 `contentVersion`，避免把 Vercel 预览、本地测试和正式域名数据混在一起。

当前 Vercel 预览产生的数据会以 `host = demo-phi-pearl.vercel.app`、`origin = https://demo-phi-pearl.vercel.app` 进入同一套 CloudBase 链路。`phase5a_browser_0522`、`phase5b_browser_YYYYMMDD` 等渠道只属于上线前验证数据，不作为真实运营数据解读。

EdgeOne 正式域名产生的数据会以 `host = gameplayti.icu`、`origin = https://gameplayti.icu` 进入同一套 CloudBase 链路。Vercel 继续作为预览/回滚入口，不与正式运营数据混用。

## 9. 后续正式版建议

如果要从 demo 升级成正式活动版，建议补：

- 分享图真实二维码或短链入口。
- 真实稀有度统计。
- 结果卡更多视觉资产。
- 如后续要从 EdgeOne Pages 切回 CloudBase 自定义域名，按第 5.2 节完成 HTTPS、CORS allowlist、安全域名、真实浏览器和看板同口径验证。
- CloudBase 默认域名 `content-disposition: attachment` 行为不再作为用户试玩入口方案，后续仅做技术排查。

## 10. 参考

EdgeOne Pages 官方文档：

- `edgeone.json` 配置详解：`https://pages.edgeone.ai/zh/document/edgeone-json`
- 缓存策略配置指南：`https://pages.edgeone.ai/zh/document/configuring-cache`

Context7 查询到的 Vercel 当前部署方式包括：

```bash
vercel deploy
vercel deploy --prod
```

也可通过 GitHub 导入项目，由 Vercel 自动部署。
