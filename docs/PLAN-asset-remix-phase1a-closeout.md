# Plan: P0-ASSET-REMIX-PHASE-1A-ARCHITECTURE-EXECUTOR-OSS-CLOSEOUT

**Goal:** Merge frozen design + executor scaffold + OSS foundation into one consistent delivery. Audit, fix, test, document. No deploy.

**Mode:** AUDIT_FIRST / IMPLEMENTATION_AUTHORIZED / LOCAL_ONLY / NO_DEPLOY  
**Created:** 2026-06-21

---

## Steps

- [x] Track A1: CC git status + log — establish working tree state
- [x] Track A2: Executor 51-file manifest — confirm scaffold completeness
- [x] Track A3: Option A drift scan — CC docs + executor Python
- [x] Track A4: Read getAliyunOssSignedUploadUrl stub (aliyun-oss.ts:326)
- [x] Track A5: Read CC asset-transform route + types — understand current contract
- [x] Track B1: Expand Redis JobState in executor contracts.py (add 10 missing fields per spec)
- [x] Track B2: Add artifact gate check in executor gateway/app/main.py (/capabilities route)
- [x] Track B3: Verify no runpodJobId leaks in executor API responses
- [x] Track C1: Fix getAliyunOssSignedUploadUrl stub → real presigned PUT (aliyun-oss.ts:326)
- [x] Track C2: Create lib/asset-transform/assetTransformOss.ts — transform-specific presigned URL helpers with security validation
- [x] Track D1: Document getAliyunOssSignedDownloadUrl as reusable helper (already implemented)
- [x] Track E1: Create lib/asset-transform/gatewayServiceClient.ts — HMAC-signed calls to Railway Gateway
- [x] Track E2: Create lib/asset-transform/assetTransformHmac.ts — CC→Gateway HMAC signing utility
- [x] Track E3: Update CC asset-transform route POST to use Gateway client + presigned URL generation
- [x] Track F1: Create app/api/internal/asset-transform/ingest/route.ts — contract + HMAC verify + security skeleton (OUTPUT_INGESTION_IMPLEMENTATION_PENDING)
- [x] Track G1: Add /capabilities route to executor gateway with artifact gate check
- [x] Track H1: Verify candidate_ranking.py correctly handles HIGH/MEDIUM/LOW — no largest-mask selection
- [x] Track I1: Install test dependencies in executor venv
- [x] Track I2: Expand executor tests — gateway auth, status mapping, contract, security
- [x] Track I3: Run pytest in executor — 23/23 PASS (path traversal guard added to validation.py)
- [x] Track J1: Run compileall + docker compose config — CLEAN
- [x] Track K1: Update CC docs/CURRENT_STATUS.md — add closeout status entry
- [x] Track K2: Update CC docs/NEXT_TASKS.md — update task statuses
- [x] Track K3: Create docs/ADR_ASSET_REMIX_EXECUTOR_ARCHITECTURE.md
- [x] Track L1: CC type-check (pnpm type-check) — PASS (0 errors)
- [x] Track L2: CC lint (pnpm lint) — warnings only (pre-existing, none in new files)
- [x] Track L3: Final secret grep on executor — CLEAN (only placeholder values in docker-compose.yml)
- [x] Track L4: Final git diff --stat on CC — 6 files pending Founder authorization

## Dependencies

- B1 must complete before I2 (tests reference updated contracts)
- C1,C2 must complete before E1,E3 (gateway client uses presigned URL helpers)
- E1,E2 before E3 (route uses client)
- F1 before L1 (type-check includes ingest route)
- All tracks before L1,L2,L3,L4

## Risks

- ali-oss SDK `signatureUrl` method signature — must match existing GET pattern
- CC type-check may surface issues in new files — fix before final report
- `runpod` Python package not installed locally — tests must mock it

## Definition of Done

- pytest PASS on executor (offline, mocked)
- CC type-check PASS (or known blockers documented)
- No real secrets in any file
- No Option A code paths in production code
- ADR created
- Docs updated
- All gates remain closed (ASSET_TRANSFORM_ENABLED=false in production)
