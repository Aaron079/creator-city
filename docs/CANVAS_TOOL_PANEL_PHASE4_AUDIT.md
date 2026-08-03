# Canvas Tool Panel Phase 4 Audit

## Scope

Read-only audit of the remaining complex Canvas panels before any Phase 4
migration. This document does not authorize product implementation.

## Current Capability Map

| Tool | Current value | Persistence / action | Assessment |
| --- | --- | --- | --- |
| Asset Variant Planner | Creates bounded image/video prompt directions from a selected asset | Copy, append, or explicitly create a draft node | Keep; strengthen its review-to-branch handoff rather than adding another ideation tool. |
| Character Lock | Maintains character profiles, references, and reusable consistency context | Saves a character bible and appends approved context | Keep separate. It is an identity asset system, not a general prompt tool. |
| A/B Compare | Compares two existing image/video nodes and records an operator choice | Read-only comparison and copied report | Keep; strengthen evidence and decision handoff, not a new comparison surface. |
| Keyframe Extractor | Extracts a local video frame and creates an explicit downstream draft | Local browser extraction followed by explicit draft-node creation | Highest-value local media tool. Harden extraction evidence, fallback, and provenance first. |
| Continuity Checker | Runs deterministic graph/content checks across Canvas nodes and edges | Read-only report with focus navigation | Keep as a preflight gate. Do not turn its categorical findings into fake quality scores. |
| Batch Prompt Rewriter | Previews and applies a batch prompt patch across selected nodes | Explicit batch patch | Keep; add reviewable diffs and a clear save boundary before broader automation. |
| Color Grade Palette | Produces CSS preview and a prompt-level grade instruction | Preview plus explicit prompt/derived-node action | Keep; clearly label prompt-level grading until a verified pixel-processing executor exists. |

## Recommended Migration Groups

### Group A: Evidence And Review

Migrate **A/B Compare**, **Continuity Checker**, and **Batch Prompt Rewriter**
onto one shared panel frame. They share a review-first contract: select
existing nodes, inspect deterministic evidence, and explicitly copy or apply a
bounded decision. The shared frame needs source scope, evidence strip, diff or
finding body, and one explicit apply boundary.

### Group B: Asset Derivation

Migrate **Asset Variant Planner**, **Keyframe Extractor**, and **Color Grade
Palette** with a source/provenance-first frame. These tools must keep the
original asset immutable and present one explicit "create draft" or "apply to
prompt" action. Keyframe Extractor is the first implementation priority in
this group because it is locally useful without a Provider.

### Group C: Identity Context

Keep **Character Lock** outside the generic frame migration until its character
bible and reference-card lifecycle is explicitly modeled. It should share only
visual primitives such as header, source summary, and result evidence; its
identity CRUD and inheritance need their own guarded workflow.

## Upgrade Order

1. Keyframe Extractor: stable local-frame evidence, CORS/failure guidance, and
   derived-node provenance.
2. Color Grade Palette: distinguish preview, prompt instruction, and any future
   pixel result; never claim a rendered asset before one exists.
3. A/B Compare and Continuity Checker: connect verdicts to explicit next steps
   without auto-mutating nodes.
4. Batch Prompt Rewriter: add per-node diff review and a single durable apply
   transaction.
5. Asset Variant Planner: branch selected variants into a compact decision
   board, not a second storyboard system.
6. Character Lock: dedicated identity/reference quality pass after its data
   model is audited separately.

## Non-Duplication Rules

- The Storyboard Director owns story, beats, shots, and local storyboard boards.
- Variant Planner owns controlled divergence from one asset.
- A/B Compare owns selection between existing versions.
- Continuity Checker owns deterministic preflight findings.
- Batch Prompt Rewriter owns controlled bulk editing.
- Color Grade owns grading intent and preview, not pixel editing claims.
- Character Lock owns reusable character identity and reference context.

## Preconditions For Implementation

- Keep generation and Provider invocation behind explicit user confirmation.
- Preserve source nodes and assets as immutable.
- Add a focused behavior test before each migration.
- Verify a panel at desktop and mobile boundaries, then run Canvas save/reload
  and Console/Network checks.
