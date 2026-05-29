# Image-to-Video Workflow

## Overview

When a Video node has an upstream Image node connected via a canvas edge, the video generation automatically switches from text-to-video to image-to-video mode. The upstream image URL is resolved and passed as `imageUrl` in the video generation request.

## How It Works

### Edge-based resolution

`resolveImageInputForVideoNode` (in `src/lib/workflow/resolveNodeInputs.ts`) is a pure function that:

1. Finds all edges where `toNodeId === videoNode.id`
2. Filters for upstream nodes where `kind === 'image'`
3. Extracts the best available URL from the first connected image node

### URL priority order

```
stableUrl (metadataJson)
> resolvedUrl (metadataJson)
> assetUrl (metadataJson)
> resultImageUrl (node field)
> imageUrl (metadataJson)
> providerOriginalUrl (metadataJson)
> mediaPersistence.stableUrl (metadataJson)
> mediaPersistence.resolvedUrl (metadataJson)
```

Only `https://` URLs are accepted. `data:` URIs and empty strings are rejected.

### UI states in the prompt dialog

| State | Condition | Display |
|-------|-----------|---------|
| 图生视频 | Upstream image node with resolved URL | Blue bar, thumbnail, source node title |
| 参考图缺失 | Upstream image node exists but no URL yet | Orange warning bar |
| 文生视频 | No upstream image node connected | Gray bar |

### Payload

When `imageUrl` is resolved, `callGenerationApi` includes it in the video POST body:

```json
{
  "prompt": "...",
  "providerId": "...",
  "aspectRatio": "16:9",
  "duration": 5,
  "projectId": "...",
  "workflowId": "...",
  "nodeId": "...",
  "imageUrl": "https://oss.example.com/stable.jpg"
}
```

`imageUrl` is omitted entirely when there is no upstream image (text-to-video path).

## Backend compatibility

The full stack already supports `imageUrl` with no changes required:

- `/api/generate/video/route.ts` — `VideoGenerateBody` has `imageUrl?: string`; calls `firstImageInput()` and `assertProviderReadableImageUrl()`
- `apps/cn-executor/src/runners/videoJobRunner.ts` — reads `input.imageUrl` and passes to provider
- `apps/cn-executor/src/providers/volcengine/seedance.ts` — builds `image_url` content block for Seedance

## Files

| File | Role |
|------|------|
| `src/lib/workflow/resolveNodeInputs.ts` | Pure resolution function + types |
| `src/lib/workflow/resolveNodeInputs.test.ts` | 8 unit tests (node:test) |
| `src/components/create/VisualCanvasWorkspace.tsx` | videoModeInfo useMemo + imageUrl injection in handleNodeDialogGenerate |
| `src/components/create/CanvasPromptBox.tsx` | VideoModeInfo type + mode bar JSX |
| `src/components/create/canvas.module.css` | .canvas-video-mode-bar styles |

## Constraints

- v1 uses only the **first** connected upstream image node
- Non-image upstream nodes (text, video) are ignored
- If upstream image has no URL yet, generation falls back to text-to-video (not blocked)
- Backend validation (`assertProviderReadableImageUrl`) is the final safety gate
