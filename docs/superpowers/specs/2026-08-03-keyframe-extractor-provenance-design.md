# Keyframe Extractor Provenance Design

## Goal

Strengthen the existing Canvas Keyframe Extractor so every image or video draft
created from a selected video frame carries truthful, machine-readable evidence
of where that reference came from. The tool remains local-first: it does not
generate media, upload a browser frame, create an Asset, or call a Provider.

## Scope

This is an enhancement of the existing `KeyframeExtractorPanel`, not a new
tool. The current image-reference and video-continuation draft actions remain
available. The source video node and its existing Asset remain immutable.

In scope:

- A versioned `metadataJson.keyframeExtraction` record on each created draft.
- Explicit Canvas edge metadata and label for a keyframe-derived draft.
- Honest evidence states for a local browser preview, a time-point-only
  reference, a CORS restriction, and a video preview failure.
- Focused tests for metadata construction, result-quality summaries, and
  component behavior.

Out of scope:

- Persisting a base64 frame in Canvas data.
- Uploading, converting, or creating a derived Asset from the browser frame.
- Server-side ffmpeg extraction, a new API route, Provider calls, BYOK changes,
  billing, payment, schema, environment, or Production database work.

## Data Contract

New draft nodes receive the following object under `metadataJson`:

```ts
{
  keyframeExtraction: {
    version: 1,
    sourceNodeId: string,
    sourceAssetId?: string,
    sourceVideoUrlAvailable: boolean,
    selectedTimeSeconds: number,
    selectedTimeLabel: string,
    evidenceKind: 'browser-frame-preview' | 'time-point-reference',
    previewStatus: 'available' | 'not-extracted' | 'cors-restricted' | 'video-unavailable',
    createdAt: string,
  },
}
```

`sourceAssetId` is present only when the source video is already associated with
an Asset. `browser-frame-preview` means a frame was successfully drawn in the
current browser session; it never means the frame was saved or uploaded.
`time-point-reference` means the draft truthfully references the selected video
and timestamp without a local frame preview.

The edge from the source video to the new draft uses a stable tool identity:

```ts
{
  edgeLabel: '关键帧参考',
  edgeToolId: 'keyframe-extractor',
  edgeToolIcon: '🎞',
}
```

## User Flow

1. The user opens **关键帧提取** from a selected video node's Asset menu.
2. They choose a video and a timestamp. The video keeps metadata preload and
   only renders when the panel is opened.
3. They may preview a browser frame. If cross-origin rules prevent this, the
   panel shows a CORS-restricted state and still permits a timestamp-only
   reference.
4. They explicitly choose **创建图片节点草案** or **创建视频续作节点草案**.
5. Canvas creates an idle draft node, an annotated edge, and the provenance
   record. No generation occurs.
6. The panel confirms exactly what exists: a draft and its evidence, never a
   persisted image Asset or a generated result.

## UI And Result Semantics

The existing result-quality strip remains the single status surface.

| Condition | Status | Required wording |
| --- | --- | --- |
| Successful browser canvas extraction | Preview | Local frame preview is available in this browser only. |
| No extraction yet | Not started | A selected timestamp can still be used as a reference. |
| CORS prevents canvas extraction | Limited | The draft will reference the timestamp only; no local frame was saved. |
| Video cannot load | Failed | The video preview is unavailable; do not claim frame evidence. |
| Draft created after local extraction | Created | Draft has browser-frame-preview provenance; preview is not an Asset. |
| Draft created without a local frame | Created | Draft has time-point-reference provenance. |

No status can say that an image was generated, saved to Assets, uploaded, or
persisted merely because a draft node exists.

## Architecture

`KeyframeExtractorPanel` owns the ephemeral browser-only state: selected node,
timestamp, local data URL, and preview failure state. It converts that state to
a small provenance payload only at the explicit draft-creation boundary.

`VisualCanvasWorkspace` continues to own node and edge creation. It receives
the provenance as `metadataJson` and passes the keyframe edge identity through
the existing `createNode` options. This reuses Canvas' established cloud/local
persistence mapping without adding a second store.

`keyframeQuality` receives evidence metadata rather than inferring a saved
Asset. It can render exact language for each condition and be tested without a
video or network fixture.

## Error Handling

- A cancelled extraction cannot attach stale evidence to a newly selected
  video; the existing extraction token guard remains mandatory.
- A CORS error clears local-frame state and produces `time-point-reference`.
- A video load error prevents any claim of a browser-frame preview.
- Missing source nodes or a blank timestamp prevent draft creation.
- Existing historical nodes without `keyframeExtraction` remain valid; the new
  field is additive and optional.

## Testing

1. Add RED tests for the `keyframeExtraction` data contract for image and video
   drafts, including optional source Asset IDs.
2. Add tests for all preview/evidence states and truthful result-strip text.
3. Add browser-component tests proving that CORS and video errors create no
   false browser-frame claim and that a selection switch ignores stale work.
4. Run targeted Canvas tool-result and render/save scheduling tests, then
   `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check`.
5. Browser QA uses a disposable Preview video node only. It must verify that
   no `/api/generate/*`, Provider, payment, billing, wallet, or credit mutation
   occurs. Production is read-only unless a separate Founder authorization is
   granted.

## Acceptance Criteria

- Both draft actions preserve the source video and create one correctly labelled
  edge with `keyframe-extractor` identity.
- New drafts hold the version-1 provenance object with a truthful evidence
  kind and preview status.
- A CORS restriction still supports a clearly labelled timestamp-only draft.
- No base64 frame is written to project data and no Asset is claimed or created.
- All focused, type, lint, build, diff, and permitted browser checks pass.
