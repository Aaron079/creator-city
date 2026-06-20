# Creator City — User Data Isolation Policy

## Overview

Creator City stores per-user project/canvas data in the browser's `localStorage` for performance (offline draft protection, fast project resume). This document defines the isolation rules that prevent cross-account data leakage.

---

## API Layer (already correct — do not regress)

All project and canvas data APIs enforce ownership at the database level:

| API | Guard |
|-----|-------|
| `GET /api/projects` | `WHERE ownerId = currentUser.id` |
| `GET /api/projects/[id]/canvas` | `requireProjectAccess(projectId, userId)` — non-owner/member → 403 |
| `GET /api/credits/balance` | `getOrCreateWallet(currentUser.id)` |
| `POST /api/credits/manual-recharge` | order attributed to `currentUser.id` |
| `GET /api/auth/me` | session cookie → DB session → returns only current user |
| `GET /api/assets` | `WHERE ownerId = currentUser.id` |
| `GET /api/generation-tasks` | `WHERE userId = currentUser.id` |

**Rule**: never remove or bypass ownership guards in these routes.

---

## Frontend localStorage Rules

### On Logout — must clear all user-scoped keys

The helper `clearUserScopedLocalState()` in `lib/client-storage/clearUserLocalState.ts` removes:

**Exact keys:**
- `creator-city:last-project-id` — last opened project
- `creator-city:last-workflow-id` — last opened workflow
- `creator-city:projects-cache` — project list cache
- `creator-city:last-auth-user-id` — userId sentinel for cross-account detection

**Prefix-matched keys (clears all projectIds):**
- `creator-city-canvas-draft:<projectId>`
- `creator-city:draft:<projectId>` (legacy)
- `creator-city:canvas-cache:<projectId>`
- `creator-city:canvas-snapshot:<projectId>`
- `creator-city:style-bible:<projectId>`
- `creator-city:enabled-skills:<projectId>`
- `creator-city:canvas-comments-cache:<projectId>`
- `creator-city:canvas-comments-pending:<projectId>`
- `creator-city:storyboard:director:<projectId>`
- `creator-city:scene-bible:<projectId>`
- `creator-city:character-bible:<projectId>`

`handleLogout` in `TopNavigation.tsx` calls this after `clientLogout()` and `logout()`.

### userId change on login — `AuthProvider` sentinel guard

`AuthProvider.tsx` stores `creator-city:last-auth-user-id` in localStorage.

On every app mount, when `/api/auth/me` returns a user:
1. The provider reads `last-auth-user-id` from localStorage.
2. If a previous userId exists and **differs** from the current user's id, `clearUserScopedLocalState()` is called before hydrating the new user's state.
3. `last-auth-user-id` is then written with the current user's id.

This covers the case where User A's session expired (or the browser was closed) without an explicit logout — the new user's first app load will wipe all stale keys from User A's session.

### Canvas entry points — must NOT read `last-project-id`

All canvas entry points navigate to `/create` **without a projectId**. The canvas calls `/api/projects/ensure` which always returns the current user's own project.

The following entry points were previously reading `last-project-id` from localStorage and are now fixed:

| Entry point | File | Fix applied |
|-------------|------|-------------|
| Home CTA button | `HomeLanding.tsx` | Always pushes `/create` |
| Nav "AI 画布" | `TopNavigation.tsx` `handleCreateClick` | Always pushes `/create` |
| Canvas init no-projectId branch | `VisualCanvasWorkspace.tsx` | Removed `last-project-id` fallback |

**Rule**: Never add `last-project-id` reads to navigation entry points. The `last-project-id` key is only written (by canvas on successful load) and cleared (on logout and userId change). It is intentionally never read at entry — `/api/projects/ensure` is the safe path.

### Canvas init — no `last-project-id` fallback

When `/create` is opened without a `?projectId=` query param, the canvas **must not** fall back to reading `last-project-id` from localStorage. It proceeds directly to `POST /api/projects/ensure` which returns the current user's own project.

Previous behavior (removed): if `resolvedProjectId` was empty, the canvas read `last-project-id` from localStorage and redirected to that project URL. This was the primary vector for cross-account 403 errors after account switching.

### Cross-account project navigation — prohibited

`creator-city:last-project-id` must be cleared on logout so a newly logged-in user is never silently redirected to a previous user's project URL. Clearing this key at logout (and on userId change) breaks the navigation chain before the canvas API's 403 guard is even reached.

### 401 response — never show local draft

