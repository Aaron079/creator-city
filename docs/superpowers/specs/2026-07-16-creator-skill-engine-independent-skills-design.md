# Creator Skill Engine 与独立画布 Skills 设计

日期：2026-07-16

状态：Founder 已批准总体方向，等待书面规格复核

## 1. 背景

Creator City 当前已经存在多种与 Skill 或 Agent 有关的实现：

- `apps/web/src/lib/skills` 保存 Creator Skill 描述和提示词约束。
- `apps/web/src/lib/ai/skills` 包装文本、图片和视频生成调用。
- `apps/server/src/modules/agent-runtime` 提供 Agent 任务接口，但当前执行仍是模拟流程。
- 画布摄影、灯光、提示词、风格、分镜拆格和标注工具各自直接挂接组件状态与回调。

这些能力缺少统一的输入、输出、版本、证据、幂等和组合协议。结果是工具可以打开，也能保存部分参数，但难以独立调用、互相复用或形成稳定的 Creator City 自有能力。

本设计将 `apps/web/src/lib/skills` 升级为唯一的 Creator Skill 核心。Creator City 自己负责理解、规划、检查、编排和结构化输出。外部 Provider 只在用户明确请求最终图片、视频或音频生成时介入。

## 2. 目标

1. 每个 Skill 可以从画布工具菜单独立调用。
2. 每个 Skill 可以由 Creator City Agent 独立调用。
3. 每个 Skill 有明确的输入、输出、版本、证据、警告和阻塞结果。
4. 核心 Skill 在无第三方 API 时仍可运行。
5. Skill 输出可以作为其他 Skill 的可选输入，但不得形成隐藏依赖。
6. Recipe 只负责编排独立 Skills，不拥有隐藏业务逻辑。
7. 相同输入、版本和配置产生相同结构化结果。
8. Skill 结果经用户审核后才能写入画布。
9. 来源节点保持不可变，重复应用不得静默创建重复节点。
10. 第一阶段不修改 Prisma Schema、Generate routes、Provider adapter、Billing 或环境变量。

## 3. 非目标

- 不在第一阶段部署自托管大模型或 GPU 服务。
- 不在第一阶段迁移所有旧工具。
- 不在第一阶段自动执行图片或视频生成。
- 不把 Skill 退化为一段 Prompt 模板。
- 不建设通用 DAG 编辑器、长期记忆系统或多 Agent 自主循环。
- 不允许 Recipe 绕过单个 Skill 的验证、审核和幂等规则。

## 4. 核心原则

### 4.1 独立调用

每个 Skill 必须声明自己接受的画布节点类型和 Artifact 类型。只要满足其中一个有效输入，Skill 就可以单独运行。

例如 `camera-direction` 可以直接分析 Text 节点。若输入中同时包含 `shot-plan` Artifact，则使用更完整的镜头上下文；缺少该 Artifact 时仍能运行。

### 4.2 确定性优先

规划、解析、规则判断、格式转换和连续性检查优先使用 Creator City 自有的确定性 TypeScript 引擎。

核心计算不得使用当前时间、随机数或网络结果。运行时间和画布节点 ID 可以在应用阶段产生，但不参与 Skill 指纹和分析结果。

### 4.3 人工审核

Skill 分为分析和应用两个阶段：

1. 分析阶段只生成内存中的结构化草稿。
2. 用户可以修改、删除、排序或批准结果。
3. 应用阶段才创建画布节点、边和 metadata。
4. 最终媒体生成必须由用户另行主动触发。

### 4.4 可解释结果

每条建议需要携带规则证据，例如来源文本片段、应用的规则 ID 和产生该建议的原因。不能输出伪造评分或无法解释的置信度。

## 5. 统一 Skill 协议

### 5.1 Manifest

```ts
type CreatorSkillExecutionPolicy =
  | 'deterministic-local'
  | 'self-hosted-optional'
  | 'external-media'

type CreatorSkillManifest = {
  id: string
  version: string
  name: string
  description: string
  category: CreatorSkillCategory
  executionPolicy: CreatorSkillExecutionPolicy
  acceptedNodeKinds: Array<'text' | 'image' | 'video'>
  acceptedArtifactTypes: string[]
  outputArtifactTypes: string[]
  independentlyCallable: true
}
```

第一批自有 Skills 固定使用 `deterministic-local`。`external-media` 仅用于以后显式封装媒体生成能力。

### 5.2 输入

```ts
type CreatorSkillRunInput = {
  sourceNodes: CreatorSkillSourceNode[]
  artifacts?: CreatorSkillArtifact[]
  projectContext?: CreatorSkillProjectContext
  options?: Record<string, unknown>
}
```

输入由运行器先进行归一化和验证。Skill 不直接读取全局 React 状态、localStorage、Cookie 或环境变量。

### 5.3 输出

```ts
type CreatorSkillRunResult = {
  skillId: string
  skillVersion: string
  runFingerprint: string
  status: 'ready' | 'needs-review' | 'blocked'
  artifacts: CreatorSkillArtifact[]
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
  blockers: CreatorSkillIssue[]
}
```

