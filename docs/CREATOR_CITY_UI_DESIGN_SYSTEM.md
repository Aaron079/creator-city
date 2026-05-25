# Creator City UI Design System

> 本文档是 Claude Code / Codex 在做 Creator City UI、页面、导航、组件、dropdown、卡片、状态提示时**必须先读取**的设计规范。
> 目标：保持 Creator City 高级暗色影视创作平台气质，避免"美化"误改稳定模块。

Last updated: 2026-05-26

---

## 1. 核心视觉定位

Creator City **不是**普通 SaaS 后台，也不是游戏 UI。它是：

- AI 影视创作工作台（AI Director's Studio）
- 创作者城市（面向导演、制片、广告、短剧、MCN 团队）
- 专业级生产工具，用户对它的期望是"电影级 DCC 工具"，而不是"表格管理后台"

### 关键词

| 风格 | 反面 |
|---|---|
| cinematic dark | 普通后台灰白 |
| dark premium | 花哨霓虹游戏风 |
| glassmorphism（克制） | 过度透明混入内容 |
| subtle motion | 大量动画抢夺注意力 |
| professional creative tool | 功能堆砌 |
| calm sci-fi | 复杂控件层叠 |
| Apple-level clarity | 大段密集说明文字 |
| production-grade | 玩具感交互 |

### 禁止倾向

- 不要做成普通 SaaS 后台
- 不要做成花哨游戏 UI
- 不要堆满按钮和说明文字
- 不要每个模块都用高亮色强调
- 不要把 dropdown 做成巨大面板

---

## 2. 设计原则

1. **少即是多** — 每个页面先突出主目标，不堆功能。次要功能收起或弱化。
2. **信息分层** — 主操作、次操作、诊断信息要有明显视觉层级差异。
3. **旧链路不可为 UI 改坏** — 任何视觉优化不得破坏 /create 生成链路、canvas save/load、media proxy。
4. **新功能先独立页面验收，再接导航** — 页面存在并经生产验证后，才可添加导航入口。
5. **静态预览页不得伪装真实能力** — 所有预览页必须有明确的"静态预览"标识。
6. **Hover 菜单必须轻、清晰、可收起** — 参见第 7 节导航规范。
7. **错误提示必须给下一步** — 不允许只显示 errorCode，必须告知用户行动。
8. **生成中状态避免重复点击** — 生成按钮必须 disabled，配合视觉反馈。
9. **媒体预览优先显示已有 URL** — 不因代理失败或旧错误信息覆盖已保存视频/图片。
10. **UI 优化不得触发 API / POST / canvas save** — 视觉类改动不产生任何 side effect。

---

## 3. 色彩系统

> 以下为规范建议，不要求修改 Tailwind 配置，代码中直接使用等效 Tailwind class。

### 背景

| 用途 | 值 |
|---|---|
| Page background | `#05060A` / `#080A12` |
| Surface | `rgba(255,255,255,0.04)` / `white/[0.04]` |
| Elevated surface | `rgba(10,15,26,0.88)` / `bg-[#0a0f1a]/88` |
| Dropdown background | `rgba(0,0,0,0.90)` / `bg-black/90` 或 `bg-zinc-950/95` |
| Modal overlay | `rgba(0,0,0,0.72)` |

### 边框

| 用途 | 值 |
|---|---|
| Default border | `rgba(255,255,255,0.10)` / `border-white/10` |
| Hover border | `rgba(255,255,255,0.20)` / `border-white/20` |
| Active / brand border | `rgba(139,92,246,0.35)` / `border-violet-500/35` |
| Enterprise accent | `rgba(167,139,250,0.15)` / `border-violet-400/[0.15]` |
| Media preview border | `rgba(255,255,255,0.18)` / `border-white/[0.18]` |

### 文字

| 用途 | 值 |
|---|---|
| Primary | `#F8FAFC` / `text-white` |
| Secondary | `#CBD5E1` / `text-white/80` |
| Muted | `#94A3B8` / `text-white/55` |
| Caption | `#64748B` / `text-white/35` |
| Disabled | `text-white/25` |

