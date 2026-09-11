# GPTI 新体系迁移需求

## 1. 背景

项目确认正式切换到 GPTI 玩家人格体系，主结果 key 已从早期技术样稿中的 `INTJ` / `ENFP` 等内部映射，迁移为 `ATRB` / `ATRC` / `ATWB` / `ATWC` 等 16 个 GPTI 标准类型。

当前文案仍在持续迭代，技术侧已经按第一版 GPTI 策略完成基础接入，并继续通过稳定的数据结构、评分规则、校验边界和 UI 承载要求，帮助文案同学在腾讯文档中按可接入格式补齐题库与结果文案。

本需求定义迁移目标和验收边界。后续若需要修改 CloudBase 配置、线上部署、数据库集合、索引、权限或 dashboard 统计口径，必须另行确认。

## 2. 范围

本轮规划覆盖：

- GPTI 四轴八极评分模型。
- 四选项题库数据结构。
- 标准 16 型主结果结构。
- 隐藏特质 / 稀有变体的附加判定边界。
- 内容输入模板与校验规则。
- 前端答题页、结果页、分享图的承载要求。
- analytics 与 dashboard 的兼容和后续演进要求。

本轮规划不覆盖：

- 直接接入未定稿长文作为正式上线内容。
- 在用户可见页面或分享图展示“GPTI 占位”“后续替换”“跑通技术链路”等工程提示。
- 直接改 CloudBase 云函数、CORS、安全域名、环境变量、数据库集合、索引、权限或正式域名配置。
- 新增线上部署、CloudBase 配置、数据库集合或索引。
- 使用线上用户分位数作为第一版隐藏特质判定规则。
- 无限扩展隐藏人格或用隐藏人格替代标准 16 型主结果。

## 3. 核心规则

### 3.1 标准类型

GPTI 标准类型由四组轴向组成：

| 轴 | 左极 | 右极 |
|---|---|---|
| 主动轴 | `A` 主动发起 | `P` 被动观察 |
| 行为轴 | `T` 行动任务 | `I` 交互关系 |
| 关注轴 | `R` 人物成长 | `W` 世界探索 |
| 风险轴 | `B` 冒险押注 | `C` 稳健控制 |

系统必须始终先生成一个标准 16 型主结果，例如 `ATRB`。隐藏特质只能作为附加信息，不应在第一版覆盖主结果。

### 3.2 题目结构

正式 GPTI 题库应使用四选项结构。每个选项包含：

- 用户可见选项文案。
- 关键词数组。
- 对八个极向的分值贡献。

题目数量可以由内容方案决定，但如果不再是 24 题，需要单独更新漏斗、测试和 dashboard 说明。

### 3.3 结果结构

16 个标准主结果必须完整，每个结果应包含短字段和长字段：

- 短字段用于 H5 结果页首屏和分享图。
- 长字段用于展开阅读或后续版本，不应直接挤入首屏和分享图。

### 3.4 隐藏特质

隐藏特质采用克制策略：

1. 标准 16 型始终存在。
2. 每次最多展示 1 个主隐藏特质。
3. 第一版只支持固定阈值和白名单组合。
4. 不使用“任意平局即隐藏人格”的规则。
5. 不依赖线上用户前 20% 分位数，等真实样本积累后再考虑校准。

推荐优先级：

```text
罕见关键词组合 > 单极突出 > 双高矛盾 > 低置信标记
```

低置信和平局默认只影响解释文案或稳定度，不触发独立隐藏人格。

## 4. 用户故事

### Story 1：文案同学继续写题

作为文案同学，我希望每道题都有固定字段模板，以便我在内容未完全定稿时也能知道哪些字段会被技术接入、哪些字段只是备注。

### Story 2：内容负责人确认体系

作为内容负责人，我希望所有标准 GPTI 类型都有完整字段和校验规则，以便正式接入前能确认 16 型没有遗漏、重复或明显展示风险。

### Story 3：开发侧低风险接入

作为开发维护者，我希望 GPTI 题库、结果、隐藏特质和版本号都有明确数据结构，以便后续实现时尽量修改配置和 scorer，而不是在页面层手工拼接文案。

### Story 4：运营侧分析新版数据

作为运营或数据查看者，我希望 GPTI 新版数据能通过新的 `contentVersion` 区分，以免旧 MBTI 样稿数据和新 GPTI 数据混在一起解释。

### Story 5：用户获得稳定结果

作为测试用户，我希望无论我的选择多矛盾，都能得到一个明确主结果，同时在确实存在稀有组合时看到有趣但不过度复杂的隐藏特质。

## 5. 验收标准

