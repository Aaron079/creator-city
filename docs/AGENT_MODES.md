# Agent Modes

## Default Mode

**AUDIT_ONLY**

Unless the user explicitly authorizes a different mode, always start in AUDIT_ONLY.
Never assume implementation is authorized. When in doubt, ask.

---

## AUDIT_ONLY

**What it means:** Read files, inspect code, produce a report.

**Allowed:**
- Reading any file in the repository
- Running read-only commands (`git log`, `git diff`, `git status`, `grep`, `find`)
- Running `node scripts/agent-loop-check.mjs`
- Writing analysis and recommendations in the conversation

**Not allowed:**
- Any file modification
- Any shell command that writes state
- Any git commit, push, or tag
- Any API call to production

**When to use:**
- Start of every session before implementation is authorized
- When exploring a new area of the codebase
- When the user asks "what would it take to..."
- When asked to audit or review

---

## IMPLEMENTATION_AUTHORIZED

**What it means:** File changes are allowed within explicitly stated scope.

**Allowed:**
- Modifying files within the stated task scope
- Running type-check, lint, build
- Creating new files within scope
- Staging and committing (only if user requested a commit)

**Not allowed:**
- Touching files outside stated scope
- Schema / migration / payment / wallet / generate changes without explicit user authorization
- Pushing without user confirmation
- Expanding scope without asking user

**When to use:**
- Only when user explicitly says "implement X" or "fix X" or "add Y"
- Mode ends after the stated task is done — do not continue to next task automatically

---

## QA_ONLY

**What it means:** Validate deployed production behavior. No code changes.

**Allowed:**
- HTTP requests to production API endpoints
- Browser navigation (via instructions to user or automated test)
- Reading logs and response bodies
- Creating low-risk test data (fake email, test voucherNote) if explicitly in QA scope
- Writing the QA report in the conversation

**Not allowed:**
- Any code file changes
- High-value transactions (real payment, real refund)
- Production data mutation beyond what QA scope explicitly allows
- Committing or pushing

**When to use:**
- After implementation commits are deployed to Vercel
- When user says "QA this" or "validate"
- For P1-4B-QA, P1-4E, and other QA tasks in NEXT_TASKS.md

---

## DOCS_ONLY

**What it means:** Only documentation changes — no business logic, no code.

**Allowed:**
- Modifying `docs/*.md` files
- Modifying `README.md`
- Updating `docs/CURRENT_STATUS.md`
- Updating `docs/NEXT_TASKS.md`

**Not allowed:**
- Any changes to `apps/`, `packages/`, `scripts/` (except `scripts/agent-loop-check.mjs`)
- Any schema, payment, or generation changes

**When to use:**
- When user asks to update docs, runbooks, or status
- After a task completes and CURRENT_STATUS.md needs updating

---

## HOTFIX_AUTHORIZED

**What it means:** Minimal targeted fix for a confirmed production bug.

**Allowed:**
- Modifying the specific file(s) causing the confirmed bug
- Running checks
- Committing the fix (if user requests)

**Not allowed:**
- Cleanup, refactoring, or improvements beyond the bug fix
- Touching files outside the confirmed bug's scope
- Schema / payment / wallet changes without separate authorization

**When to use:**
- Only when a specific bug is confirmed in production
- Only when user explicitly says "hotfix X"
- Scope is as narrow as possible

---

## PRODUCTION_VALIDATION

**What it means:** Validate behavior of a specific deployed feature on production.

**Allowed:**
- HTTP requests to production API
- Reading production API responses
- Noting discrepancies between expected and actual behavior
- Writing a validation report

**Not allowed:**
- Code changes
- High-value data mutations
- Creating test data beyond what the validation explicitly requires

**When to use:**
- After a feature deploys to Vercel main
- When user says "validate production" or "check if X works on prod"
- For smoke tests after deploy

---

## Mode Transitions

Modes do not auto-escalate. To change mode, the user must explicitly authorize it.

Examples:
- AUDIT_ONLY → IMPLEMENTATION_AUTHORIZED: user says "ok implement it"
- QA_ONLY → IMPLEMENTATION_AUTHORIZED: user says "found bug, fix it"
- Any mode → AUDIT_ONLY: default fallback when task completes or is ambiguous