### 品牌色

- 主品牌：violet / indigo 系（`violet-300` / `violet-400` / `indigo-400`）
- 不要用高饱和纯紫铺满整页，只作为 accent
- Creator City 标题 gradient：`text-gradient`（已有 class）

### 状态色

| 状态 | Tailwind |
|---|---|
| Success / Persisted | `text-emerald-300` / `border-emerald-500/30` |
| Warning | `text-amber-300` / `border-amber-500/30` |
| Error | `text-red-300` / `border-red-500/30` |
| Info | `text-cyan-300` / `border-cyan-500/30` |
| Generating | `text-blue-300` / 动画 |
| Frozen / Stable | `text-violet-300` / `border-violet-500/30` |
| Preview / Static | `text-slate-300` / `border-slate-500/30` |

---

## 4. 字体与排版

### 原则

- 中文为主界面语言，保留必要英文技术术语
- 标题大但克制，Hero 区域可以大，但不要每个 section 都做成 Hero
- 代码、ID、errorCode、路径使用 monospace 字体
- 不要大段密集文字，每块内容卡片化

### 推荐字号

| 层级 | 桌面 | 移动端 | Tailwind |
|---|---|---|---|
| Hero title | 44–72px | 32–44px | `text-6xl` / `text-5xl` |
| Section title | 24–36px | 20–28px | `text-3xl` / `text-2xl` |
| Card title | 15–18px | 14–16px | `text-lg` / `text-base` |
| Body | 13–15px | 13–14px | `text-sm` |
| Caption / chip | 11–12px | 11px | `text-[11px]` / `text-[12px]` |
| errorCode / ID | 11–12px mono | 11px | `font-mono text-[11px]` |

### 行高与间距

- 正文行高 1.6–1.8
- 标题行高 1.1–1.3
- section 之间间距 64–120px，不要每处都 padding-heavy

---

## 5. 布局系统

### 页面宽度

- 最大宽度：`max-w-5xl`（1040px）到 `max-w-7xl`（1280px）
- 导航栏：`max-w-7xl`（已有）
- 不要无限拉宽到满屏

### Hero 区域

- 首页 Hero 可占 40–60vh
- 内页 Hero 不超过 28–40vh
- Hero 背景使用暗色 + 微渐变，不要大图或高亮色铺满

### 卡片

- 圆角：`rounded-2xl`（16px）到 `rounded-[28px]`（28px）
- 间距：`gap-4`（16px）到 `gap-7`（28px）
- 背景：`bg-white/[0.04]` 或 `bg-white/[0.03]`
- 边框：`border-white/[0.08]` 或 `border-white/10`

### 网格

- 优先网格布局，不要整页纯文字
- 桌面 3–4 列，窄屏 1–2 列

### 滚动

- 权限矩阵、表格等宽内容加 `overflow-x-auto`
- 高 dropdown 加 `max-height` + `overflow-y-auto`
- 窄屏必须可读，不允许内容横向溢出

---

## 6. 按钮规范

### 按钮层级

| 层级 | 用途 | 样式 |
|---|---|---|
| Primary | 最重要动作（进入画布、开始生成） | `bg-violet-600 hover:bg-violet-500` |
| Secondary | 查看详情、工作空间 | `bg-white/[0.08] border-white/10` |
| Ghost | 返回、关闭、跳转 | `text-white/55 hover:text-white` |
| Danger | 停止生成、删除 | `border-red-500/30 text-red-300` |
| Disabled | 未开放、预览中 | `opacity-40 cursor-not-allowed` |

### 规则

- 同一页面不要超过 2 个 Primary 按钮
- 不要所有按钮都高亮强调
- 生成中的节点按钮必须 `disabled`，配合 spinner 或 loading bar
- 静态预览页 CTA（如"联系商务"）可以是普通按钮或 disabled，**不得**触发支付、订单、生成或数据库写入
- 按钮文案简洁，中文 4–8 字以内