### Requirement 1：GPTI 类型覆盖

- When GPTI 内容进入开发接入时，the system shall require exactly 16 standard GPTI result keys unless a later confirmed spec changes the type count.
- When result data is validated, the system shall reject duplicate result keys or missing result keys.
- When a user completes all questions, the scoring system shall always resolve one standard GPTI type.

### Requirement 2：四选项题库结构

- When a GPTI question is configured, the question shall contain a stable `id`, `chapter`, `title`, and exactly four user-selectable options.
- When a GPTI option is configured, the option shall contain a stable `id`, non-empty `text`, a non-empty `keywords` array, and a non-empty `poles` score object.
- When a GPTI option is validated, the system shall reject keywords outside the approved keyword whitelist.
- When a GPTI option is validated, the system shall reject pole keys outside `A` / `P` / `T` / `I` / `R` / `W` / `B` / `C`.

### Requirement 3：标准评分

- When the user answers a question, the system shall add the selected option pole scores to the cumulative pole scores.
- When scoring is complete, the system shall compare `A` vs `P`, `T` vs `I`, `R` vs `W`, and `B` vs `C` to resolve the standard type.
- When a dimension is tied, the system shall apply a deterministic tie-break rule and mark the axis as low confidence.
- When a score report is generated, the system shall include standard type, pole scores, axis confidence, keyword counts, and optional hidden trait.

### Requirement 4：隐藏特质

- When hidden trait rules are evaluated, the system shall preserve the standard GPTI type as the primary result.
- When multiple hidden trait rules match, the system shall pick at most one primary hidden trait by explicit priority.
- When no hidden trait rule matches, the system shall render only the standard type result.
- When hidden trait rules are configured, each rule shall have a stable id, trigger condition, display name, short copy, and test fixture.

### Requirement 5：用户端展示

- When a GPTI result is rendered, the first screen shall prioritize result name, identity, headline, tags, and optional hidden trait.
- When long result copy exists, the UI shall place it in a secondary section or expandable area instead of forcing it into the first screen.
- When a share image is generated, the share image shall use short result fields and shall not include long analysis paragraphs.
- When user-visible copy is validated, the system shall not expose internal type codes such as `ATRB` / `ATRC`; admin dashboards and analytics payload may retain internal type codes for internal analysis.

### Requirement 6：内容版本

- When GPTI scoring or result structure changes, the project shall use a new `contentVersion`.
- When GPTI content is tested alongside existing sample content, analytics and dashboard analysis shall distinguish content versions.
- When a content version has produced preview or online data, that version id shall not be reused for different content.

### Requirement 7：analytics compatibility

- When a GPTI answer event is sent, the event payload shall include question id, option id, chapter, question index, selected option keywords, and pole scores.
- When GPTI answer events are generated by the current frontend, they shall not send legacy `dimension`, `score`, or `score_*` fields; those fields remain only in legacy fixtures and historical aggregates.
- When a GPTI completion event is sent, the event payload shall include result type, result name, confidence summary, and optional hidden trait id.
- When question count changes from 24, analytics rollup and dashboard funnel definitions shall be updated before interpreting completion funnel data.

### Requirement 8：testing and validation

- When GPTI schema is introduced, content tests shall validate question structure, keyword whitelist, pole scores, result completeness, field length, and user-visible copy safety.
- When GPTI scorer is introduced, scoring tests shall cover all four axes, tie-breaks, low-confidence axes, hidden trait priority, and standard type fallback.
- When UI is updated for four options, browser checks shall verify mobile layout, text wrapping, result page hierarchy, and share image readability.

## 6. 已确认结论与待确认项

已确认：

1. 第一版保持 24 题。
2. 用户端默认不展示 `ATRB` / `ATRC` 等内部 type code，只展示中文结果名、身份、标签和短解释。
3. 标准 16 型是唯一主结果。
4. 隐藏人格已收敛为“隐藏特质 / 稀有变体”，可在结果页附加展示，但不覆盖主结果。
5. 第一阶段保持 CloudBase rollup / dashboard 现有统计口径，不新增关键词热度、四轴分布或隐藏特质分布。
6. 当前内容版本为 `content-2026-05-23-gpti-a`；旧 `content-2026-05-21`、`dimension`、`score_*` 仅作为历史兼容口径。

仍待后续确认：

1. 正式文案是否替换当前第一批短文案，以及替换后的新 `contentVersion`。
2. 长人格分析是否进入 H5 展开区，还是只保留在内部文档和后续运营内容中。
3. 推荐作品和真实 IP 角色是否进入用户端，还是仅作为内部参考素材。
