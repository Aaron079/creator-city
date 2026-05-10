# Creator City — Open-Source Tools Architecture

> Status: Active | Updated: 2026-05-10

---

## Overview

Creator City integrates a curated set of open-source tools at various tiers. This document describes the architecture that governs how those tools are registered, health-checked, feature-flagged, and surfaced to operators.

This is **not** the AI Director Skills system (`apps/web/src/lib/skills/` — that governs creative prompt injection). This system governs **infrastructure and tooling integrations**.

---

## Directory Layout

```
apps/web/src/lib/open-source-tools/
├── types.ts              # OpenSourceToolDefinition, OpenSourceToolHealth, risk/tier/status enums
├── registry.ts           # OPEN_SOURCE_TOOL_REGISTRY — all 19 tools
├── health.ts             # runAllHealthChecks() — calls all 11 adapters
├── index.ts              # re-exports everything
└── adapters/
    ├── storage-adapter.ts       # Supabase Storage
    ├── queue-adapter.ts         # BullMQ / Redis
    ├── canvas-adapter.ts        # React Flow (always enabled)
    ├── comfyui-adapter.ts       # ComfyUI HTTP API
    ├── whisper-adapter.ts       # Whisper ASR
    ├── qdrant-adapter.ts        # Qdrant vector DB
    ├── collaboration-adapter.ts # Yjs + Hocuspocus
    ├── livekit-adapter.ts       # LiveKit WebRTC
    ├── shot-detection-adapter.ts# PySceneDetect
    ├── browser-media-adapter.ts # Mediabunny (WASM)
    └── mcp-adapter.ts           # MCP Servers

apps/web/src/app/api/skills/
├── route.ts              # GET /api/skills — returns all definitions (no env key values)
└── health/
    └── route.ts          # GET /api/skills/health — runs all health checks

apps/web/src/app/skills/
└── page.tsx              # /skills — admin dashboard
```

---

## Tool Tiers

| Tier | Meaning | Current tools |
|------|---------|---------------|
| **P0** | Core infrastructure — must be ready for /create to function | Supabase Storage, BullMQ, React Flow, ComfyUI |
| **P1** | High-value add-ons — ship when env is configured | OpenCut, Whisper, Qdrant, Yjs+Hocuspocus |
| **P2** | Extended capabilities — conditional on business decisions | LiveKit, PySceneDetect, Mediabunny, MCP |
| **deferred** | Reference only — licensed/scoped correctly but not yet integrated | n8n, Dify, tldraw, Remotion, MinIO, DesignCombo |

---

## Risk Levels

| Risk | Meaning | Action required |
|------|---------|-----------------|
| `safe` | MIT / Apache-2.0 / BSD | Use freely |
| `license_review` | MPL-2.0 or attribution-sensitive MIT | Confirm usage scope before shipping |
| `service_isolation_required` | GPL-3.0 / AGPL-3.0 | **Must** run as an independent HTTP service — never import code into this repo |
| `reference_only` | Deferred, fair-code, or commercially restricted | Do not integrate until explicitly unblocked |

---

## Feature Flags

Each tool has a `featureFlag` field (e.g. `NEXT_PUBLIC_ENABLE_COMFYUI`). Set the env var to `"true"` to mark a tool as enabled in the registry response. Flags are **not** enforced at runtime — they are informational signals for operators and the `/skills` dashboard.

Actual runtime behavior is controlled by the presence of required `envKeys` (e.g. `COMFYUI_BASE_URL`).

---

## API Contracts

### `GET /api/skills`

Returns all tool definitions without exposing `envKeys` values.

```json
{
  "success": true,
  "tools": [
    {
      "id": "comfyui",
      "name": "ComfyUI",
      "tier": "P0",
      "risk": "service_isolation_required",
      "license": "GPL-3.0",
      "enabled": false,
      ...
    }
  ],
  "summary": {
    "total": 19,
    "enabled": 3,
    "byTier": { "P0": 4, "P1": 4, "P2": 4, "deferred": 7 },
    "byRisk": { "safe": 9, "license_review": 3, "service_isolation_required": 1, "reference_only": 6 }
  }
}
```

### `GET /api/skills/health`

Runs live health checks on all 11 active adapters (deferred tools are not probed).

```json
{
  "success": true,
  "health": [
    { "toolId": "supabase-storage", "status": "enabled", "latencyMs": 142, "checkedAt": "..." },
    { "toolId": "comfyui", "status": "misconfigured", "message": "COMFYUI_BASE_URL not set", "checkedAt": "..." }
  ],
  "summary": { "total": 11, "enabled": 3, "disabled": 7, "misconfigured": 1, "error": 0 },
  "checkedAt": "..."
}
```

---

## GPL Isolation Rule

ComfyUI is GPL-3.0. The rule is absolute:

> **Never import ComfyUI Python code, copy its source, or link it statically into this application.**
> The only permitted integration pattern is HTTP calls to a separately running ComfyUI process.

This is enforced architecturally: `comfyui-adapter.ts` only calls `COMFYUI_BASE_URL/system_stats` via `fetch`. No Python FFI, no git submodule, no vendored source.

---

## Adding a New Tool

1. Add a `OpenSourceToolDefinition` entry to `registry.ts`
2. Create `adapters/<tool>-adapter.ts` with a `get<Tool>Health()` function
3. Import and call it in `health.ts`
4. Set the appropriate `risk` level — if GPL/AGPL, use `service_isolation_required`
5. Run `pnpm --filter web exec tsc --noEmit && pnpm build`

---

## What This System Does NOT Govern

- AI Director creative skills (`apps/web/src/lib/skills/`) — those inject into generation prompts
- Provider management (`/api/providers`) — that governs LLM/image/video API providers
- Billing and credits — `apps/web/src/lib/credits/`
- Asset persistence — `apps/web/src/lib/assets/`
