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

**Rule**: never remove or bypass ownership guards in these routes.

---

## Frontend localStorage Rules

### On Logout — must clear all user-scoped keys

The helper `clearUserScopedLocalState()` in `lib/client-storage/clearUserLocalState.ts` removes:

**Exact keys:**
- `creator-city:last-project-id` — last opened project
- `creator-city:last-workflow-id` — last opened workflow
- `creator-city:projects-cache` — project list cache

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

### Cross-account project navigation — prohibited

`creator-city:last-project-id` must be cleared on logout so a newly logged-in user is never silently redirected to a previous user's project URL. Clearing this key at logout breaks the navigation chain before the canvas API's 403 guard is even reached.

### 401 response — never show local draft

If the canvas API returns 401 (session invalid), the canvas must NOT display local draft data. The session is unverified — the local draft may belong to a different user who was previously logged in. The correct behavior is to clear the project pointer and show an "please re-login" error.

File: `VisualCanvasWorkspace.tsx` 401 handler — `hasHydratedCanvasRef.current = false`, no `local-draft` status.

### Projects cache — not user-scoped

`creator-city:projects-cache` holds the last API response from `/api/projects`. It is NOT keyed by userId. Therefore:
- Never pre-populate the projects page UI from this cache — doing so shows the previous user's project list briefly on login.
- The cache may still be written for prefetching purposes, but must be cleared on logout.

---

## Dual-Account Verification Steps

To verify isolation is working correctly:

1. Log in as Account A, open `/create`, generate some canvas nodes.
2. Open DevTools → Application → Local Storage — confirm `creator-city:last-project-id` is set.
3. Click Logout.
4. Confirm in DevTools that `creator-city:last-project-id` and all `creator-city-canvas-draft:*` keys are removed.
5. Log in as Account B (without clearing browser data).
6. Confirm TopNavigation shows Account B's display name.
7. Click "AI 画布" — should NOT navigate to Account A's projectId.
8. If canvas API returns 403 for any residual URL, `last-project-id` is cleared and user is redirected to `/create`.
9. Canvas shows empty state or Account B's own project — NOT Account A's nodes.
10. Visit `/projects` — shows loading state then Account B's projects only (no flash of Account A's list).
11. `/api/credits/balance` returns Account B's wallet balance.

---

## What is NOT covered here

- Server-side session isolation: handled by `session.ts` (tokenHash → userId)
- Payment/credits server logic: handled per `getCurrentUser()` in all API routes
- Admin role guard: handled by `user.role !== 'ADMIN'` in all `/api/admin/**` routes
