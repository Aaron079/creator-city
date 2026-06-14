# Agent Report Template

Use this template for every task completion report.
Copy the template and fill in each section. Do not omit sections — use N/A if not applicable.

---

## Summary

| Field | Value |
|---|---|
| Status | PASS / FAIL / PARTIAL / BLOCKED / IMPLEMENTED |
| Mode | AUDIT_ONLY / IMPLEMENTATION_AUTHORIZED / QA_ONLY / DOCS_ONLY / HOTFIX_AUTHORIZED / PRODUCTION_VALIDATION |
| Scope | Brief description of what was in scope |
| Commit | `hash` or N/A |
| Push | Pushed to main / Not pushed / N/A |
| Date | YYYY-MM-DD |

---

## Files Changed

| File | Change Type | Purpose |
|---|---|---|
| `path/to/file.ts` | Created / Modified / Deleted | What this file does and why it changed |

---

## Commands Run

Paste real commands and their actual output (summarized if long):

```
$ pnpm type-check
✓ No type errors

$ git status
M  apps/web/src/app/...

$ git log --oneline -3
abc1234 add agent loop foundation
```

---

## Validation

| Check | Result | Notes |
|---|---|---|
| type-check | PASS / FAIL / SKIPPED | Error summary if FAIL |
| lint | PASS / FAIL / SKIPPED | Error summary if FAIL |
| build | PASS / FAIL / SKIPPED | Error summary if FAIL |
| targeted QA | PASS / FAIL / SKIPPED / PARTIAL | Criteria summary |

---

## Boundary Confirmation

| Boundary | Changed? |
|---|---|
| Schema (Prisma) changed | No |
| Migration added | No |
| Payment logic changed | No |
| Wallet / Ledger changed | No |
| Generate routes changed | No |
| Provider adapter changed | No |
| cn-executor changed | No |
| Production data mutated | No |
| Env file changed | No |
| New dependency added | No |
| NFT / on-chain | No |
| Autonomous deploy | No |
| Infinite loop / background process | No |

All entries must be No unless explicitly authorized by user this session.

---

## Risks / Notes

- List known risks
- List skipped QA items and reason
- List items deferred to next task
- List any ambiguous decisions made and why

---

## Next Recommended Task

**Task ID:** e.g., P1-4B-4  
**Title:** e.g., Membership basic gating  
**Mode:** AUDIT_ONLY  
**Why:** Brief reason this should come next.
