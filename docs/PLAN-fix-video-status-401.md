# Plan: Fix video/status 401 AUTH_REQUIRED

## Goal
Fix GET /api/generate/video/status returning 401 UNAUTHORIZED during polling.

## Root Cause
Both image/status and video/status have identical auth code.
`getCurrentUser()` → `getSession(token)` → `db.session.findUnique(...)`.
If the DB query fails (connection contention during 120s video polling window)
or the user's session cookie is absent, the route returns 401 before checking generationJobId.

## Approved Fix
Restructure video/status to check generationJobId BEFORE auth:
- If auth succeeds → full response + DB write (existing behaviour)
- If auth fails but generationJobId is valid and job exists → safe degraded response (no DB write)
- If auth fails and job not found → 404 GENERATION_JOB_NOT_FOUND

## Steps

- [x] Step 1: Audit code — compare image/status vs video/status, confirm frontend polling
- [ ] Step 2: Rewrite video/status GET to allow unauthenticated degraded lookup
- [ ] Step 3: Add video_status_auth_required to normalizeVisibleGenerateErrorCode pass-through
- [ ] Step 4: pnpm --filter web type-check && pnpm --filter web build
- [ ] Step 5: git commit && git push origin main
- [ ] Step 6: Wait for Vercel Production Ready

## Protected (do not touch)
- /api/generate/image — entire chain
- /api/generate/image/status
- cn-executor image path
- Canvas save/load
- localStorage draft
