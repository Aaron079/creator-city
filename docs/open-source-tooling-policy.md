# Creator City Open Source Tooling Policy

Last reviewed: 2026-05-10

Creator City is an AI directing system for professional film production, not a generic AI tool collection. Open source tooling must strengthen the production chain:

script -> scene breakdown -> storyboard -> shot design -> character continuity -> scene continuity -> video production -> review -> delivery.

Nodes are only the material layer. Technical choices must serve the director layer, shot layer, storyboard layer, continuity layer, asset layer, Agent skill layer, community layer, and creator monetization layer.

## Selection Rules

1. Prefer free, open source, high-star, actively maintained GitHub projects.
2. Prefer commercial-friendly licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause.
3. Any GPL, AGPL, SSPL, fair-code, source-available, special license, or production license-key requirement must be called out before use.
4. GPL-family projects may be used only as independent services, process boundaries, or workflow references. Do not copy, vendor, or mix GPL code into the Creator City main codebase.
5. Do not integrate a library because it looks advanced. A tool must solve a real Creator City film-production problem and produce a user-visible workflow result.
6. Every tool must write forward into the production workflow: image generation, video generation, storyboard, directing system, asset library, review, delivery, Agent skills, community, or creator commerce.
7. Before adoption, answer:
   - Actual production use?
   - Why would creators rely on it?
   - Why is it more professional than common competitors?
   - How does it improve output quality?
   - How does it improve production efficiency?
   - How does it create a Creator City moat?
   - Where does the output enter the next workflow step?

## Required Intake Record

Every proposed tool must have an intake record with:

- GitHub repository
- Star count at review time
- License
- Recent maintenance state
- Creator City product problem solved
- User-visible behavior
- Immediate integration or reference-only
- Commercialization risk
- Workflow handoff target

## License Risk Bands

| Band | Licenses | Rule |
| --- | --- | --- |
| Low | MIT, Apache-2.0, BSD | Preferred for direct SDK/library integration after technical review. |
| Medium | MPL-2.0, mixed MIT/Apache transition, unclear GitHub NOASSERTION | Legal/architecture review required; prefer module boundary. |
| High | GPL, AGPL, SSPL | Independent service/reference only. No code mixing into the main project. |
| Blocked until reviewed | Fair-code, source-available, custom production license key, modified Apache, no license | Do not integrate into production until licensing and commercial use are explicitly approved. |

## Current Priority Map

### P0: Foundation For Production

