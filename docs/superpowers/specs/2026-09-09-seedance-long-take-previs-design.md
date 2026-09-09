# Seedance Long-Take Previsualization Design

**Status:** Founder-approved P0 design

## Goal

Turn Creator City from a prompt-only video launcher into a Seedance-first virtual-production workflow. A user can build a grounded interior or exterior scene, direct actors and a camera in one three-dimensional world, preview the complete take, and send Seedance a provider-ready delivery package.

The product goal is bounded, not pixel-perfect, consistency. The system must make the elements that matter to a production decision explicit, preserve them as constraints, show the user the residual risk before a paid request, and compare the returned video against the same constraints.

## Founder Decisions

- Seedance is the only P0 delivery and acceptance target. Other providers may be added later as adapters; they must not change the canonical scene or take model.
- Support a standard take length through 30 seconds and a long-take target through 180 seconds when the active Seedance capability permits it.
- The product must not block a user from generating. It must surface actionable risk, cost, queue, and capability warnings, then record the user's explicit decision to continue.
- A long take has two synchronized editing modes:
  - **Continuous blocking:** one uninterrupted actor and camera path on the master timeline.
  - **Story beats:** editable narrative intervals over the same master path.
- If a long-take capability is unavailable or the user accepts a continuity risk, Creator City may propose a 30-second continuation chain. It cannot switch automatically; the user must explicitly approve the chain.
- A 30-second chain must be previewed in Creator City as one continuous take before generation and assembled as one continuous review after generation.
- Existing confirmed canvas, node/editor, prompt editor, resize, drag, and context-menu behavior remain unchanged. This is an additive director tool and must comply with `docs/CONFIRMED_EXPERIENCE_LOCKS.json`.

## Product Boundary

This design does not promise that a stochastic video model will reproduce every pixel in a preview. It treats the following as a contract that Creator City must preserve, validate, and explain:

1. **Spatial anchors:** selected buildings, entrances, signs, vehicles, props, and actors remain the intended identifiable references.
2. **Blocking:** actors move on the intended ground path, do not cross protected geometry, and retain intended entry/exit positions.
3. **Camera:** camera position, view direction, height, lens, target, and movement follow the authored take as closely as the target capability permits.
4. **Composition:** required subject position, foreground/midground/background landmarks, and occlusion order remain intentional at key times.
5. **Continuity:** the exit state of a take or chain segment is the required entrance state of the next segment.

Atmosphere, incidental extras, micro-motion, and non-locked details remain creative degrees of freedom unless the user explicitly locks them.

## Seedance Capability Contract

The provider adapter must not hard-code duration or input limits in the UI. It resolves a capability record using:

`provider + model/version + entry point + account entitlement`

The record contains at minimum:

- Maximum single-generation duration.
- Maximum continuous long-take duration, including beta/limited-access status.
- Allowed aspect ratios and output resolutions.
- Supported first frame, final frame, image references, video references, audio references, and video continuation inputs.
- Per-input count, size, duration, and ordering limits.
- Supported camera, script, motion, and local-edit controls.
- Cost estimate inputs, queue state, and known provider caveats.

The initial catalog exposes a standard 30-second Seedance 2.5 take and a conditional 180-second long-take entry. A long-take option is labelled with the active entitlement and is never shown as universally available. Seedance 2.0 official material already demonstrates multi-modal references, reference-video continuation, and long-take workflows; exact 2.5 request fields remain adapter-owned and must be verified against the active provider endpoint before submission.

## Canonical Data Model

### Spatial scene

`SpatialScene` holds one physical coordinate system for the entire take:

- Scene zones, terrain, ground plane, obstacles, entrances, and transition portals.
- Reconstruction coverage and confidence volumes: `verified`, `constrained`, or `unavailable`.
- Semantic anchors with stable IDs, display name, category, transform, geometry proxy, source references, appearance constraints, and lock status.
- Environment state such as time of day, weather, lighting direction, and visual treatment.

