# Spatial Previs: Asset-To-Whitebox Design

## Status

Approved design. This document defines the next implementation slice only; it does not authorize changes to locked canvas or dialog layouts.

## Goal

Let a creator use existing Creator City assets or newly uploaded scene references to construct a shared, editable three-dimensional whitebox. The creator then directly positions characters and cameras in that world, previews the actual camera view, and creates a short 5–10 second internal previs test result.

The result is a Creator City node and optional asset-library item. This workflow does not force the creator to select a third-party model.

## Locked Boundaries

- Do not alter accepted canvas, node, dialog, resize, navigation, or context-menu behavior.
- Do not replace the accepted shared-world plus live-camera-view interaction with flat routes, line diagrams, or form-only controls.
- Do not block a creator because scene reconstruction is uncertain or an asset is incomplete. Show a concise warning and preserve manual editing.
- Preserve existing generation, BYOK, upload, script-application, and saving behavior.

## Entry And Asset Inputs

1. The top asset strip uses the existing asset library as its default source.
2. A parallel upload action accepts a single image, multi-angle image group, or video reference.
3. The creator selects one scene asset set and may add character, prop, and reference assets without leaving the previs workspace.
4. Each selected source keeps provenance: asset id, source type, and grouping. A generated whitebox never replaces the source asset.

## Shared Three-Dimensional World

The workspace renders one Three.js scene containing all spatial entities:

- Whitebox entities: floor, walls, doors/openings, furniture, props, and exterior reference landmarks.
- Characters: visible three-dimensional stand-ins rather than icons, lines, or 2D cards.
- Cameras: visible three-dimensional camera rigs with transform handles and a frustum.
- Paths: editable character and camera paths with action points for entry, stop, turn, look-at, and exit.

The overview viewport supports free observation and direct selection. The camera viewport renders through the selected camera, from the same scene and at the same instant.

## Direct Manipulation

- Dragging a character changes its world transform and its blocking path; it does not change button or text size.
- Dragging a camera rig changes position and orientation. Its frustum and live camera image update together.
- Camera actions `推`, `拉`, `摇`, `移`, `跟`, `升`, and `降` are compact tools, not a replacement for pointer manipulation. Selecting one prepares or edits the corresponding camera trajectory.
- The creator may edit whitebox geometry after automatic reconstruction so actual scene structure remains understandable and controllable.

## Whitebox Reconstruction

1. The selected asset set is normalized into a scene-input record.
2. The reconstruction step produces named whitebox entities and confidence metadata.
3. Low-confidence structure is visually marked and remains editable. It is a warning, not a gate.
4. Character and camera placeholders enter the same coordinate system only after the scene exists.

For P0, generated and uploaded assets may use a deliberately simple whitebox. The goal is usable blocking and camera language, not photorealistic mesh reconstruction.

## Test Delivery

1. The creator selects a 5–10 second test duration.
2. The workspace serializes scene entities, actor paths, camera path, lens, timing, and source-asset references into a previs delivery request.
3. The internal test returns a result record with preview media, input snapshot, and status.
4. A completed result materializes as a Creator City result node. The creator can download it or save it to the asset library.
5. A failed test retains the editable spatial setup and provides a retry path plus any non-blocking input warning.

## Persistence

Persist one spatial-previs draft per owning project, including:

- scene input and source-asset references;
- whitebox entity transforms and metadata;
- actor and camera transforms, paths, timing, lens, and action modes;
- selected camera and preview duration;
- delivery request and result linkage.

The draft must be user/project isolated. It must never infer ownership from an email address or migration history.

## Acceptance Criteria

1. A creator can open the previs workspace from an existing asset and see it represented as three-dimensional whitebox entities.
2. The same view visibly contains three-dimensional scene objects, a character, a camera rig, and its frustum.
3. Dragging a character or camera changes the shared overview and the live camera viewport together.
4. All seven camera-language tools update the camera trajectory, frustum, and live view consistently.
5. The default asset source is the existing asset library; uploads remain available for image, image-group, and video references.
6. The creator can run a 5–10 second test without selecting a third-party provider in this workspace.
7. A successful test becomes a result node and can be downloaded or added to the asset library.
8. Uncertain reconstruction and failed tests warn without blocking manual editing, retry, or saving.
9. Existing locked canvas and dialog behavior remains covered by the existing lock verification.

## Verification Plan

- Unit tests: scene-input normalization, reconstruction result handling, transform/path updates, and delivery payload creation.
- Component tests: direct actor/camera manipulation updates the live camera state and keeps interaction scoped to the previs workspace.
- Browser tests: desktop and mobile render two nonblank WebGL canvases; camera and character are visible three-dimensional objects; drag actions update overview and camera output.
- Integration tests: selected library assets retain provenance through draft save, test dispatch, result-node materialization, and optional library save.
- Regression checks: type-check, targeted test suite, production build, and confirmed-experience lock verifier.