If the canvas API returns 401 (session invalid), the canvas must NOT display local draft data. The session is unverified — the local draft may belong to a different user who was previously logged in. The correct behavior is to clear the project pointer and show an "please re-login" error.

File: `VisualCanvasWorkspace.tsx` 401 handler — `hasHydratedCanvasRef.current = false`, no `local-draft` status.

### 403 / PROJECT_NOT_FOUND response — must clear project-scoped draft and canvas state

If the canvas API returns 403 (FORBIDDEN) or PROJECT_NOT_FOUND, the canvas:
1. Calls `clearProjectScopedLocalState(resolvedProjectId)` — removes all per-project localStorage keys for that projectId.
2. Removes `creator-city:last-project-id` if it still points to this project.
3. Calls `commitNodes([])` and `commitEdges([])` to immediately clear all visible canvas state.
4. Resets `hasHydratedCanvasRef.current = false` and `isInitializingRef.current = false`.
5. Redirects to `/create`.

Without step 1, a stale canvas draft for another user's project persists in localStorage and leaks on every subsequent visit to that project URL.

Without steps 3–4, stale nodes from the previous account remain visible in the canvas during the brief window before the redirect completes.

The per-project helper `clearProjectScopedLocalState(projectId)` in `lib/client-storage/clearUserLocalState.ts` handles this targeted cleanup.

### Canvas draft — must not render before authorization

`VisualCanvasWorkspace.tsx` must NOT apply a local canvas snapshot to the UI before the `/api/projects/[id]/canvas` call returns HTTP 200.

Previous versions called `readBestLocalCanvasSnapshot()` and applied the result via `applyCanvasSnapshot()` before the API response arrived. This caused User A's draft to briefly flash on screen for User B when B navigated to A's project URL (before the subsequent 403 triggered a redirect).

Current behavior: `readBestLocalCanvasSnapshot()` is called to capture `localPreview` (used only for the server/local merge decision on 200 success), but `applyCanvasSnapshot()` is NOT called until after the API returns 200 and authorization is confirmed.

### Projects cache — not user-scoped

`creator-city:projects-cache` holds the last API response from `/api/projects`. It is NOT keyed by userId. Therefore:
- Never pre-populate the projects page UI from this cache — doing so shows the previous user's project list briefly on login.
- The cache may still be written for prefetching purposes, but must be cleared on logout.

---

## `attachCurrentUserProjectMemberWithEvidence` — pending server-side audit

**Location:** `apps/web/src/app/api/projects/[projectId]/canvas/route.ts`

This function is called when a user tries to access a project they don't own. It checks whether the user has an asset or generation job linked to that project in the DB. If evidence is found, it automatically grants membership.

**Risk:** If any DB record incorrectly links User B's userId to User A's project (e.g., due to a prior data error), the canvas API would grant User B access to User A's project (returning 200 instead of 403).

**Status:** Not modified in this round. Flagged for a separate server-side audit task. Do NOT modify `canvas/route.ts` without completing that audit first.

---

## Dual-Account Verification Steps

To verify isolation is working correctly:

1. Log in as Account A, open `/create`, generate some canvas nodes.
2. Open DevTools → Application → Local Storage — confirm `creator-city:last-project-id` is set and `creator-city-canvas-draft:<projectId>` contains canvas data.
3. **Without clicking Logout**, navigate directly to the login page and log in as Account B.
4. Confirm `AuthProvider` detects userId change — `creator-city:last-project-id` and all `creator-city-canvas-draft:*` keys must be cleared automatically.
5. Confirm TopNavigation shows Account B's display name.
6. Click "AI 画布" — must navigate to `/create` without a `?projectId=` query param. Canvas calls `/api/projects/ensure` and returns Account B's own project. No `?projectId=<Account A's projectId>` in the URL.
7. Canvas shows empty state or Account B's own project — NOT Account A's nodes.
8. Manually open `/create?projectId=<Account A's projectId>` — canvas must NOT briefly show Account A's draft. API returns 403, all project-scoped keys for that projectId are cleared, canvas nodes cleared immediately, redirect to `/create`.
9. Visit `/projects` — shows loading state then Account B's projects only (no flash of Account A's list).
10. `/api/credits/balance` returns Account B's wallet balance.

---

## What is NOT covered here

- Server-side session isolation: handled by `session.ts` (tokenHash → userId)
- Payment/credits server logic: handled per `getCurrentUser()` in all API routes
- Admin role guard: handled by `user.role !== 'ADMIN'` in all `/api/admin/**` routes
- `attachCurrentUserProjectMemberWithEvidence` server-side audit: pending separate task
