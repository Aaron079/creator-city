# Creator Intelligence Storyboard Advisory Evaluation Design

## Goal

Create a small, versioned, Creator City-owned offline evaluation suite for the
existing Storyboard Director local advisory layer. The suite must measure
whether the four advisory families are helpful, whether they stay silent when
evidence is absent, and whether their local evidence links remain inspectable.

This task strengthens quality assurance only. It does not add a model, a
provider call, a crawler, a route, a database table, user-facing controls, or
production data.

## Scope

The evaluation targets the four current local-only advisory codes, in fixed
order:

1. `LOCAL_NARRATIVE_PURPOSE_REVIEW`
2. `LOCAL_COMPOSITION_HIERARCHY_REVIEW`
3. `LOCAL_CONTINUITY_CONFIRMATION`
4. `LOCAL_LIGHTING_MOTIVATION_REVIEW`

It evaluates the pure `evaluateStoryboardDirectorAdvisories` function using
fully owned, deterministic Recipe fixtures. Each fixture uses synthetic script
content and synthetic approved-result evidence; no user project, uploaded
asset, external source, or production record participates.

## Evaluation Contract

Each case has a stable case id, a Recipe fixture, expected emitted codes in
exact order, expected silence where relevant, and required evidence behavior.

The first pack has eight cases:

| Case | Intent | Expected result |
| --- | --- | --- |
| `all-signals` | A multi-character reaction/turn scene with consecutive approved shots and explicit time/location | All four codes in fixed order |
| `narrative-only` | Approved reaction/turn and linked shot, with no composition, continuity, or lighting signal | Narrative only |
| `composition-only` | Multi-character scene with one approved shot, no reaction/turn and no lighting signal | Composition only |
| `continuity-only` | One scene with two approved shots, no reaction/turn, multi-character, or lighting signal | Continuity only |
| `lighting-only` | Location and time-of-day with one approved shot, no other signal | Lighting only |
| `no-approved-stages` | Pending/rejected drafts or non-approved stages | Silence |
| `no-real-evidence` | Otherwise matching structure but no matching evidence records | Silence |
| `decision-scope-change` | The same advisory after source or selection identity changes | The previous reviewed/ignored decision is open |

Every emitted finding must be advisory severity, use a local `ckr1_` receipt,
have an `sdra1_` input fingerprint and `sdrf1_` identifier, carry one or more
real evidence ids, and map every evidence id to an approved Recipe result.

## Quality Gate

The suite fails closed when a case emits a missing code, an extra code, a code
in a different order, an invented evidence id, a nonlocal receipt, an unstable
identity, a blocker, or a stale decision that remains applied after its scoped
input changes.

The suite reports deterministic aggregate counts only: case count, expected
finding count, emitted finding count, exact-match count, silence-match count,
and decision-invalidation count. It does not produce a fake confidence score
or describe advice as factual correctness.

The initial gate is exact-match: all eight owned cases must pass before an
advisory or knowledge-pack change can be committed. Adding a new rule or
advisory family requires adding deliberately positive and negative cases in
the same change.

## Architecture

Create a pure fixture module beside the existing Recipe tests and a dedicated
test file that imports the existing evaluator. The fixtures produce full V3
Recipes with source, scene, beat, and shot result evidence owned by the
fixture. The test computes aggregates from returned findings rather than
duplicating production rule logic.

No fixture helper may import React, Canvas workspace code, routes, persistence
mutations, Provider/BYOK/generation, credits, billing, payment, Prisma,
environment access, executors, networking, or filesystem runtime data.

## Boundaries

- Local source-only: all narrative content is synthetic and committed source.
- No external training, crawling, scraping, downloading, model invocation, or
  user-data reads.
- No change to the local cinematic pack or advisory behavior in this task.
- No production, Preview, database, asset, or canvas save/write QA.
- The new suite is a release gate and a regression signal, not a user-facing
  score, ranking, or automatic decision engine.

## Testing

TDD begins with failing case expectations. The final targeted command runs the
new evaluation suite together with existing advisory and intelligence tests.
The static advisory boundary test must keep passing. Full type-check, lint,
build, agent check, and diff check are required before delivery.

## Follow-on Use

The next knowledge-pack enhancement may use this pack to prove that an
approved local rule improves coverage without creating new false-positive
advisories. The later professional-review task may use the same fixtures to
verify that proposed alternatives are evidence-linked and non-blocking.
