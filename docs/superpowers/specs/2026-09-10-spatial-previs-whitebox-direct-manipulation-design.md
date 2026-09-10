# Spatial Previs Whitebox and Direct Manipulation Design

**Status:** Founder-approved design pending written-spec review

## Goal

Evolve Spatial Previs into a real shared 3D previs workspace. A creator brings
project assets or reference images/video into a compact scene entry, receives an
editable whitebox proxy, directly blocks actors and camera moves with the mouse,
and creates a provider-neutral previs delivery node for download or the existing
asset library.

The normal workspace must not name or immediately send to a third-party video
model.

## Experience Locks

This is an additive Spatial Previs tool. It must not alter the accepted canvas
node/editor proportions, node navigation, prompt-editor fixed surfaces, resize
behavior, or canvas context menus in
`docs/superpowers/specs/2026-09-09-confirmed-experience-locks-design.md`.

Existing Spatial Previs button controls remain available as a collapsed
"Fine tune" fallback. They are not the primary way to block a scene and their
current behavior does not change.

## User Flow

1. The creator opens Spatial Previs and uses the compact top-level `+ Scene
   assets` entry. They can select existing project assets or drop images/video
   into the entry or the 3D viewport.
2. The tool creates an editable whitebox draft from those references: floor,
   walls, door openings, building volumes, furniture volumes, and reference
   planes. It must label this as a proxy scene, not a surveyed reconstruction.
3. The creator blocks actor and camera directly in the shared 3D world while
   viewing the same physical camera on the right-hand live camera viewport.
4. The creator confirms the previs. The canvas receives a `Previs delivery
   node`, which can be downloaded as a package or saved through the existing
   asset-library path. External-model dispatch remains an optional, separate,
   explicitly chosen delivery action.

## Whitebox Scene Entry

### Compact top entry

- The Spatial Previs header shows one compact `+ Scene assets` control.
- The control accepts click-to-select, project-asset selection, and drag/drop.
- Once populated it shows only the active scene name and asset count. It does
  not leave a large asset panel in the previs workspace.
- The user can reopen it to add, remove, or change references.

### Proxy generation contract

- References produce editable proxy entities, not a claim of exact geometry.
- Each entity has a type (`floor`, `wall`, `opening`, `volume`, `furniture`, or
  `referencePlane`) and source-reference attribution.
- The user may reposition, resize, or delete proxy entities before blocking.
- A single photo can create a conservative starting layout. Multi-angle images
  or video can add reference planes and suggested volumes; they do not silently
  become a precise world reconstruction.
- Generation errors keep references intact and show a recoverable message;
  they never replace an existing whitebox with an empty scene.

## Direct 3D Blocking

### Object model

- Actors, camera rigs, camera targets, and whitebox entities are selectable 3D
  objects in one coordinate space.
- Actors and cameras are independent by default. No automatic follow relation
  is created unless the creator explicitly adds one later.
- The overview view renders physical whitebox walls/volumes, a 3D actor proxy,
  and an actual camera rig/frustum. It is not a 2D route diagram.

### Mouse behavior

- Clicking an actor or camera selects it. A selected object gets a subtle
  outline and cursor feedback only; permanent square handles are prohibited.
- Dragging an object body moves it on the ground plane.
- Selecting an object temporarily reveals a thin vertical guide; dragging that
  guide changes height without changing its scale.
- Selecting an actor exposes a small facing target. Dragging that target sets
  the actor's facing direction.
- Selecting a camera exposes a camera target. Dragging the target changes pan
  and tilt. Dragging the camera along its view axis creates a dolly push or
  pull; dragging across the ground creates a move; the vertical guide creates
  rise or fall.
- A drag creates or updates the selected object's keyframe at the current
  playhead time. The live camera viewport, frustum, route preview, and timeline
  update in the same interaction.
- Existing named controls (`push/pull`, `pan/tilt`, `move`, `follow`,
  `rise/fall`) remain in the collapsed Fine tune surface for keyboard access
  and exact numeric adjustment.

## Dual Viewport

- The left viewport is the editable free-observation whitebox world.
- The right viewport renders the exact same camera rig at the playhead: actor
  placement, occlusion, lens/focal setting, camera height, and time readout
  are synchronized.
- Playback advances actor/camera keyframes and updates both viewports in lock
  step. The camera viewport is evidence of what the planned shot sees, not a
  decorative preview.

## Provider-neutral Previs Delivery Node

- The normal confirmation action is `Create previs delivery node`.
- The node package includes whitebox proxy entities, asset references, actor
  and camera tracks, camera targets, keyframes, master-take duration, and beat
  metadata.
- The user can download the package or save it through the existing asset
  library. Both actions must preserve source-asset attribution.
- Third-party model names and dispatch controls do not appear in the normal
  Spatial Previs composition flow. Existing guarded delivery implementation is
  retained behind an explicit secondary delivery action and is not changed by
  this phase.

## Persistence and Recovery

- Whitebox entities, references, selection-independent tracks, and delivery
  package metadata extend the current `spatialPrevisMetadata` state without
  changing existing saved Spatial Previs data semantics.
- Existing saved previs records normalize to an empty whitebox/reference state
  and remain editable.
- Save conflicts and upload failures preserve local draft state and provide a
  retry path. No direct external generation or asset-library write occurs in
  recovery tests.

## Non-goals

- This phase does not claim photogrammetric accuracy or full automatic 3D
  reconstruction from arbitrary media.
- It does not remove or restyle previously confirmed canvas UI.
- It does not automatically submit work to a video provider.
- It does not bind a generated character asset to the actor rig yet; the first
  actor is a neutral 3D proxy with a later asset-binding extension point.

## Verification

1. Focused unit tests cover normalization of references/whitebox entities and
   package serialization.
2. Viewport tests prove actor, camera, target, and vertical direct-manipulation
   drags create/update the current keyframe and leave control font sizing
   unchanged.
3. Browser tests cover project-asset selection, drag/drop entry, proxy creation,
   direct object manipulation, synchronized camera view, canvas-node creation,
   package download trigger, and asset-library save request with mocked data.
4. Locked canvas regression tests remain green.
5. Desktop and mobile visual QA confirms nonblank Three.js canvases and that no
   existing node/editor or context-menu layout moved.
6. Manual preview QA uses an isolated test project and does not submit an
   external generation or write a creator's actual library record.

## Acceptance Criteria

- A creator can enter scene references from the top `+ Scene assets` affordance
  without a persistent asset side panel.
- A visible, editable 3D whitebox world contains a 3D actor and physical camera
  rig.
- The creator can set blocking and camera language through direct mouse
  interaction at the timeline playhead, while the live camera view synchronizes.
- Confirmation produces a neutral previs delivery node with download and asset
  library routes, without showing a third-party model in the primary flow.
- All confirmed canvas experiences remain unchanged.
