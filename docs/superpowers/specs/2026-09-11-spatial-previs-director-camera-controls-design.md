# Spatial Previs Director Camera Controls Design

**Status:** Founder-approved interaction direction, pending written-spec review

## Goal

Extend the existing Spatial Previs whitebox workspace with a compact director
operation layer. The creator must be able to set a useful camera-language
baseline, then directly refine actor and camera relationships in one shared 3D
world. The result remains a provider-neutral previs node and preview export;
the normal workflow must not expose or automatically dispatch to a third-party
video model.

This design is additive to the 2026-09-10 Spatial Previs whitebox design and
the confirmed canvas experience locks. It must not resize, restyle, or otherwise
alter previously accepted canvas nodes, prompt surfaces, context menus, or
tool layouts.

## Workspace Structure

The Spatial Previs header contains only these compact groups:

1. Product and workspace identity.
2. Primary mode navigation: Director and Aerial.
3. Master-take duration.
4. Output actions: Generate previs node and Export video.

The 3D whitebox remains the visual center. A small director toolbar sits in
the upper-left of the whitebox; the compact baseline-motion dock sits in the
upper-right. A synchronized live camera viewport stays inside the world at the
lower-right. The lower surface is a thin two-track curve timeline, not a
separate configuration panel.

## Shared 3D World

- The world renders physical proxy walls, openings, terrain/building volumes,
  furniture volumes, a 3D actor proxy, and a physical camera rig.
- Blue points/lines represent the actor route. Yellow points/lines represent
  the ground camera route.
- The route points are selectable, directly draggable 3D keyframes. Dragging
  a point updates the related route, the live camera view, and the time-track
  projection in the same interaction.
- Ground route points remain a clear timing/relationship visualization even
  when the camera rig is raised above the ground.
- The live camera view is the actual active camera, not a decorative image.

## Camera Transform Editing

### Direct 3D camera controls

The director toolbar adds two compact icon controls:

- Camera position and height selects the active camera rig and reveals a
  standard transform gizmo with red X, green Y, and blue Z translation axes.
- Camera angle switches the same gizmo to rotation rings.

The controls are direct-manipulation tools, not a replacement for the
existing motion presets.

### Translation behavior

- Dragging X or Z repositions the camera in the shared world.
- Dragging the green Y axis changes camera height without changing X/Z.
- The selected camera keyframe stores the updated position and height.
- During a transform drag, playback pauses so the creator adjusts a stable
  time position.
- The live camera view, yellow relation line, visible rig, and current
  camera-keyframe state update together.

### Rotation behavior

- Rotation rings directly set camera yaw, pitch, and roll.
- The active camera orientation is persisted on the selected keyframe.
- The live camera view uses that orientation immediately.
- Returning to an ordinary selection tool hides and detaches the gizmo, but
  preserves its last transform.

### Camera keyframe schema

Every camera keyframe must be able to hold:

~~~ts
{
  timeSec: number;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
  targetId?: string;
  focalLengthMm: number;
  shotScale: ShotScale;
  motionBaseline?: MotionBaseline;
}
~~~

Existing saved camera keyframes normalize to a valid ground-level position,
neutral rotation, 35mm, and the current default shot scale without losing
their existing path or target values.

## Camera Language

### Baseline motions

The compact baseline dock provides Push, Pull, Pan, Move, Follow, Rise, and
Fall.

Selecting one applies a non-destructive starting relationship to the active
camera segment. It never locks the creator into a preset: the creator can
then edit each camera keyframe, height, target, and rotation directly in the
3D world.

Push/Pull describe physical camera movement. Lens focal length is independent
and must never be silently changed by a motion baseline.

### Lens and shot scale

The dedicated lens icon toggles a compact popover for the active segment.

Shot-scale choices are extreme close-up, close-up, near, medium close, medium,
medium-wide, wide, long, extreme long, and establishing shot.

Common focal lengths are grouped without hiding options:

