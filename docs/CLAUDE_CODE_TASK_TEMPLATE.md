# Claude Code Safe Task Template

> Copy this template for every new task you give to Claude Code. Fill in the bracketed sections. Remove the sections that don't apply to your task type.

Last updated: 2026-05-25

---

## Template

```
任务：[一句话描述任务目标]

项目路径：
/Users/aaron/creator-city

## 1. 任务目标

[详细描述要做什么，以及为什么要做。]

## 2. 任务类型

[ ] A类 — docs only / 独立静态页面
[ ] B类 — 新增只读 API / 新增读取只读 API 的页面
[ ] C类 — 新增导航入口（目标页面必须已存在且已验收）
[ ] D类 — 修复生成链路回归（必须用户明确指定）

## 3. 允许修改路径

本任务只允许修改以下路径（列出所有允许的文件/目录）：

- [允许的文件或目录 1]
- [允许的文件或目录 2]
- ...

## 4. 禁止修改路径（冻结模块）

以下路径本任务绝对不允许修改：

- apps/web/src/components/create/CanvasNodeCard.tsx
- apps/web/src/components/create/VisualCanvasWorkspace.tsx
- apps/web/src/components/create/MediaLightbox.tsx
- apps/web/src/app/create/
- apps/web/src/app/api/generate/image/route.ts
- apps/web/src/app/api/generate/image/status/route.ts
- apps/web/src/app/api/generate/video/route.ts
- apps/web/src/app/api/generate/video/status/route.ts
- apps/web/src/app/api/projects/*/canvas/
- apps/web/src/app/api/media/proxy/
- apps/cn-executor/
- apps/web/src/lib/auth/session.ts
- middleware.ts
- package.json
- pnpm-lock.yaml
- next.config.*
- vercel.json
- .env*

[根据任务类型追加其他禁止路径]

## 5. 越界停止规则

如果 git diff --name-only 出现允许列表以外的路径，立即停止，输出：

"本任务越界，已停止，未提交。"

不得自行修复，不得继续提交。必须向用户报告越界路径。

## 6. 探索命令（执行前先运行）

cd /Users/aaron/creator-city && \
git status --short && \
git log --oneline -5 && \
ls docs/ && \
[根据任务追加其他探索命令]

报告：
1. 工作区是否干净
2. 最近 5 个 commit
3. docs 目录已有文件
4. [其他需要报告的内容]

## 7. 实施要求

[列出具体的实施步骤和内容要求。例如：]

- 文件必须是 server component（无 'use client'，除非有明确原因）
- 不调用任何 generate / canvas / proxy API
- 不写入 DB
- 不暴露 secret
- 所有 CTA 按钮默认 disabled / 即将开放
- 使用 inline styles（与项目现有风格一致）
- 包含 TopNavigation
- 包含 export const metadata

[根据任务调整]

## 8. 测试命令

cd /Users/aaron/creator-city && \
pnpm --filter web type-check && \
pnpm --filter web build

[如果改了 cn-executor 追加：]
pnpm --filter cn-executor build

全部必须通过，退出码为 0。

## 9. Diff 检查命令（提交前必须执行）

cd /Users/aaron/creator-city && \
git diff --name-only && \
git status --short

确认只出现以下路径（根据任务填写）：

- [允许路径 1]
- [允许路径 2]

如果出现任何其他路径：立即停止，输出越界提示，不提交。

## 10. 提交命令

cd /Users/aaron/creator-city && \
git add [具体文件列表，不使用 git add -A] && \
git status --short && \
git commit -m "[commit message]" && \
git log --oneline -5 && \
git push origin main

## 11. 最终报告清单

提交后必须报告以下所有项：

1. 新增/修改了哪些文件
2. 是否只修改了允许路径
3. 是否未修改冻结模块
4. 是否未修改 /create
5. 是否未修改 generate route
6. 是否未修改 canvas API
7. 是否未修改 media proxy
8. 是否未修改 cn-executor
9. 是否未修改导航（如果本任务不包含导航）
10. type-check 结果
11. build 结果
12. git diff --name-only 结果（只列出修改路径）
13. 最新 commit hash
14. push 是否成功
15. git status --short 是否为空
16. 浏览器验收步骤（逐步列出，格式见下）

浏览器验收步骤格式：

Step 1: [操作]
Expected: [肉眼可见结果]

Step 2: [操作]
Expected: [肉眼可见结果]

...

声明（必须包含）：
"我无法真实浏览器验收，请用户按以上步骤验收。"
```

---

## 快速参考：任务类型判断

| 我要做什么 | 任务类型 | 需要用户确认？ |
|-----------|----------|--------------|
| 只改 docs/ | A类 | 否 |
| 新建静态页面，不加导航 | A类 | 否 |
| 新建只读 GET API | B类 | 否 |
| 新建页面读取只读 API | B类 | 否 |
| 给已存在的页面加导航入口 | C类 | 需确认目标页面已部署 |
| 修改 /create 相关文件 | D类 | **必须用户明确要求** |
| 修改 generate/status route | D类 | **必须用户明确要求** |
| 修改 canvas API | D类 | **必须用户明确要求** |
| 修改 media proxy | D类 | **必须用户明确要求** |
| 修改 cn-executor | D类 | **必须用户明确要求 + 部署验证** |

---

## 快速参考：C类导航任务前置核验

在开始 C类任务之前，必须先运行：

```bash
# 1. 目标页面是否存在
ls apps/web/src/app/<route>/page.tsx

# 2. 最近是否有改过导航文件（排查冲突）
git log --oneline -10 -- apps/web/src/components/navigation/ \
                        apps/web/src/components/layout/TopNavigation.tsx
```

如果目标 page.tsx 不存在：**停止，先建页面，后加导航。**

---

## 快速参考：常见越界模式

这些是过去出现过的越界问题，写在这里供参考：

| 越界行为 | 触发原因 | 后果 |
|---------|---------|------|
| 加了 nav link，没建 page.tsx | 忘记检查 | 生产 404（Incident 2026-05-25, commit 86447d4）|
| 改了 TopNavigation，顺手重排了 LINKS | 想顺便整理 | 可能破坏 /create 链接的 active state |
| 新页面 import 了 canvas 工具函数 | 想复用 | 把 canvas 变成了被依赖项，改 canvas 影响新页面 |
| 调试时临时加了 console.log 到 generate route | 想看日志 | 修改了冻结文件，diff 越界 |
| 新增 API route 时在同一文件夹新建了 index.ts | 想加导出 | 改了已有 API 目录结构 |

---

## 相关文档

- `docs/LOCKED_STABLE_MODULES.md` — 冻结模块完整列表
- `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` — 任务分级和边界规则
- `docs/REGRESSION_CHECKLIST.md` — 回归验收清单
- `docs/NEXT_FEATURE_SAFE_PLAN.md` — 后续功能安全路线图
- `docs/GENERATION_PIPELINE_GUARDRAILS.md` — 生成链路技术守则
- `docs/UI_ACCEPTANCE_CHECKLIST.md` — 浏览器验收守则
