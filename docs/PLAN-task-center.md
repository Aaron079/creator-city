# Plan: Generation Task Center

**Goal:** Read-only `/tasks` page that displays recent image/video generation tasks from the DB. Zero changes to the generation chain.

**Pre-flight answers (7 questions):**
1. New files only; one link added to CanvasToolDock
2. No protected files touched
3. No payload changes
4. No auto-POST (single GET fetch on mount)
5. No polling (one-shot fetch, manual refresh only)
6. No node/edge clearing
7. type-check + build pass; generation routes untouched

---

## Steps

- [x] Read required docs (STABLE_BASELINE, GUARDRAILS, AI_AGENT_WORKFLOW_RULES, UI_ACCEPTANCE_CHECKLIST, memory)
- [x] Explore GenerationJob schema and existing query patterns
- [ ] Create `apps/web/src/app/api/generation-tasks/route.ts` — GET only, auth-gated, safe fields only
- [ ] Create `apps/web/src/app/tasks/page.tsx` — client page with fetch + filter + task cards
- [ ] Update `apps/web/src/components/create/CanvasToolDock.tsx` — add "生成任务" link
- [ ] `pnpm --filter web type-check` — must pass
- [ ] `pnpm --filter web build` — must pass
- [ ] `git add` specific files + commit + push
- [ ] Confirm Vercel production ready

## Files Changed

**New:**
- `apps/web/src/app/api/generation-tasks/route.ts`
- `apps/web/src/app/tasks/page.tsx`

**Modified (1 line):**
- `apps/web/src/components/create/CanvasToolDock.tsx`

## Security Constraints

- Auth required (getCurrentUser) — 401 if no session
- Filter by userId — only user's own jobs
- promptPreview = first 80 chars only
- No `input` field in response (may contain provider headers/keys)
- No `error` (raw) field
- No env/secret values
- No API keys

## Data Contract

GenerationJob fields available:
- id, nodeId, projectId, providerId, nodeType (image/video/text)
- status (QUEUED|RUNNING|SUCCEEDED|FAILED)
- prompt (truncated to 80 chars as promptPreview)
- output JSON: {stableUrl, resultImageUrl, resultVideoUrl, errorCode, errorStage, stageTrace, executorKind}
- errorMessage, completedAt, createdAt, updatedAt

## Definition of Done

- /tasks page loads with task list from DB
- Status chips work for queued/running/succeeded/failed
- Image tasks show thumbnail (img tag with stableUrl)
- Video tasks show small video player or link
- Failed tasks show errorCode + errorStage
- generationJobId copyable
- No POST /api/generate/image or /api/generate/video triggered
- type-check + build pass
- Pushed and Vercel production ready