An exterior is not stored as an unstructured background image. Single-image exteriors only receive a constrained camera corridor. Multi-view images, video scans, and 360 assets may unlock wider camera movement according to reconstruction coverage.

### Master take

`MasterTake` is the single source of truth for both editing modes:

- Duration, aspect ratio, target Seedance profile, and delivery mode.
- Actor tracks: path, speed, pose/action events, gaze target, and semantic anchor bindings.
- Camera tracks: rig path, target path, height, orientation, focal length, focus target, and motion intent.
- Composition locks: subject screen region, required/forbidden anchors, horizon, depth ordering, and protected framing windows.
- Timeline keyframes and narrative beats that reference intervals of the same tracks.

Continuous blocking edits the track directly. Story-beat edits create or adjust keyframes in that same track. Neither mode owns duplicate actor or camera data.

### Delivery package

`SeedanceTakePackage` is generated from the canonical scene and take, never authored separately:

- Provider-normalized prompt and time-coded action/camera direction.
- Clean first, middle, and final composition frames with no UI labels.
- Required anchor reference sets, grouped by actor, environment, building, prop, and style.
- Provider-supported depth, segmentation, layout, motion, or video-reference derivatives only when the active capability accepts them.
- An explicit continuity handoff record for every chain boundary.
- Capability snapshot, estimated spend, and all user-accepted warnings.

## User Workflows

### 1. Ground the world

The user starts from generated assets, multi-angle images, a video scan, or a 360 source. Creator City builds an editable proxy world and shows coverage rather than pretending every unseen surface is reliable.

The user can drag ground, road, building, entrance, and occluder handles; connect zones; assign anchor names and source references; and lock the visible objects that must survive generation. A camera may only freely travel within verified coverage. Outside that area, the risk advisor explains the limitation without preventing a request.

### 2. Direct actors and camera

Selecting a camera reveals a compact local camera tool strip beneath its live camera preview, not a new global canvas navigation surface. The tools are `push/pull`, `pan/tilt`, `dolly`, `follow`, and `crane up/down`.

- Direct manipulation in the three-dimensional view remains the primary control.
- Push/pull moves the physical camera along its forward axis; focal-length zoom is a separate parameter.
- Pan/tilt manipulates the camera target ring.
- Dolly manipulates the lateral track.
- Follow binds a camera offset to an actor track while preserving user-editable distance, side offset, and height.
- Crane up/down manipulates the vertical camera track.

The live camera preview, camera frustum, path, keyframe time, and composition locks update together.

### 3. Edit a continuous take or beats

The user can choose either view at any time:

- **Continuous blocking** shows the full 5-180 second master timeline, all actor paths, camera path, and a live preview.
- **Story beats** marks intervals such as entry, follow, reveal, rise, transition, and exit. Beat edits preserve the same master coordinate space and update the continuous path immediately.

For takes longer than 30 seconds, the beat view is the preferred initial presentation but is never mandatory.

### 4. Generate directly or request a 30-second chain

The preflight resolves the current Seedance capability. If a requested 180-second direct take is unavailable, costly, queued, or otherwise high risk, the user receives a recommendation with the reasons and a choice to continue as requested or explicitly switch to a 30-second continuity chain.

On an approved chain, Creator City partitions the master take at authored or system-suggested handoff windows. It preserves the full master preview and shows segment boundaries without representing them as narrative cuts.

Every boundary exports a handoff packet with:

- Previous camera transform, lens, focus, velocity, and visible landmark set.
- Previous actor position, orientation, action state, and velocity.
- Required environment state and anchor visibility.
- The previous segment's last keyframe and, where supported, a short reference-video tail.
- Next segment's intended first composition and next motion interval.

### 5. Review and recover

