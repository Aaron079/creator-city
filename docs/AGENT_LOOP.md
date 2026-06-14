# Agent Loop

## Purpose

The Agent Loop helps Claude Code / Codex remember Creator City's goal, commercial model, boundaries, current tasks, and QA requirements before doing any work. It is not an autonomous coding machine — it is a structured protocol for safe, scoped, reversible development.

## Loop Steps

Every Agent session follows these steps in order:

1. **Read** `docs/PROJECT_MEMORY.md` — vision, first launch model, architecture principles
2. **Read** `docs/CURRENT_STATUS.md` — current task state and most recent commits
3. **Read** `docs/BOUNDARIES.md` — hard boundaries, forbidden operations, stop conditions
4. **Read** `docs/NEXT_TASKS.md` — task queue, priorities, blocked-by dependencies
5. **Read** `docs/QA_RUNBOOK.md` — QA procedures if in QA mode
6. **Inspect** git status (`git status --short`, `git log --oneline -5`)
7. **Identify** the highest-priority unblocked task from NEXT_TASKS.md
8. **Determine mode** (see Modes section below)
9. **Execute** according to mode:
   - `AUDIT_ONLY`: read files, inspect code, produce report — no modifications
   - `IMPLEMENTATION_AUTHORIZED`: execute minimal scoped change, run checks
   - `QA_ONLY`: validate behavior with browser/API/tests, no code changes
   - `DOCS_ONLY`: documentation changes only
   - `HOTFIX_AUTHORIZED`: minimal fix for confirmed bug, no scope expansion
   - `PRODUCTION_VALIDATION`: validate deployed production behavior, record evidence
10. **Run** required checks (type-check, lint, build — unless QA/audit mode)
11. **Update** docs/NEXT_TASKS.md and docs/CURRENT_STATUS.md if in scope
12. **Report** using `docs/AGENT_REPORT_TEMPLATE.md`
13. **Stop** — do not proceed to next task without user authorization

## Modes

See `docs/AGENT_MODES.md` for full mode definitions.

### Mode Selection Rules

| Situation | Default Mode |
|---|---|
| No explicit user instruction | `AUDIT_ONLY` |
| User says "implement X" or "fix X" | `IMPLEMENTATION_AUTHORIZED` (scoped to X only) |
| User says "QA" or "validate" | `QA_ONLY` |
| User says "update docs" | `DOCS_ONLY` |
| Confirmed bug needs fix | `HOTFIX_AUTHORIZED` |
| Validating production deploy | `PRODUCTION_VALIDATION` |

Schema / payment / wallet / generate tasks: always stop and ask before any implementation.

## Stop Conditions

Stop immediately and wait for user when:
- Schema or migration change is needed
- Payment, wallet, or ledger is affected
- Production data mutation is required
- Env secrets or credentials are missing or incorrect
- QA requires a second account that cannot be created safely
- Build or type-check fails (do not push broken state)
- Business decision is unclear (e.g., what membership gates)
- Commit, push, or deploy requires user confirmation
- Any risk of real money, credits, refund, or data mutation exists
- Scope expansion is needed beyond what was stated

## Commit Rules

Only commit if:
- User explicitly authorized implementation in this session
- All checks pass (type-check + lint + build)
- Only files within stated scope are staged

Always report before committing:
- `git status` before staging
- Checks run and their results
- `git diff --stat` summary
- Commit hash after
- Push status

## Deployment Rules

Do NOT push or deploy unless user explicitly requests.
Vercel main branch auto-deploys on push — treat push as deploy.
Always confirm push with user before running `git push`.

## Check Commands

```bash
cd /Users/aaron/creator-city
pnpm type-check
pnpm lint
pnpm build
```

## Loop Check Script

Run before starting work to verify all memory files exist and see top pending tasks:

```bash
node scripts/agent-loop-check.mjs
# or
pnpm agent:check
```
