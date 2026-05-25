# Next Feature Safe Plan

> A phased roadmap for adding new functionality to Creator City without touching the stable generation chain or canvas. Each phase builds on the previous one. Do not skip phases.

Last updated: 2026-05-25

---

## Guiding Principle

**Additive only. One thing per commit. Page before nav link. Always run the regression checklist.**

Every phase below is designed so that if something breaks, the rollback is a single `git revert` with zero risk to the generation chain.

---

## Phase 1 — Documentation Foundation (current phase ✅)

**Goal:** Establish written contracts so future tasks have guardrails.

| Document | Status | Purpose |
|----------|--------|---------|
| `docs/LOCKED_STABLE_MODULES.md` | ✅ Done | Defines what cannot be touched |
| `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` | ✅ Done | Task classification and boundary rules |
| `docs/REGRESSION_CHECKLIST.md` | ✅ Done | Pre-commit and post-deploy verification |
| `docs/NEXT_FEATURE_SAFE_PLAN.md` | ✅ Done | This document |
| `docs/CLAUDE_CODE_TASK_TEMPLATE.md` | ✅ Done | Copy-paste task template |
| `docs/GENERATION_PIPELINE_GUARDRAILS.md` | ✅ Existing | Generation chain rules |
| `docs/UI_ACCEPTANCE_CHECKLIST.md` | ✅ Existing | Browser acceptance rules |

**Diff gate:** Only `docs/` files.
**No code changes allowed in Phase 1.**

---

## Phase 2 — Independent Static Pages (no nav link yet)

**Goal:** Build new pages as completely isolated routes. No nav links added in this phase.

Each page in this phase:
- Is a server component (no `'use client'` unless necessary for a self-contained UI widget)
- Has zero API calls to generate/canvas/proxy routes
- Has zero DB writes
- Has no `useEffect` that auto-fetches
- Imports only from its own component directory and safe shared utilities

### Recommended Phase 2 Pages

| Page | Route | Priority | Notes |
|------|-------|----------|-------|
| 路线图 | `/roadmap` | High | Static content, no API |
| 设计系统 | `/design-system` | Medium | Component showcase, static |
| 定价预览 | `/pricing-preview` | Medium | Static pricing tiers, all "即将开放" |
| 条款预览 | `/terms-preview` | Low | Static legal text |
| 市场预览增强 | `/marketplace` already live | — | Already done in Phase 0 |

**Per-page task structure:**
1. Create `apps/web/src/app/<route>/page.tsx` (server component)
2. Create `apps/web/src/components/<route>/` component directory if needed
3. Diff gate: only the new files appear
4. Type-check + build
5. Deploy and verify in browser
6. Do NOT add nav link in this commit

---

## Phase 3 — Nav Link Tasks (one per page, after page is verified)

**Goal:** Connect Phase 2 pages to navigation. Each nav link is its own commit.

**Rule:** A nav link task must not be started until:
1. The target page is deployed and returns 200
2. Browser verification is complete
3. The page has been live for at least one session without issues

**Allowed navigation touch points:**
- `apps/web/src/components/navigation/SettingsHoverMenu.tsx` — for settings-area links
- `apps/web/src/components/layout/TopNavigation.tsx` — for primary nav links
- `apps/web/src/app/<route>/layout.tsx` — for section-local navigation

**Per-nav-link task structure:**
1. Verify target `page.tsx` exists: `ls apps/web/src/app/<route>/page.tsx`
2. Add the single link to the navigation component
3. Diff gate: only the navigation file appears (no page files)
4. Type-check + build
5. Deploy and verify existing nav links still work
6. Verify new link routes correctly

---

## Phase 4 — Read-Only API Routes

**Goal:** Add new GET-only API routes that power Phase 2 pages with dynamic data.

**Constraints (strict):**
- Only `GET` — no `POST`, `PUT`, `DELETE`, `PATCH`
- No DB writes
- No generation triggers
- No secret values returned in response
- Must not import from `apps/web/src/app/api/generate/*`
- Must not import from `apps/web/src/app/api/projects/*/canvas/*`
- Must not import from `apps/web/src/app/api/media/proxy/*`
- Must not modify any existing route file

**Allowed:**
- Read from DB (Supabase) with read-only queries
- Return aggregated public stats
- Return cached/static data

**Per-route task structure:**
1. Create `apps/web/src/app/api/<new-route>/route.ts`
2. Diff gate: only the new route file appears
3. Type-check + build
4. Test with `curl` or browser before connecting to a page
5. Connect to page in a separate commit (or same commit if trivially safe)

---

## Phase 5 — Real Feature Integration

**Goal:** Add features that write to DB, trigger workflows, or connect to external services.

**All Phase 5 tasks require:**
1. Feature flag (default OFF) — no feature ships without a flag
2. Separate git branch — never develop on main
3. Rollback plan written before implementation starts
4. Human browser acceptance before flag is turned on
5. Monitoring/alerting plan (what goes wrong, how will you know)

**Phase 5 candidates:**
- 真实创作者服务发布 (creator service listings, writable)
- 项目委托系统 (project commission, DB writes + notifications)
- 团队协作 (team member management, real permissions)
- 计费与额度 (payment integration)
- 真实社区 (user posts, comments, moderation)

**Each Phase 5 feature is its own multi-session project. Do not combine.**

---

## Immediate Next Recommended Steps

In order of safety and impact:

### Step 1: `/roadmap` static page (Phase 2, A类)
- Create `apps/web/src/app/roadmap/page.tsx`
- Static server component, no API
- Feature cards with "Phase 1/2/3/4/5" structure matching this document
- TopNavigation included
- No nav link in this commit

### Step 2: `/design-system` static page (Phase 2, A类)
- Create `apps/web/src/app/design-system/page.tsx`
- Showcase color palette, typography, button variants, card styles
- All in inline styles (matches existing project conventions)
- No nav link in this commit

### Step 3: Nav link for `/roadmap` (Phase 3, C类)
- After `/roadmap` is verified live
- Add single link to `SettingsHoverMenu.tsx` MENU_ITEMS
- Separate commit from Step 1

### Step 4: `/pricing-preview` static page (Phase 2, A类)
- Static tiers: Free / Pro / Team / Enterprise (all "即将开放")
- No payment integration in Phase 2
- No nav link in this commit

### Step 5: First read-only API route (Phase 4, B类)
- `/api/platform/stats` — returns public counters (total projects, total generations)
- Read-only Supabase COUNT queries
- Used by a dashboard widget or stats page

---

## What Not to Do Next

| Temptation | Why it's unsafe |
|------------|----------------|
| Adding real user-facing forms | Phase 5 — needs feature flag and separate branch |
| Connecting to payment provider | Phase 5 — high risk, legal compliance required |
| Modifying /create for a new tool | D类 — blocked; must be a separate scoped fix task |
| Adding video generation options | D类 — frozen generation route |
| Refactoring TopNavigation | Risk of breaking all nav links simultaneously |
| Adding multiplayer/collaboration | Phase 5 — architectural change, needs separate branch |

---

## Related Documents

- `docs/LOCKED_STABLE_MODULES.md` — what is frozen
- `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` — task classification
- `docs/REGRESSION_CHECKLIST.md` — verification gate
- `docs/CLAUDE_CODE_TASK_TEMPLATE.md` — task template
