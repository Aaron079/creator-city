# Creator City Safe Development Boundaries

> Read this before starting any task. These rules define where work is safe and where it is not.

Last updated: 2026-05-25

---

## 最高规则 (Override Everything)

1. **只做增加，不做删改。** New code lives alongside old code. Do not refactor, rename, or delete stable code.
2. **只做 additive change。** Every change must be purely additive — no behavior of existing code changes.
3. **不重构稳定模块。** Even if the code looks messy, leave it. Refactoring a stable module is a separate, explicitly scoped task.
4. **不为了复用而改旧代码。** If a new page needs a utility, copy it or create a new one. Do not modify an existing utility to accommodate the new page.
5. **不删除旧入口。** Existing nav links, API routes, and component exports must not be removed.
6. **不改变旧行为。** If an existing function does X, it must still do X after your change.
7. **新页面先独立建，不接导航。** A new page is created as a standalone route with no nav link in the same commit.
8. **页面验收后，导航入口单独做一个任务。** Only after the page is confirmed working in production does a nav link get added — in a separate commit.
9. **非修复任务禁止碰 /create。** The canvas is off-limits for any task that is not a confirmed regression fix in /create.
10. **非生成修复任务禁止碰 generate route / cn-executor。** Generation routes and cn-executor are off-limits for any task that is not a confirmed generation regression.

---

## Task Classification

### A 类 — 最安全 (Safest)

Zero risk to production. These tasks can be done without a type-check gate if the author is confident, but type-check is still recommended.

| Type | Examples | Constraints |
|------|----------|-------------|
| docs only | Add/update docs/ files | Must not touch apps/, packages/, or config |
| New standalone static page | `/roadmap`, `/pricing-preview` | No nav link in same commit; no API calls; no DB; no generation |
| New standalone component directory | `components/roadmap/` | No imports from generate/canvas/proxy paths |
| Static data file | `data/roadmapItems.ts` | Pure TypeScript, no side effects |

**Gate:** `git diff --name-only` must show only the allowed paths. Type-check recommended.

---

### B 类 — 低风险 (Low Risk)

Safe if the constraints are strictly respected. Type-check required.

| Type | Examples | Constraints |
|------|----------|-------------|
| New read-only GET API | `/api/roadmap`, `/api/stats` | No DB writes; no generation triggers; no secret exposure; must not import from generate/canvas/proxy routes |
| New page that reads a B-class GET API | `/roadmap` with data from `/api/roadmap` | Page must be standalone; no nav link in same commit |

**Gate:** `git diff --name-only` must not include any frozen path. Full type-check + build required.

---

### C 类 — 中风险 (Medium Risk)

Must be a separate, isolated task. Requires the target page to already exist and be verified.

| Type | Examples | Constraints |
|------|----------|-------------|
| Adding a nav link to an existing page | Adding `/marketplace` to TopNavigation | Target `page.tsx` must already exist and be deployed; do not change existing nav behavior; single task, single commit |
| Updating nav link label | Changing "市场" to "创作者市场" | Must not reorder or remove existing links |

**Gate:**
1. Confirm target `page.tsx` exists: `ls apps/web/src/app/<route>/page.tsx`
2. `git diff --name-only` must not include any frozen path
3. Full type-check + build required
4. Post-deploy: manually verify existing nav links still work

---

### D 类 — 高风险，默认禁止 (High Risk — Blocked by Default)

These changes are blocked unless the user explicitly requests them, provides a justification, and the full regression checklist is run.

| Blocked action | Why |
|----------------|-----|
| Modify `/create` or canvas components | Generation chain + canvas save/load — any regression loses user data |
| Modify generate route (image or video) | Direct production income path |
| Modify status route (image or video) | Polling ceiling and stall detection protect against token drain |
| Modify canvas API | Save failure → data loss risk |
| Modify media proxy | Auth bypass risk; existing media visibility breaks |
| Modify auth/session helper | Session invalidation affects all users simultaneously |
| Modify provider fallback | Silent fallback failure → generation 503 for all users |
| Modify cn-executor | No hot reload; requires full Aliyun FC deployment |
| Delete any stable page | User-facing 404 |
| Remove any nav link | User-visible regression |

**If any D-class path appears in `git diff --name-only`:**
```
本任务越界，已停止，未提交。
```
Stop immediately. Do not self-fix. Do not commit. Report to user.

---

## The Nav Link Rule (Learned from Incident 2026-05-25)

> Adding a nav link without a backing page.tsx causes a production 404.

**Mandatory steps before adding a nav link:**
1. Verify `apps/web/src/app/<route>/page.tsx` exists
2. Verify the page is deployed and returns 200
3. Only then add the nav link — in a separate commit from the page

**Violation on record:** Commit `86447d4` added `/settings` to SettingsHoverMenu before creating the page → 404 in production.

---

## Forbidden File List

Never modify these files for any navigation, page, or docs task:

```
apps/web/src/components/create/CanvasNodeCard.tsx
apps/web/src/components/create/VisualCanvasWorkspace.tsx
apps/web/src/components/create/MediaLightbox.tsx
apps/web/src/app/create/*
apps/web/src/app/api/generate/image/route.ts
apps/web/src/app/api/generate/image/status/route.ts
apps/web/src/app/api/generate/video/route.ts
apps/web/src/app/api/generate/video/status/route.ts
apps/web/src/app/api/projects/*/canvas/*
apps/web/src/app/api/media/proxy/*
apps/cn-executor/**
```

And never modify:
```
package.json
pnpm-lock.yaml
next.config.*
vercel.json
.env*
```

---

## Diff Gate Protocol

Run before every commit:

```bash
git diff --name-only HEAD
git status --short
```

Scan every line. If any path matches the forbidden list for the current task class → **stop and do not commit**.

For a docs-only task, allowed paths are only:
```
docs/
```

For a new-page task (A/B class), allowed paths are:
```
apps/web/src/app/<new-route>/
apps/web/src/components/<new-component-dir>/
apps/web/src/app/api/<new-api-route>/    # B class only
```

---

## Commit Sequence

1. `git diff --name-only` — diff gate (must pass)
2. `pnpm --filter web type-check` — must pass
3. `pnpm --filter web build` — must pass
4. `git add <specific files>` — never `git add -A` without reviewing
5. `git commit -m "..."` — one change per commit
6. `git push origin main`
7. Confirm Vercel deployment completes
8. Browser acceptance steps (from `UI_ACCEPTANCE_CHECKLIST.md`)

---

## Related Documents

- `docs/LOCKED_STABLE_MODULES.md` — full list of frozen modules and their stable behaviors
- `docs/REGRESSION_CHECKLIST.md` — pre-commit and post-deploy verification steps
- `docs/CLAUDE_CODE_TASK_TEMPLATE.md` — copy-paste template for every new task
- `docs/GENERATION_PIPELINE_GUARDRAILS.md` — generation chain rules
- `docs/UI_ACCEPTANCE_CHECKLIST.md` — browser acceptance steps