- Ultra-wide: 8, 10, 12, 14, 16, 18 mm
- Wide: 20, 21, 24, 25, 28, 32 mm
- Standard: 35, 40, 45, 50 mm
- Medium telephoto: 65, 75, 85, 100, 135 mm
- Telephoto: 150, 180, 200, 300, 400, 600 mm

The creator can enter an explicit value from 8 to 600 mm. Lens and shot-scale
changes update the live camera view and the active camera keyframe only.

## Duration and Playback

The master-take duration selector offers 5, 10, 15, 30, 45, 60, 90, 120, and
180 seconds.

180 seconds is the maximum selectable duration in this phase. Changing
duration updates timeline tick labels and remaps keyframe time positions
proportionally; it does not delete actor or camera keyframes.

Playback advances both actor and camera tracks, the 3D world, the live camera
view, and the current playhead in lock step. Playback is paused while a
camera transform gizmo is actively used.

## Aerial Mode

Aerial is a first-level navigation mode beside Director; it is not another
ground-camera preset.

- Aerial mode uses its own camera-height/flight-route baseline and displays
  an aerial live camera label.
- It does not overwrite ground-camera paths, ground-camera transforms, or
  actor tracks.
- The same lens, shot-scale, duration, direct transform, and output actions
  apply in aerial mode.
- Aerial capability is a creative planning mode. It does not claim automatic
  flight safety, legal clearance, or a survey-accurate terrain model.

## Floating Surface Rule

Every toolbar or header popover follows one rule:

1. Clicking its own icon toggles it open or closed.
2. Opening another floating surface closes the previous one.
3. Clicking the canvas, a different navigation item, a motion preset, or any
   non-owned area closes it.

This applies to lens settings, duration selection, and future compact
director-tool popovers. It does not dismiss a transform gizmo mid-drag.

## Output Actions

### Generate previs node

Generate previs node serializes the active whitebox, asset references, actor
and camera tracks, transforms, lens/shot settings, motion-baseline labels,
and master-take duration into the existing provider-neutral previs delivery
node.

The operation must provide a visible result state and preserve source-asset
attribution. It does not submit an external video-generation request.

### Export video

Export video exports the currently selected previs playback/preview using the
existing export infrastructure. The UI may present an asynchronous progress
state, but it must not falsely report success before an export artifact exists.
Exporting does not mutate the saved direct-manipulation draft.

## Non-goals

- No automatic external model selection or dispatch.
- No claim of photogrammetric accuracy or autonomous drone flight safety.
- No redesign of locked canvas, node, prompt, or context-menu experiences.
- No change to existing account, BYOK, generation, asset upload, save, or
  playback behavior outside Spatial Previs.

## Verification

1. Unit tests cover duration remapping; normalization of legacy camera
   keyframes; lens/focal validation; ground versus aerial track isolation; and
   serialization of camera position, height, and rotation.
2. Viewport tests use real pointer sequences to prove X/Y/Z translation and
   rotation-ring edits update the selected keyframe and live camera state.
3. Component tests prove each floating surface toggles from its own trigger,
   closes from another trigger, and closes on an outside interaction.
4. Browser tests cover all motion baselines, focal/shot-scale selection,
   180-second duration, aerial/ground switching, direct camera transform,
   node generation request, and export request state.
5. Desktop/mobile visual QA confirms the Three.js world is nonblank, the
   gizmo is correctly attached to the camera, the live view reflects
   transforms, and no locked canvas surface moved.
6. Manual preview QA uses a test project and mocked export data unless the
   founder explicitly authorizes a real export.

## Acceptance Criteria

- The creator can flexibly translate, raise/lower, and rotate a selected
  camera in the whitebox without relying on buttons for every adjustment.
- Camera transform edits persist on the active keyframe and update the live
  camera view immediately.
- The creator can select all listed shot scales, focal lengths, and a custom
  8-600 mm value.
- The duration selector accepts a master take up to 3 minutes and preserves
  existing keyframes.
- Ground and aerial camera plans coexist without overwriting one another.
- All floating surfaces toggle and dismiss consistently.
- A previs node and a video export can be requested without automatic
  third-party dispatch.
- Existing locked canvas behavior remains unchanged.
