# AI Agent Workflow Rules

Rules for Claude Code and any AI agent working on the Creator City codebase.

## Before Starting Any Task

Answer these 7 questions:

1. **What exactly is being changed?** (file, function, line range)
2. **Does it touch a protected file?** (see GENERATION_PIPELINE_GUARDRAILS.md)
3. **Will it affect image or video generation payload?**
4. **Will it auto-POST on page load or refresh?**
5. **Does it introduce unbounded polling or loops?**
6. **Does it risk clearing nodes/edges/assets on failure?**
7. **How do I verify it works without breaking the stable chain?**

If any answer is "yes" or "unsure" for questions 2–6, stop and explain to the user before proceeding.

---

## Mandatory Checks Before Every Commit

```bash
cd /Users/aaron/creator-city

# Type-check only the web app (fast)
pnpm --filter web type-check

# Full build
pnpm --filter web build

# Lint (if time permits)
pnpm lint

# Confirm clean working tree
git status --short
git diff --stat
```

All checks must pass. A type error is a blocker — do not push with type errors.

---

## Mandatory Deploy Workflow (7 Steps)

Every code change must complete all 7 steps before reporting done:

```
Step 1: pnpm --filter web type-check  (must pass)
Step 2: git status --short            (confirm staged files)
Step 3: git add <specific files>      (never "git add -A" blindly)
Step 4: git commit -m "<message>"
Step 5: git log --oneline -5          (confirm commit landed)
Step 6: git push origin main
Step 7: Wait for Vercel Production Ready → confirm commit hash matches
```

**Do NOT tell the user "it's fixed" until Vercel Production shows the same commit hash as step 4.**

---

## New Feature Rules

Any new feature added to Creator City must:

1. **State its purpose before implementation:**
   - What problem does it solve?
   - What is the user-visible outcome?
   - Market/product value?

2. **Declare isolation:**
   - Is it behind a feature flag? (`FEATURE_FLAGS.xxx = false` by default)
   - Does it touch the image/video generation payload? (Must be NO)
   - Can it be disabled without code changes?

3. **Pass the generation chain test:**
   - After the change: image generation still works end-to-end
   - After the change: video generation still works end-to-end
   - No auto-POST on page load

4. **Have a rollback plan:**
   - What is the git revert command?
   - Does reverting leave any DB/OSS state that needs cleanup?

---

## Error Code Reference

| Error Code | Meaning | Stage |
|------------|---------|-------|
| `executor_not_started` | Job stuck QUEUED > 2 min — cn-executor never picked it up | executor_dispatch |
| `generation_job_stalled` | Job processing > 5 min — cn-executor hung | executor_processing |
| `generation_post_timeout` | Frontend POST timed out (> 70s image / 90s video) | client_post |
| `executor_trigger_timeout` | Backend trigger to cn-executor timed out (> 50s) | executor_trigger |
| `provider_timeout` | Volcengine API timed out | seedream_provider |
| `oss_upload_error` | Generic OSS failure | oss_upload |
| `oss_permission_error` | RAM user lacks PutObject | oss_upload |
| `oss_bucket_not_found` | Wrong bucket name in env | oss_upload |
| `oss_upload_timeout` | OSS TCP timeout | oss_upload |
| `generation_stopped_on_reload` | Stale active node downgraded on page load | client_reload |
| `client_duplicate_guard` | Second POST blocked (same node already generating) | client_guard |
| `provider_media_download_failed` | cn-executor could not download image from provider URL | provider_image_download |

---

## Things That Must Never Happen Again

| Incident | Prevention |
|----------|-----------|
| Job stuck QUEUED forever | Always `await` the cn-executor trigger fetch |
| False `provider_timeout` from frontend timeout | Frontend timeout must exceed backend timeout by ≥ 20s |
| Nodes wiped on canvas load | `applyCanvasSnapshot` never calls `setNodes([])`; save errors show toast only |
| Token drain from batch generation | 运行工作流 button removed; no batch POST allowed |
| Prompt pollution from tools | styleBible/skills never enter image/video payload |
| OSS permission error | Verify RAM user has `oss:PutObject` before deploying; use /debug/oss-write-probe |
| Auto-POST on refresh | `applyCanvasSnapshot` downgrades stale nodes; never resumes generation |
| cn-executor "deployed" but not actually | Always hit /health after upload and confirm version/timestamp |