Before payment, the user sees a non-blocking risk summary. It can flag unverified exterior coverage, missing landmark reference, camera movement outside a supported corridor, over-constrained reference inputs, unsupported duration, high estimated cost, or high queue time. The user may continue after acknowledgement.

After Seedance returns output, Creator City presents:

- The generated take or assembled chain beside the previsualization.
- Anchor, actor, camera, framing, and boundary comparison markers.
- A boundary-focused review for chained takes.
- A targeted regenerate action for an individual failed segment or handoff rather than the whole project.

## Risk Advisor Rules

The advisor gives evidence and a recommended remedy. It does not block submission.

| Condition | User-visible warning | Suggested remedy |
| --- | --- | --- |
| Camera enters unverified exterior | The requested viewpoint has no supported source coverage. | Keep the camera in the verified corridor or add source views. |
| Required anchor lacks reference | A locked building/prop has no direct visual reference. | Add a clean reference image or unlock the anchor. |
| Take exceeds active duration | The chosen Seedance profile does not expose this duration. | Continue with the current risk or confirm a 30-second continuity chain. |
| Chain boundary has drift | Camera, actor, or landmark state diverges across the handoff. | Adjust the boundary window or regenerate only the affected segment. |
| Provider reference budget exceeded | The package has more inputs than the target accepts. | Rank references, consolidate a contact sheet only when semantically safe, or change profile. |

## Provider Translation Rules

1. Use the real rendered composition frame and the exact asset references, not a text-only description of a building or actor.
2. Include depth, segmentation, motion, or layout derivatives only when the current Seedance profile supports them; unsupported controls must become visible warnings, not silently discarded data.
3. Preserve a provider-neutral internal package so future adapters can translate the same take without mutating the scene or master timeline.
4. Persist provider task IDs, returned media, capability snapshot, cost estimate, warnings, and user acknowledgements for comparison and recovery.

## Acceptance Criteria

### Authoring

- A user can build one continuous three-dimensional take up to the active duration ceiling and edit it in either continuous or beat view without duplicated motion data.
- Camera and actor edits update the live camera preview, spatial view, and timeline in the same interaction.
- A single-image exterior cannot be edited as an unconstrained 360-degree world.
- Required buildings, actors, and props can be anchored and locked to visual references.

### Seedance delivery

- The adapter resolves active Seedance capability before package construction.
- A direct long take and a confirmed 30-second chain are distinct, explicit delivery modes.
- The product never silently downgrades a requested long take to a chain.
- A chain carries the same master path and produces handoff records for every boundary.
- Unsupported provider controls are surfaced as warnings; submission remains user-controlled.

### Review

- Creator City can play the complete previsualization and the assembled generated result on a shared master timeline.
- Review identifies anchor, actor, camera, composition, and boundary deviations at concrete times.
- A user can regenerate only a failed segment after a chain has been created.

### Regression protection

- The director feature is additive and does not move, restyle, or alter confirmed canvas surfaces.
- Changes touching the current canvas must continue to satisfy the confirmed-experience declaration and registry checks.

## Verification Strategy

1. Unit-test the capability resolver, master-take/beat synchronization, take partitioner, handoff packet builder, and warning classification.
2. Render-test the camera local tool strip and confirm it remains local to the new director surface.
3. Browser-test direct camera manipulation, actor/camera synchronization, mode switching, explicit chain confirmation, non-blocking warning continuation, and targeted segment regeneration.
4. Contract-test Seedance requests against stored profile fixtures, including a 30-second profile and an entitled 180-second profile.
5. Run an end-to-end BYOK QA sequence against a manually selected Seedance test account before any production claim. Record the resulting previsualization-to-output deviations rather than asserting visual perfection.

## Non-goals

- Replacing Seedance or claiming a custom video foundation model.
- Promising pixel-identical output from a stochastic target model.
- Granting arbitrary camera movement outside available exterior source coverage.
- Changing the founder-approved canvas interaction or visual baseline.
- Supporting other providers in P0.