---

## 7. 导航规范

### 顶部导航原则

- 不要继续往顶部导航堆 inline 按钮
- 相似功能入口放进 **Explore / 探索** hover 聚合菜单
- 企业能力、企业版菜单放进 **企业版预览** hover 菜单
- 设置类功能放入设置 hover 子菜单
- 高频画布操作才放左侧浮动工具栏（CanvasToolDock）

### 导航入口安全规则

- **导航入口必须先验收页面存在**，避免生产 404
- 没有 `page.tsx` 的路由不得加入生产导航
- 新页面与导航入口必须分两个独立 commit

### Hover Dropdown 行为规范

| 要求 | 说明 |
|---|---|
| hover 展开 | `onMouseEnter` 触发，clearTimeout 防止闪烁 |
| 移入菜单不消失 | dropdown 本身也绑定 `onMouseEnter` / `onMouseLeave` |
| 移出 120–180ms 后关闭 | `setTimeout(() => setOpen(false), 150)` |
| 不调用 API | 纯静态链接，无 fetch |
| 不写 DB | 无任何 DB 操作 |
| 不触发 POST | 无生成 POST |
| 不触发 canvas PUT/PATCH | 无画布保存 |

### Dropdown 视觉规范

```
背景:    bg-black/90 或 bg-zinc-950/95
模糊:    backdrop-blur-xl
边框:    border-white/[0.12] 或 border-violet-400/[0.15]
阴影:    boxShadow: '0 24px 80px rgba(0,0,0,0.65)'
轮廓:    ring-1 ring-white/[0.06] 或 ring-violet-400/[0.08]
宽度:    220–320px（不要超过 340px）
item 高: 30–42px（py-[7px] text-[12px]）
圆角:    rounded-2xl
z-index: z-[200]（盖住内容，不和页面混）
超高时:  max-height + overflow-y-auto
```

---

## 8. 卡片规范

### 卡片类型

| 类型 | 用途 |
|---|---|
| Project card | 项目列表、工作台 |
| Asset card | 资产库 |
| Task card | 任务中心、生成任务 |
| Provider card | API 中心 |
| Community card | 社区 |
| Enterprise card | 企业版预览 |
| Pricing card | 商业模式预览 |
| Error/Diagnosis card | 诊断帮助 |

### 卡片规则

- 每张卡片突出 1–2 个核心信息，其余弱化或折叠
- ID、状态、errorCode 使用小字 mono，不要和主标题同级
- 媒体卡片保持内容比例，不拉伸，使用 `object-contain`
- 已保存媒体显示 `已保存` badge（`text-emerald-300`）
- 预览中/规划中的能力卡片必须有明确 chip 标注，不伪装为可用

---

## 9. 状态 Chip 规范

### 标准状态列表

| 状态 | 文案 | 颜色 |
|---|---|---|
| 待生成 | 待生成 | slate |
| 排队中 | 排队中 | blue |
| 图片生成中 | 图片生成中 | blue + spinner |
| 视频生成中 | 视频生成中 | blue + spinner |
| 已生成 | 已生成 | emerald |
| 已保存 | 已保存 | emerald |
| 失败 | 失败 | red |
| 已停止 | 已停止 | amber |
| 静态预览 | 静态预览 | slate/violet |
| Mock / 示例 | 示例数据 | slate |
| Frozen / 稳定 | 稳定 | emerald/violet |
| 未配置 | 未配置 | amber |
| 可用 | 可用 | emerald |
| 规划中 | 规划中 | violet |
| 企业版预览 | 企业版预览 | violet |

### 规则

- 颜色映射必须稳定，不要随场景改变
- 图片和视频生成状态要**分别标注**，不要统一写"运行中"
- 失败状态的 chip 旁必须有"下一步"入口或说明
- Mock/示例数据的 chip 必须显眼，防止误以为真实数据

---

## 10. 媒体预览规范

### 核心原则