---

## Canvas State Rules

```
nodes[].status transitions:
  idle → generating (on POST)
  generating → running (on queued/running response)
  running → idle (on poll success)
  running → error (on poll failure or timeout)
  [any active] → error with errorCode:generation_stopped_on_reload (on page load)

ACTIVE_GENERATION_STATUSES = ['generating', 'running', 'queued', 'pending', 'processing']
```

localStorage keys (never delete or rename):
- `creator-city-canvas-draft:<projectId>` — draft snapshot (survives save failure)
- `creator-city-canvas-snapshot:<projectId>` — last confirmed save
- `creator-city-canvas-cache:<projectId>` — optimistic cache

---

## cn-executor Deployment Checklist

Only needed when `apps/cn-executor/` changes:

```bash
# 1. Build
pnpm --filter cn-executor build

# 2. Package (zip must be < 256KB for CLI; use console upload if larger)
cd apps/cn-executor && zip -r /tmp/cn-executor-deploy.zip . -x "node_modules/*" "*.ts"

# 3. Upload via Aliyun FC Console
#    Function: creator-city-cn-executor (or reator-city-cn-executor — confirm name)
#    Runtime: Node.js 18+, Handler: dist/server.js

# 4. Verify
curl -H "Authorization: Bearer $CN_EXECUTOR_SECRET" https://<fc-endpoint>/health
curl -H "Authorization: Bearer $CN_EXECUTOR_SECRET" https://<fc-endpoint>/debug/oss-write-probe
```

**Function name must be consistent.** Past incidents caused by mismatched name:
- Aliyun FC console name
- `CN_EXECUTOR_BASE_URL` env var in Vercel
- Trigger URL in `/api/generate/image/route.ts`

All three must point to the same function endpoint.

---

## Evidence-Based UI Acceptance (Mandatory — Added 2026-05-25)

> Implementation is not acceptance.
> 代码实现完成 ≠ 功能完成。

### Rule

**AI cannot claim a UI/UX task is complete based on code alone.**

After every UI/UX change, the AI must:

1. **Provide browser verification steps** — numbered Step N / Expected format, specific enough for the user to follow and confirm within 2 minutes.
2. **Provide anti-regression checks** — explicit Network tab checks (no unexpected POSTs).
3. **Explicitly declare if browser testing was not performed** — write: "我无法真实浏览器验收，请用户按以下步骤验收。"

### Forbidden statements

❌ "已完成并验收通过" (without browser evidence)
❌ "type-check 通过所以功能正确"
❌ "代码逻辑正确所以视觉效果正确"

### Required in every UI task final report

```
## 浏览器验收步骤（用户自测）

Step 1: [具体操作]
Expected: [肉眼可见的结果]

Step 2: ...

## 反证检查
- Network → 无 POST /api/generate/image ✓
- Network → 无 POST /api/generate/video ✓
- 原节点未被清空 ✓

## AI 声明
我无法真实浏览器验收，以上步骤请用户在 /create 页面自行验证。
```

### Common failure modes to declare

| Feature | Common Trap | Correct Check |
|---------|-------------|---------------|
| Modal/Lightbox | z-index not above canvas | Must use z-[99999] + createPortal to body |
| Fixed overlay | Affected by parent transform | createPortal escapes canvas transform context |
| object-contain | No explicit width/height → no effect | Set `width + height + maxWidth + maxHeight` |
| ESC close | listener not cleaned up | useEffect cleanup removes listener on unmount |
| Video controls | Click-to-close breaks controls | stopPropagation on video element |

Full checklist: see `docs/UI_ACCEPTANCE_CHECKLIST.md`
