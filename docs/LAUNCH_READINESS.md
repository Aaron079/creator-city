# Creator City — First Launch Readiness Report

**Audit date:** 2026-06-16  
**Auditor:** Claude / P2-LAUNCH-READINESS  
**Commit:** bf9d210

---

## Scope Audited

| Surface | Result |
|---|---|
| Homepage (`/`) + HomeLanding.tsx | ✅ |
| TopNavigation.tsx — nav groups, search, user dropdown | Fixed (5 issues) |
| `/pricing` — pricing page copy | ✅ |
| `/marketplace` — marketplace hero + rules | ✅ |
| `/account/membership` — membership centre copy | ✅ |
| `/account/providers` — BYOK onboarding copy | ✅ |
| `/account/credits` — credits disabled state | ✅ |

---

## Issues Found and Fixed (commit bf9d210)

### 1. "商业模式" → dead end `/pricing-preview`
- **Was:** `NAV_GROUPS['平台']` item linked to `/pricing-preview` (page does not exist)
- **Fix:** Changed to `/pricing` (real membership pricing page)

### 2. "订阅与套餐" disabled in user dropdown
- **Was:** Non-clickable div with `即将开放` badge; no path to membership page from user menu
- **Fix:** Converted to `<Link href="/account/membership">` labelled "会员中心", amber styling

### 3. Search index pointing to `/pricing-preview`
- **Was:** "商业模式" search result → `/pricing-preview`
- **Fix:** Updated to `/pricing`

### 4. Search "订阅与套餐" → `/pricing-preview`
- **Was:** Searching "订阅/会员/membership" returned a dead link
- **Fix:** Entry renamed to "会员中心", href → `/account/membership`, keywords expanded

### 5. Market nav group — no indication of preview status
- **Was:** 5 nav items (创作者主页, 需求广场, 报价方案, 阶段交付, 托管结算) showed as normal links with no warning
- **Fix:** Added `badge: '即将'` to all 5 items; badge renders as violet pill in dropdown

---

## Items Confirmed Clean (no action needed)

- **Homepage CTA:** "进入 AI 画布创作" → `/create` ✅
- **`/pricing` copy:** "会员费是平台服务费，不包含第三方 AI API 调用成本" — correct ✅
- **`/marketplace` hero:** "第一版不开放平台内积分支付，如需授权合作请直接联系创作者" — correct ✅
- **`/account/providers` BYOK-first notice:** Full billing model cards, security notice ✅
- **`/account/credits` disabled state:** "第一版采用会员订阅 + 自带 API Key（BYOK）模式" ✅
- **`/account/membership`:** Order flow, human review notice, no-refund notice ✅
- **Auth guard on `/account/providers`:** Handles `loading/unknown` session status gracefully ✅

---

## Out of Scope / Deferred

| Item | Reason |
|---|---|
| `协议版权 / 本地部署 / 企业版` preview pages | Lower priority; not primary user flow |
| Admin dashboard copy audit | Covered by P2-ADMIN |
| Automatic membership billing | P2-BILLING (post-launch) |
| Credits / wallet UI | P2-ADMIN-LATER (post-launch) |

---

## First-User Flow Validated

1. Land on `/` → click "进入 AI 画布创作" → `/create`
2. Encounter membership gate → `MembershipRequiredNotice` links to `/pricing` and `/account/membership`
3. User dropdown → "会员中心" → `/account/membership` (now live)
4. Complete membership order → admin approves → `membershipActive = true`
5. Return to canvas → generate image/video via BYOK provider
6. `/account/providers` → add Seedream BYOK account
7. `/marketplace` → browse listings → submit inquiry (requires membership)