> 已有 videoUrl / stableUrl / resultVideoUrl / asset.url → 必须优先显示媒体，不允许被旧错误信息覆盖。

### 规则

| 场景 | 正确行为 |
|---|---|
| 有 resultVideoUrl，代理临时 401 | 显示"代理暂时无法加载，刷新恢复"，不要求重新生成 |
| 有 stableUrl，上次生成错误留在 lastGenerationError | 优先显示媒体，错误信息弱化为诊断 |
| 媒体加载失败 + 无任何 URL | 可显示 auth_required / 重新生成提示 |
| 代理返回 401 但 URL 仍有效 | `proxy_load_failed`，不显示"重新登录重新生成" |
| canvas save 失败 | toast 提示，**不清空节点**，**不清空媒体 URL** |

### 放大 / Lightbox 规范

- 双击图片/视频节点进入 Lightbox
- Lightbox 使用 `createPortal` 挂载到 `document.body`
- `z-index: z-[99999]`，盖住一切
- 图片使用 `object-contain`，不拉伸，需显式 `width` / `height`
- 视频播放器 controls 点击**不关闭 Lightbox**（事件 stopPropagation）
- 关闭 Lightbox 不触发任何 API / DB 写入 / canvas save

---

## 11. 错误与诊断规范

### 错误展示必须包含

1. `errorCode` — 机器可读代码
2. `errorStage` — 发生在哪个阶段（生成中、上传中、代理中）
3. 简明原因 — 人话说明
4. 用户下一步 — 刷新 / 重试 / 重新登录 / 联系支持
5. 是否需要重新生成 — 明确区分"临时失败"和"需要重新生成"
6. 是否会浪费 token — 如果重试会消耗额度，必须提示

### 错误层级

| 级别 | 示例 | 处理 |
|---|---|---|
| 可自动恢复 | proxy 临时 401、DB 短暂超时 | 刷新恢复，不提示重新生成 |
| 需用户干预 | session 过期 | 提示重新登录，不清空媒体 |
| 需要重新生成 | generation_failed + 无 URL | 提示重新生成，给出 prompt |
| 不可恢复 | provider_key_invalid | 提示配置问题，不让用户重试浪费 token |

### 禁止

- 只显示红字 errorCode，不给下一步
- 误导用户"重新生成"已保存媒体
- 因 canvas save 失败清空节点
- 因代理失败清空 mediaUrl
- 把 proxy_auth_required 当作"需要重新登录 + 重新生成"处理

---

## 12. 静态预览页规范

### 适用页面

- `/pricing-preview` — 商业模式预览
- `/terms-preview` — 协议与版权规则预览
- `/local-deploy-preview` — 本地部署预览
- `/enterprise-preview` — 企业版能力预览
- 后续 `/marketplace-preview` 等

### 强制规则

