# Implementation Plan

- [x] 1. 建立 GPTI 常量与内容 schema
  - 新增 `src/data/gpti.mjs`，集中定义 `GPTI_POLES`、`GPTI_AXES`、`GPTI_TYPES`、`GPTI_KEYWORDS`。
  - 新增 `src/data/traits.mjs`，定义隐藏特质数据结构和第一批 3 到 5 个占位特质。
  - 保持用户端默认不展示内部 `ATRB` / `ATRC` 等 type code。
  - _Requirement: 1, 2, 4_

- [x] 2. 重写内容校验测试
  - 更新 `tests/content.test.mjs`，从旧 `EI/SN/TF/JP` 二选一结构切换到 GPTI 四选项结构。
  - 校验 24 题、每题 4 个选项、选项 id 唯一、关键词白名单、pole key 合法、pole 分值合法。
  - 校验 16 个 GPTI 标准结果完整，`bestPartners` / `nemesis` 引用存在。
  - 校验用户可见文案不暴露内部 type code，且短字段符合移动端和分享图长度 guardrails。
  - _Requirement: 1, 2, 5, 8_

- [x] 3. 改造 GPTI 评分逻辑
  - 重写 `src/scoring.mjs`，实现八极分累计、四轴 winner、tie-break、axis confidence、keyword counts、standard type 输出。
  - 实现隐藏特质匹配：`keyword_combo`、`single_pole_spike`、`dual_high_conflict`。
  - 确保隐藏特质只作为附加结果，不覆盖标准 16 型主结果。
  - _Requirement: 3, 4_

- [x] 4. 重写评分测试
  - 更新 `tests/scoring.test.mjs`，覆盖 pole 分累计、type 解析、tie-break、低置信轴、关键词计数。
  - 覆盖隐藏特质优先级、多规则命中、无隐藏特质时回退标准主结果。
  - 覆盖所有 16 个 GPTI type 至少各有一个可构造样例。
  - _Requirement: 3, 4, 8_

- [x] 5. 接入 GPTI 第一批题库与结果配置
  - 将 `src/data/questions.mjs` 改为 24 道 GPTI 四选项结构，第一批可使用短兜底文案完成基础接入，但用户可见页面不得出现工程占位提示。
  - 将 `src/data/results.mjs` 改为 16 个 GPTI 标准结果结构。
  - 保留 `image` / `avatar` 路径字段，切换到 GPTI type 文件名；美术资产未就绪时前端使用文字头像占位，不请求缺失图片。
  - 确认本阶段不接入未压缩的长人格分析到首屏。
  - _Requirement: 1, 2, 5_

- [x] 6. 更新答题 UI 为四选项流程
  - 修改 `src/app.mjs`，移除旧 5 档 `optionScores` 答题模型。
  - 渲染每题 4 个选项，选中后保存 `optionId`、`keywords`、`poles`。
  - 章节完成判断改为根据下一题章节变化，不再按每 6 题写死。
  - 保持上一题、下一题、继续测试、localStorage 恢复流程可用。
  - _Requirement: 2, 5_

- [x] 7. 更新结果页信息层级
  - 修改 `renderResultCard`，使用 GPTI 短字段：`name`、`identity`、`headline`、`tags`、`summary`。
  - 展示隐藏特质模块，但不替换主结果名。
  - 展示行为碎片、游戏行为罪状、隐藏天赋、致命弱点、适配队友和天敌队友。
  - 确保用户端不直接展示内部 type code。
  - _Requirement: 4, 5_

- [x] 8. 更新分享文案和分享图
  - 修改 `src/share.mjs`，使用 GPTI 结果短字段生成通用分享文案和平台文案。
  - 修改 Canvas 分享图，只展示结果名、身份、headline、3 个标签、隐藏特质或一条短罪状、CTA。
  - 确保分享图和下载文件名不暴露内部 type code。
  - 更新 `tests/share.test.mjs` 中相关断言。
  - _Requirement: 5_

- [x] 9. 更新 analytics payload
  - 修改 `question_answer` payload，加入 `option_id`、`keywords`、`poles`，移除或兼容旧 `score` / `dimension`。
  - 修改 `test_complete`、`result_view`、分享事件 payload，加入 GPTI 主结果和隐藏特质字段。
  - 更新 `tests/analytics.test.mjs` 中 GPTI payload 断言。
  - 不在本阶段修改 CloudBase rollup / dashboard 口径。
  - _Requirement: 6, 7, 8_

- [x] 10. 更新 contentVersion 与文档说明
  - 将 `index.html` 和 `src/app.mjs` 的内容版本切到新的 GPTI 版本，例如 `content-2026-05-23-gpti-a` 或实施当天版本。
  - 更新内容维护文档，说明 GPTI 结构与旧样稿结构不可混算。
  - 确认不会复用 `content-2026-05-21`。
  - _Requirement: 6_

- [x] 11. 更新样式和移动端承载
  - 修改 `src/styles.css`，适配四选项纵向布局、选中态、结果页隐藏特质模块、行为碎片列表。
  - 保持手机优先，确保长题干和四个选项不重叠、不遮挡。
  - 保持现有视觉方向，不新建营销落地页。
  - _Requirement: 5, 8_

- [x] 12. 回归测试和构建
  - 运行 `node --test .\tests\*.test.mjs`。
  - 运行 `npm run build`。
  - 检查 `dist/` 仍为 ignored 产物，不提交。
  - 检查敏感信息，确认没有 token、密钥或 dashboard 凭据进入前端或仓库。
  - 检查 git 状态，解释所有变更文件。
  - _Requirement: 8_

- [x] 13. 浏览器验证
  - 启动本地静态服务，检查首页、规则页、24 题四选项流程、章节反馈、生成页、结果页。
  - 检查移动端小屏和桌面窄屏下的题干、选项、结果卡、分享弹层。
  - 检查生成分享图不空白、文字不明显溢出、隐藏特质不覆盖主结果。
  - _Requirement: 5, 8_

- [ ] 14. CloudBase / dashboard 后续评估节点（第一阶段不执行）
  - 若第一版仍为 24 题，则 CloudBase rollup 漏斗可暂不改。
  - 若后续题量变化或需要关键词热度、四轴分布、隐藏特质分布，则新增单独 spec。
  - 修改 CloudBase 云函数、数据库集合、索引、权限、部署或 dashboard 口径前必须再次确认。
  - 当前 GPTI 回归测试仅补充 payload / aggregate 兼容覆盖，不改变线上统计口径。
  - _Requirement: 7_