| Tool | GitHub | Stars | License | Maintenance | Product Problem | User-Visible Behavior | Decision | Risk |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Supabase | [supabase/supabase](https://github.com/supabase/supabase) | 102,107 | Apache-2.0 | Active, pushed 2026-05-10 | Long-term production data: projects, assets, users, delivery, collaboration state. | Stable project/asset persistence and recovery across sessions. | Immediate integration candidate. | Low. |
| BullMQ | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | 8,830 | MIT | Active, pushed 2026-05-09 | Reliable queues for image/video generation, media persistence, proxy diagnostics, resync jobs. | Users see durable generation tasks, retries, progress, and recoverable failures. | Immediate integration candidate. | Low. |
| React Flow / xyflow | [xyflow/xyflow](https://github.com/xyflow/xyflow) | 36,516 | MIT | Active, pushed 2026-05-06 | Professional node canvas for shot/asset/workflow graph editing. | Director-grade graph canvas with connected materials, shots, and Agent actions. | Immediate integration candidate where it improves the current canvas. | Low. |
| ComfyUI API adapter | [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | 112,171 | GPL-3.0 | Active, pushed 2026-05-10 | Node-based diffusion workflows, ControlNet/IP-Adapter/reference pipelines. | Users can run repeatable image/video style and continuity workflows through a service boundary. | Build our own adapter; use ComfyUI only as independent service/reference. | High: GPL-3.0. No code mixing. |

### P1: Professional Film Workflow Expansion

| Tool | GitHub | Stars | License | Maintenance | Product Problem | User-Visible Behavior | Decision | Risk |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| OpenCut | [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) | 48,866 | MIT | Active, pushed 2026-05-06 | Timeline editing references for generated shots and creator delivery packages. | Clip assembly, reviewable cuts, lightweight editorial rhythm tools. | Reference first; integrate only specific MIT-compatible patterns. | Low. |
| Whisper | [openai/whisper](https://github.com/openai/whisper) | 99,210 | MIT | Active, pushed 2026-04-15 | Transcript, subtitle, dialogue timing, review search. | Automatic captions, transcript-based shot review, searchable delivery notes. | Integration candidate. | Low. |
| Qdrant | [qdrant/qdrant](https://github.com/qdrant/qdrant) | 31,189 | Apache-2.0 | Active, pushed 2026-05-09 | Semantic memory for assets, prompts, characters, scenes, references, Agent skills. | Similar-shot retrieval, character/style memory, continuity recall. | Integration candidate. | Low. |
| Yjs | [yjs/yjs](https://github.com/yjs/yjs) | 21,796 | MIT by LICENSE file | Active, pushed 2026-04-14 | Collaborative directing, storyboard, script and canvas editing. | Multiple collaborators can work on shot design and notes without overwriting each other. | Integration candidate. | Low; GitHub API reports NOASSERTION, verify package/license during adoption. |
| Hocuspocus | [ueberdosis/hocuspocus](https://github.com/ueberdosis/hocuspocus) | 2,254 | MIT | Active, pushed 2026-05-09 | Yjs WebSocket backend for real-time production collaboration. | Live director room, shared canvas/session review. | Integration candidate with Yjs. | Low. |

### P2: Production Assist And Media Intelligence

| Tool | GitHub | Stars | License | Maintenance | Product Problem | User-Visible Behavior | Decision | Risk |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| LiveKit | [livekit/livekit](https://github.com/livekit/livekit) | 18,572 | Apache-2.0 | Active, pushed 2026-05-09 | Live review, voice/video collaboration, virtual production sessions. | Frame.io-like review room and live director feedback. | Evaluate after core asset/canvas reliability. | Low. |
| PySceneDetect | [Breakthrough/PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | 4,788 | BSD-3-Clause | Active, pushed 2026-05-05 | Shot boundary analysis for imported/generated videos. | Auto-detected cuts, shot cards, continuity checks, review markers. | Evaluate for media intelligence service. | Low. |
| Mediabunny | [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) | 5,821 | MPL-2.0 | Active, pushed 2026-05-08 | Browser-side media parsing/conversion for previews and lightweight exports. | Faster local previews, metadata inspection, client-side media handling. | Evaluate behind a module boundary. | Medium: MPL-2.0 obligations must be isolated and documented. |
| MCP Servers | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 85,343 | MIT/Apache-2.0 transition by LICENSE file | Active, pushed 2026-04-17 | Agent tool integration layer for creative services and production systems. | Agent skills can call structured external tools instead of fake panels. | Evaluate per server; adopt only useful production skills. | Medium: mixed license transition; verify each server. |

## Deferred Until Re-Approved

These tools are not banned forever. They are deferred because license, product fit, or commercial deployment risk needs fresh review.

| Tool | GitHub | Stars | License / Risk Signal | Maintenance | Reason Deferred |
| --- | --- | ---: | --- | --- | --- |
| n8n | [n8n-io/n8n](https://github.com/n8n-io/n8n) | 187,257 | Sustainable Use License plus enterprise-license files | Active, pushed 2026-05-09 | Fair-code/source-available restrictions; do not embed as Creator City workflow engine without approval. |
| Dify | [langgenius/dify](https://github.com/langgenius/dify) | 140,745 | Modified Apache-2.0 with commercial conditions | Active, pushed 2026-05-09 | Multi-tenant/commercial conditions conflict with Creator City SaaS assumptions. |
| tldraw | [tldraw/tldraw](https://github.com/tldraw/tldraw) | 46,919 | Custom production license key model | Active, pushed 2026-05-08 | Production use has special license constraints; not a default canvas choice. |
| Remotion | [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 46,390 | Custom two-tier license; company license may apply | Active, pushed 2026-05-09 | Great rendering model, but commercial use needs license review. |
| MinIO | [minio/minio](https://github.com/minio/minio) | 60,900 | AGPL-3.0; repository archived | Archived; pushed 2026-04-24 | AGPL and archived state make it unsuitable for direct product integration. |
| designcombo/react-video-editor | [designcombo/react-video-editor](https://github.com/designcombo/react-video-editor) | 1,603 | No license detected by GitHub API | Active, pushed 2026-03-05 | No clear license; Remotion dependency also carries commercial risk. |

## Adoption Gate

Before merging any new tool into Creator City:

1. Create an intake entry using the fields above.
2. Confirm license in the repository and package artifacts, not only npm metadata.
3. Confirm recent maintenance: pushed or released within the last 6 months, unless intentionally adopting a stable low-churn library.
4. Define the film workflow handoff: e.g. storyboard -> shot design, shot -> video generation, asset -> continuity memory, review -> delivery.
5. Define failure behavior and recovery: generated media and production decisions must be durable.
6. Add tests or diagnostics appropriate to the risk.
7. For GPL/AGPL/special-license tools, document the process boundary and never import their code into Creator City main packages.

## Default Product Standard

A tool is complete only when it creates a working production loop:

input -> AI analysis -> generated or retrieved production result -> workflow write-back -> next-step availability.

Examples:

- A transcript tool must create subtitles, review markers, and searchable dialogue tied to shots.
- A vector tool must improve character, scene, style, and asset continuity.
- A canvas tool must strengthen shot design and asset routing, not merely display cards.
- A video tool must support review, edit rhythm, delivery, or regeneration decisions.
- An Agent tool must perform real production work and write back to Creator City state.
