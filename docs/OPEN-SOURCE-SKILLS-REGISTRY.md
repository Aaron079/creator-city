# Creator City — Open-Source Skills Registry

> 19 tools · 4 tiers · 4 risk levels · Updated: 2026-05-10

This document is the authoritative reference for every open-source tool evaluated for Creator City. It records tier, license, risk, integration status, and decision rationale.

---

## P0 — Core Infrastructure (must be production-ready)

### Supabase Storage
- **License**: Apache-2.0 · **Risk**: safe
- **Stars**: ~72k · **Homepage**: https://supabase.com/storage
- **Env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **Surface**: asset-upload, media-persistence, project-assets
- **Status**: Production. Primary object storage backend for user media and generated assets.

### BullMQ
- **License**: MIT · **Risk**: safe
- **Stars**: ~6.2k · **Homepage**: https://bullmq.io
- **Env**: `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`
- **Surface**: video-generation, async-jobs, media-processing
- **Status**: Production-ready. Used for async video generation queues.

### React Flow
- **License**: MIT · **Risk**: safe
- **Stars**: ~24k · **Homepage**: https://reactflow.dev
- **Env**: none (client-side)
- **Surface**: create-canvas, workflow-editor
- **Status**: In use. Powers the AI director node canvas on `/create`.

### ComfyUI
- **License**: GPL-3.0 · **Risk**: service_isolation_required ⚠️
- **Stars**: ~65k · **Homepage**: https://github.com/comfyanonymous/ComfyUI
- **Env**: `COMFYUI_BASE_URL`, `COMFYUI_API_KEY`
- **Surface**: image-generation, local-diffusion
- **Status**: Adapter ready. Not yet deployed.
- **GPL Rule**: Must run as an independent HTTP service. Never import ComfyUI code into this repo. See `CREATOR-CITY-SKILLS-ARCHITECTURE.md`.

---

## P1 — High-Value Add-Ons (ship when env is configured)

### OpenCut
- **License**: MIT · **Risk**: license_review
- **Stars**: ~18k · **Homepage**: https://opencut.app
- **Env**: none
- **Surface**: video-editor, timeline
- **Status**: Planned. Verify MIT attribution requirements before fork-based integration.

### OpenAI Whisper
- **License**: MIT · **Risk**: safe
- **Stars**: ~77k · **Homepage**: https://github.com/openai/whisper
- **Env**: `WHISPER_API_URL`, `WHISPER_API_KEY`
- **Surface**: video-subtitles, voice-transcription
- **Status**: Adapter ready. Deploy a Whisper API server and set env keys.

### Qdrant
- **License**: Apache-2.0 · **Risk**: safe
- **Stars**: ~22k · **Homepage**: https://qdrant.tech
- **Env**: `QDRANT_URL`, `QDRANT_API_KEY`
- **Surface**: asset-search, style-retrieval, shot-matching
- **Status**: Adapter ready. Deploy Qdrant Cloud or self-host.

### Yjs + Hocuspocus
- **License**: MIT · **Risk**: safe
- **Stars**: ~18k (combined) · **Homepage**: https://hocuspocus.dev
- **Env**: `HOCUSPOCUS_URL`, `HOCUSPOCUS_SECRET`
- **Surface**: canvas-collaboration, shared-editing
- **Status**: Adapter ready. Requires Hocuspocus server deployment.

---

## P2 — Extended Capabilities (conditional on business decisions)

### LiveKit
- **License**: Apache-2.0 · **Risk**: license_review
- **Stars**: ~12k · **Homepage**: https://livekit.io
- **Env**: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`
- **Surface**: live-review, co-production, video-room
- **Status**: Adapter ready. Confirm Apache-2.0 commercial usage terms.

### PySceneDetect
- **License**: BSD-3-Clause · **Risk**: safe
- **Stars**: ~3.8k · **Homepage**: https://www.scenedetect.com
- **Env**: `SHOT_DETECTION_API_URL`
- **Surface**: shot-detection, video-analysis
- **Status**: Adapter ready. Requires Python microservice deployment.

### Mediabunny
- **License**: MPL-2.0 · **Risk**: license_review
- **Stars**: ~420 · **Homepage**: https://mediabunny.dev
- **Env**: none (WASM)
- **Surface**: browser-transcode, client-trim, wasm-processing
- **Status**: Adapter ready. MPL-2.0: modifications to Mediabunny source files must be shared, but application code is unaffected.

### MCP Servers
- **License**: MIT · **Risk**: safe
- **Stars**: ~9.5k · **Homepage**: https://modelcontextprotocol.io
- **Env**: `MCP_SERVER_URL`, `MCP_API_KEY`
- **Surface**: agent-tools, ai-integration, tool-use
- **Status**: Adapter ready. Deploy any MCP-compatible server.

---

## Deferred — Reference Only (do not integrate until unblocked)

| Tool | License | Stars | Reason Deferred |
|------|---------|-------|-----------------|
| **n8n** | fair-code | ~52k | Fair-code prohibits SaaS resale without commercial license |
| **Dify** | Apache-2.0 | ~56k | Scope conflicts with internal AI director; re-evaluate for external orchestration |
| **tldraw** | custom | ~39k | Custom license requires explicit commercial approval from tldraw team |
| **Remotion** | custom | ~21k | Requires paid commercial license; defer pending licensing decision |
| **MinIO** | AGPL-3.0 | ~49k | AGPL triggers copyleft when offered as a service; use Supabase Storage instead |
| **DesignCombo** | MIT | ~1.4k | Overlaps with OpenCut; evaluate after OpenCut integration |

---

## License Risk Bands

| Band | Licenses | Action |
|------|----------|--------|
| **Low** | MIT, Apache-2.0, BSD-3-Clause | Use freely, standard attribution |
| **Medium** | MPL-2.0, LGPL-3.0 | File-level copyleft — do not modify vendored files; application code safe |
| **High** | GPL-3.0, AGPL-3.0 | Must be isolated as an independent HTTP service — no code mixing |
| **Blocked** | fair-code, custom (tldraw/Remotion) | Do not integrate without legal/commercial clearance |

---

## Decision Log

| Date | Tool | Decision | Reason |
|------|------|----------|--------|
| 2026-05-10 | ComfyUI | Tier P0, service_isolation_required | GPL-3.0; adapter-only pattern established |
| 2026-05-10 | n8n | Deferred | fair-code SaaS restriction |
| 2026-05-10 | MinIO | Deferred | AGPL-3.0 service copyleft |
| 2026-05-10 | tldraw | Deferred | Custom commercial license unresolved |
| 2026-05-10 | Remotion | Deferred | Commercial license cost pending |
| 2026-05-10 | DesignCombo | Deferred | Overlaps OpenCut — defer |