`blocked` 结果不得创建画布节点。`needs-review` 可以展示，但必须经过明确审核后才能应用。

### 5.4 Artifact

Artifact 是 Skills 之间唯一允许的结构化交接格式。V1 需要支持：

- `scene-breakdown`
- `narrative-beat-map`
- `shot-plan`
- `camera-direction`
- `lighting-direction`
- `continuity-report`
- `annotation-edit-brief`
- `storyboard-materialization-plan`

每个 Artifact 包含稳定 `artifactId`、类型、版本、来源节点 ID、来源 Artifact ID 和结构化 payload。

## 6. 独立 Skills

### 6.1 Script Segmentation

ID：`script-segmentation`

输入：Text 节点或文本 Artifact。

输出：`scene-breakdown`。

职责：

- 识别中文分场标题和 `INT/EXT` 格式。
- 提取地点、时间、人物、动作和对白。
- 无明确标题时按段落和叙事转换安全分段。
- 保留原始文本范围，便于证据回溯。

### 6.2 Narrative Beat Analysis

ID：`narrative-beat-analysis`

输入：Text 节点、`scene-breakdown` 或单个场景。

输出：`narrative-beat-map`。

职责：识别建立、目标、行动、反应、转折和收束等叙事节拍。无法确定时标记需要审核，不强行补写剧情。

### 6.3 Shot Planning

ID：`shot-planning`

输入：Text 节点、场景或节拍 Artifact。

输出：`shot-plan`。

职责：为每个节拍生成镜头目标、主体、动作、建议景别和顺序。默认不生成图片或视频。

### 6.4 Camera Direction

ID：`camera-direction`

输入：Text 节点、场景、节拍或镜头计划。

输出：`camera-direction`。

职责：复用现有摄影机数据库和镜头词典，给出机位、焦段、构图、景深和运镜建议。

### 6.5 Lighting Direction

ID：`lighting-direction`

输入：Text 节点、场景或镜头计划。

输出：`lighting-direction`。

职责：复用现有灯光规则，结合地点、时间和情绪产生光源、对比度、氛围和色彩方向。

### 6.6 Continuity Audit

ID：`continuity-audit`

输入：一个或多个画布节点以及任意相关 Artifact。

输出：`continuity-report`。

职责：检查人物、服装、道具、时间、空间、视线、动作方向和摄影连续性。

### 6.7 Annotation Edit Brief

ID：`annotation-edit-brief`

输入：带标注 metadata 的 Image 节点。

输出：`annotation-edit-brief`。

职责：将文字、箭头、形状和行动线转换为结构化修改指令。没有语义文字的形状只描述位置与类型，不猜测用户意图。

### 6.8 Storyboard Materialize

ID：`storyboard-materialize`

输入：已审核的场景、镜头、摄影和灯光 Artifacts。

输出：`storyboard-materialization-plan`。

职责：生成待应用的节点、边和 metadata 计划。真正写入画布仍由 UI 应用层执行。

## 7. Storyboard Director Recipe

Storyboard Director 是 Recipe，不是 Skill。默认步骤：

```text
script-segmentation
-> narrative-beat-analysis
-> shot-planning
-> camera-direction
-> lighting-direction
-> continuity-audit
-> storyboard-materialize
```

Recipe 必须支持：

- 执行完整流程。
- 从任意步骤开始。
- 跳过任何非必要步骤。
- 暂停并等待用户审核。
- 修改中间 Artifact 后继续。
- 只重跑某一个 Skill。
- 保留每一步的输入指纹和结果版本。

Recipe 不得包含单个 Skill 之外的业务规则。

## 8. 运行器与注册表

`apps/web/src/lib/skills` 成为规范来源：

```text
apps/web/src/lib/skills/
  types.ts
  registry.ts
  runtime.ts
  fingerprint.ts
  artifacts.ts
  script-segmentation/
  narrative-beat-analysis/
  shot-planning/
  camera-direction/
  lighting-direction/
  continuity-audit/
  annotation-edit-brief/
  storyboard-materialize/
```

注册表保存 Manifest 和执行器。运行器负责：

1. 查找 Skill 和版本。
2. 归一化输入。
3. 验证至少一个独立输入满足要求。
4. 计算稳定指纹。
5. 执行 Skill。
6. 验证 Artifact、证据和限制。
7. 返回统一结果。

现有 `apps/web/src/lib/ai/skills` 暂时保留为旧生成适配层。第一阶段不做大规模迁移或删除。

## 9. 画布集成

每个 Skill 可独立出现在节点工具菜单中。菜单根据 Manifest 和当前选择上下文判断是否可用。

第一阶段新增通用 Skill Panel 框架，负责：

- 显示 Skill 名称、版本和输入范围。
- 展示分析结果、证据、警告和阻塞项。
- 支持修改、删除、排序和批准结果。
- 支持独立重跑。
- 支持应用已批准结果。