| 规则 | 说明 |
|---|---|
| 必须明确标注"静态预览" | Hero 下方或首个 section 有明确 disclaimer |
| 不调用任何 API | 无 fetch、无 GET/POST |
| 不写 DB | 无 Prisma 操作 |
| 不接支付 | 无支付 SDK、无支付按钮触发 |
| 不创建订单 | 无 POST /api/orders |
| 不触发生成 | 无 POST /api/generate/* |
| 不伪装真实上线能力 | 规划中的能力必须标注状态 chip |
| CTA 为静态 | disabled 按钮或普通内部链接，不触发任何 side effect |

### 文件结构规范

```
apps/web/src/
  app/<route>/page.tsx         — 路由入口（Server Component）
  components/<route>/          — 组件目录
    <Route>Page.tsx            — 主组件（Server Component）
    <route>Data.ts             — 纯静态数据（无副作用）
```

---

## 13. 安全开发边界

> 本节与 `docs/LOCKED_STABLE_MODULES.md` 和 `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` 重叠，但面向 UI 任务重点强调。

### UI 优化绝对禁止

| 禁止 | 原因 |
|---|---|
| 修改 `apps/web/src/app/api/generate/**` | 生成链路，改坏影响所有用户 |
| 修改 `apps/cn-executor/**` | 无热重载，需全量部署 |
| 修改 `apps/web/src/app/api/media/proxy/**` | 仅 P0 修复允许，UI 任务禁止 |
| 修改 canvas API | save/load 失败会丢失数据 |
| 修改 auth/session | 同时影响所有用户 |
| 修改 provider fallback | 生成静默失败 |
| 修改生成 payload 结构 | token drain 风险 |
| 重构稳定模块以复用代码 | 破坏已验证行为 |
| `git add -A` 不确认 diff | 意外提交敏感文件 |

### P0 修复与 UI 优化的区分

| 类型 | 条件 | 修改范围 |
|---|---|---|
| UI 优化 | 页面、导航、组件视觉 | 允许列表内新增或样式改动 |
| P0 修复 | 生产功能不可用（视频不显示、canvas 503、proxy 401） | 允许触及 proxy / canvas / session，但最小修改 |
| 生成修复 | 明确的生成失败 regression | 允许触及 generate route / cn-executor，需完整 regression checklist |

---

## 14. Claude/Codex 执行前清单

**每次 UI 任务开始前，必须回答以下 10 个问题：**

1. **任务类型** — 新增页面 / 视觉优化 / 导航接入 / P0 修复？
2. **允许修改哪些文件？** — 列出具体文件路径
3. **禁止修改哪些文件？** — 列出具体文件路径
4. **是否会触发 API 请求？** — 包括 GET / POST / PUT / PATCH / DELETE
5. **是否会触发 POST/PUT/PATCH？** — 生成、保存、canvas 写入
6. **是否会影响 /create？** — 画布、生成流程、canvas save
7. **是否会影响媒体显示？** — 图片/视频 URL、media proxy、Lightbox
8. **是否会影响生成链路？** — 生成 payload、provider、cn-executor
9. **是否需要真实浏览器验收？** — UI 改动必须浏览器验收
10. **是否本轮禁止 commit/push？** — diff 必须先确认

---

## 15. 提交前清单

**每次 commit 前必须按顺序执行：**

```bash
# 1. 检查改动范围
git status --short
git diff --stat
git diff --name-only

# 2. 确认没有禁止路径出现

# 3. 类型检查
pnpm --filter web type-check

# 4. 构建
pnpm --filter web build

# 5. Lint（如配置）
pnpm lint

# 6. 完整工作区检查
pnpm type-check
pnpm build

# 7. 确认后提交（具体文件，不要 git add -A）
git add <specific-files>
git commit -m "<message>"
git log --oneline -5
git push origin main
```

### diff gate 规则

| 任务类型 | 允许路径 |
|---|---|
| 纯 docs | `docs/` 内的新文件 |
| 新静态页面 | `apps/web/src/app/<route>/` + `apps/web/src/components/<route>/` |
| 导航入口（C 类） | `apps/web/src/components/layout/TopNavigation.tsx` 或对应 nav 文件 |
| P0 修复 | 最小范围，逐文件说明 |

**任何不在允许列表的路径出现在 `git diff --name-only` 中，立即停止：**

```
本任务越界，已停止，未提交。
```

---

## 16. 相关文档速查

| 文档 | 用途 |
|---|---|
| `docs/LOCKED_STABLE_MODULES.md` | 冻结模块完整列表 |
| `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` | 任务分类与边界规则 |
| `docs/REGRESSION_CHECKLIST.md` | 提交前 + 部署后验收清单 |
| `docs/CREATOR_CITY_STABLE_BASELINE.md` | 生成链路当前稳定基线 |
| `docs/GENERATION_PIPELINE_GUARDRAILS.md` | 生成链路守则 |
| `docs/UI_ACCEPTANCE_CHECKLIST.md` | UI 验收步骤 |
| `docs/CLAUDE_CODE_TASK_TEMPLATE.md` | 每次任务使用的模板 |
| `docs/AI_AGENT_WORKFLOW_RULES.md` | AI 代理执行工作流规则 |
