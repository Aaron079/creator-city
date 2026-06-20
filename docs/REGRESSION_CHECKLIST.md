# Creator City Regression Checklist

> Run this checklist before every commit and after every production deployment.
> "Type-check passes" is not acceptance. Browser verification is required for any UI change.

Last updated: 2026-05-25

---

## 1. Pre-Commit: Code Gate

Run in `/Users/aaron/creator-city`:

```bash
# Check working tree
git status --short
git diff --name-only

# Verify only allowed paths appear in diff (see task boundaries)

# Type-check
pnpm --filter web type-check

# Build
pnpm --filter web build

# Lint (if configured)
pnpm lint

# Full workspace type-check
pnpm type-check

# Full workspace build
pnpm build
```

All commands must exit 0 before proceeding to commit.

---

## 2. Pre-Commit: Frozen Path Gate

Scan `git diff --name-only` output. **Verify none of the following appear** unless the task explicitly targets them:

```
apps/web/src/components/create/CanvasNodeCard.tsx
apps/web/src/components/create/VisualCanvasWorkspace.tsx
apps/web/src/components/create/MediaLightbox.tsx
apps/web/src/components/create/CanvasToolDock.tsx
apps/web/src/app/create/
apps/web/src/app/api/generate/image/route.ts
apps/web/src/app/api/generate/image/status/route.ts
apps/web/src/app/api/generate/video/route.ts
apps/web/src/app/api/generate/video/status/route.ts
apps/web/src/app/api/projects/*/canvas/
apps/web/src/app/api/media/proxy/
apps/cn-executor/
package.json
pnpm-lock.yaml
next.config.*
vercel.json
.env*
middleware.ts
apps/web/src/lib/auth/session.ts
```

If any of these appear unexpectedly:
```
本任务越界，已停止，未提交。
```

---

## 3. Commit Sequence

```bash
git add <specific files — never git add -A blindly>
git status --short              # confirm staged set is correct
git commit -m "<message>"
git log --oneline -5            # confirm commit appears
git push origin main
git status --short              # should be empty
```

---

## 4. Post-Deploy: Vercel

- Confirm Vercel Production deployment completes without error
- Check build log for any route compilation errors
- Confirm deployment URL matches expected branch

---

## 5. Browser: Frozen Pages Must Not Regress

Open each page and confirm no 404, 500, or visible breakage:

| Page | URL | Check |
|------|-----|-------|
| 创作画布 | `/create` | Opens, nodes visible |
| Legacy redirect | `/create-v2` | Immediately redirects to `/create` (no canvas renders) |
| 工作台 | `/dashboard` | Opens, no error |
| 工作空间 | `/projects` | Opens, no error |
| 资产库 | `/assets` | Opens, no error |
| 任务中心 | `/tasks` | Opens, no error |
| API 中心 | `/providers` | Opens, no error |
| 诊断帮助 | `/help` | Opens, no error |
| 设置中心 | `/settings` | Opens, no error |
| 社区 | `/community` | Opens, no error |
| 创作者市场 | `/marketplace` | Opens, no error |
| 账号 | `/account` | Opens, no error |

---

## 6. Browser: Canvas Stability (run after any change near canvas)

Open `/create` with an existing project that has image and video nodes.

### 6a. Display checks
- [ ] Existing image node shows image (not spinner, not error)
- [ ] Existing video node shows video (not spinner, not error)
- [ ] Double-click image node → lightbox opens, image fills frame (`object-contain`)
- [ ] Double-click video node → lightbox opens, video plays
- [ ] Lightbox closes on Escape or click-outside

### 6b. Persistence checks
- [ ] Hard-refresh (`Cmd+Shift+R`) → image/video nodes still visible after reload
- [ ] Canvas loads from DB (check Network tab for GET canvas API returning 200)
- [ ] If DB returns 503 → canvas loads from localStorage draft (nodes not cleared)

### 6c. Network anti-regression (open Network tab, filter to `api/generate`)
- [ ] Page load → no automatic POST to `/api/generate/image`
- [ ] Page load → no automatic POST to `/api/generate/video`
- [ ] Idle canvas → no continuous PUT/PATCH to canvas save

### 6d. Generation checks (if generation was touched)
- [ ] Image: type prompt → click Generate → node enters generating state → image appears
- [ ] Video: type prompt → click Generate → node enters generating state → video appears
- [ ] `generationJobId` present in Network request body
- [ ] Status polling stops within 12 polls (image) / 24 polls (video)
- [ ] OSS URL is accessible (image/video loads without CORS error)
- [ ] Media proxy does not return 401 (session must be valid)

### 6e. Error display checks
- [ ] `errorCode`, `errorStage`, `stageTrace` visible in node on error
- [ ] `auth_required` error → "刷新页面并重新登录" message displayed

---

## 7. Browser: Generation Payload Verification

Open Network tab. Trigger image generation. Inspect POST body to `/api/generate/image`:

**Must be present:**
- `prompt`
- `providerId`
- `aspectRatio`
- `projectId`
- `workflowId`
- `nodeId`

**Must NOT be present:**
- `compiledPrompt`
- `system`
- `inputAssets`
- `styleBible`
- `sceneBible`
- `characterBible`
- `skills`
- `enabledCreatorSkills`
- `storyboard`
- `casting`

Repeat for `/api/generate/video` with `duration` added to the must-be-present list.

---

## 8. Auth / Session Check

```bash
# Check if session is valid (expect authenticated: true)
curl -b <cookie> https://<domain>/api/auth/me
```

- `authenticated: true` → session valid
- `authenticated: false` → session expired; user must log out and back in
- Media proxy 401 is expected and correct when session is expired

---

## 9. cn-executor Health (only if cn-executor was changed)

```bash
# After uploading new zip to Aliyun FC:
curl https://<cn-executor-url>/health
# Expect: {"status":"ok"}
```

Do not mark a cn-executor change as deployed until this returns `{"status":"ok"}`.

---

## 10. Incident Response

If a regression is found after deploy:

1. Identify the commit that introduced it with `git log --oneline`
2. Check if it touches a frozen path — if yes, that is the root cause
3. Revert to last known good: `git revert <bad-commit>` (do NOT `git reset --hard`)
4. Push the revert commit
5. Confirm Vercel redeploys
6. Run full browser regression checklist
7. Document the incident in `docs/` with root cause analysis

---

## Related Documents

- `docs/LOCKED_STABLE_MODULES.md` — which modules are frozen
- `docs/SAFE_DEVELOPMENT_BOUNDARIES.md` — task classification and boundary rules
- `docs/GENERATION_PIPELINE_GUARDRAILS.md` — generation chain technical rules
- `docs/UI_ACCEPTANCE_CHECKLIST.md` — detailed UI acceptance steps
- `docs/CLAUDE_CODE_TASK_TEMPLATE.md` — task template with pre-baked checklist invocations