画布 metadata 使用独立命名空间：

```ts
metadataJson.creatorSkill = {
  skillId,
  skillVersion,
  runFingerprint,
  sourceNodeIds,
  sourceArtifactIds,
  resultType,
  resultId,
  reviewStatus,
  evidence
}
```

来源节点保持不变。应用时先查找相同 `runFingerprint + resultId`，存在时提示复用、创建新版本或取消，不静默复制。

## 10. 限制与错误处理

- 单次 Script Segmentation 最多处理 40 个场景。
- 单次 Shot Planning 最多输出 120 个镜头。
- 输入为空、过短或结构无效时返回 `blocked`。
- 无法可靠判断时返回 `needs-review` 和具体原因。
- 项目或来源节点在审核期间发生变化时，旧结果不得应用。
- Skill 异常不得修改画布。
- Recipe 中单步失败时停止后续步骤，并保留已完成 Artifacts。
- 不输出无法解释的百分比、评分或伪置信度。
- 不发送 Generate、Provider、Billing、Credits、Wallet 或 Payment 请求。

## 11. 分阶段实施

### 阶段 A：Skill Engine 基础与独立样板

任务 ID：`P0-CANVAS-CREATOR-SKILL-ENGINE-V1`

范围：

- 统一协议、Artifact、注册表、运行器和指纹。
- 实现 `script-segmentation` 作为第一个独立 Skill。
- 提供通用只读分析面板和独立调用入口。
- 支持审核后创建场景 Text 节点。
- 完成保存、刷新恢复和幂等验证。

阶段 A 不实现完整 Storyboard Director Recipe。它先证明独立调用协议和画布应用闭环。

### 阶段 B：镜头规划

实现 `narrative-beat-analysis` 与 `shot-planning`，并支持独立调用和可选 Artifact 交接。

### 阶段 C：摄影与灯光迁移

将现有摄影机、镜头词典和灯光规则适配为 `camera-direction` 与 `lighting-direction`。现有 UI 能力保持兼容。

### 阶段 D：审核能力

实现 `continuity-audit` 与 `annotation-edit-brief`。

### 阶段 E：Recipe

实现 Storyboard Director Recipe 和 `storyboard-materialize`。Recipe 只组合已完成的独立 Skills。

## 12. 测试策略

### 12.1 运行器

- 重复 Skill ID 或版本注册失败。
- 不满足输入要求时返回阻塞结果。
- 相同输入产生相同指纹和结果。
- 节点顺序归一化后不产生无意义指纹变化。
- Artifact 类型和版本不匹配时拒绝执行。
- 执行异常不泄漏为画布修改。

### 12.2 Script Segmentation

- 中文剧本格式。
- 英文 `INT/EXT` 格式。
- 中英混合格式。
- 无场景标题的普通文本。
- 对白、动作、人物、地点和时间提取。
- 原文范围证据。
- 40 场上限。
- 空输入和无效输入。

### 12.3 画布

- Text 节点可以独立打开 Script Segmentation。
- 分析阶段不修改来源节点和画布。
- 只创建用户批准的场景节点。
- 来源边标签明确。
- 重复应用不产生重复节点。
- 手动保存、刷新和项目重开恢复 Skill metadata。
- 项目切换后不能应用旧结果。

### 12.4 边界

- Console 无新产品错误。
- Network 无 Generate、Provider 或支付请求。
- `pnpm type-check`、`pnpm lint`、`pnpm build` 和 targeted tests 通过。
- Production Chrome QA 通过后才关闭对应阶段。

## 13. 文件影响范围

阶段 A 预计允许修改：

- `apps/web/src/lib/skills/**`
- `apps/web/src/components/create/canvas/skills/**`
- `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- `apps/web/src/components/create/AssetAgentToolbar.tsx`
- `apps/web/src/components/create/canvas/modal/canvasModalTypes.ts`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- 对应的 focused tests
- `docs/CURRENT_STATUS.md`
- `docs/NEXT_TASKS.md`

禁止修改：

- Prisma Schema 和 migrations
- `/api/generate/image`
- `/api/generate/video`
- Provider adapter 和 BYOK 语义
- Billing、Credits、Wallet、Ledger 和 Payment
- cn-executor
- env 文件
- `package.json` 和 `pnpm-lock.yaml`
- `next.config.js`
- Production DB

## 14. 验收标准

阶段 A 完成时必须满足：

1. `script-segmentation` 可从 Text 节点工具菜单独立调用。
2. 同一个 Skill 可通过运行器以编程方式独立调用。
3. 无第三方 API 和 Provider 也能完成分析。
4. 输出包含版本、指纹、Artifact、证据、警告和阻塞项。
5. 用户可以审核并只创建批准的场景节点。
6. 来源节点不可变。
7. 重复运行和重复应用不会静默复制结果。
8. 保存与刷新恢复通过。
9. Console、Network 和禁区边界通过。
10. 不自动开始阶段 B。
