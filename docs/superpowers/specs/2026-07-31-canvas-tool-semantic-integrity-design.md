# Canvas Tool Semantic Integrity A — Design

## Goal

Make canvas tool outcomes truthful and keep storyboard-grid output readable without changing Provider, generation, billing, persistence schema, or existing user annotation data.

## Scope

This first phase has three bounded outcomes:

1. Remove the legacy image-editor path that creates nodes marked complete without a real media asset or executed transform.
2. Place storyboard-grid cells by their persisted row and column, then avoid occupied canvas space.
3. Establish `AnnotationPanel` metadata as the canonical model for new visual annotations while retaining the existing scene-edit systems unchanged and readable.

## Non-Goals

- No migration, deletion, or rewrite of `SceneToolLayer`, `SceneToolPalette`, or `ImageEditStudio` data.
- No pixel transformation, video transformation, Provider call, `/api/generate/*` change, asset-transform enablement, or executor deployment.
- No Prisma, API, billing, credit, wallet, BYOK, environment, package, or Production database change.
- No tool-menu redesign beyond removing the unreachable legacy image-editor behavior.

## Design

### Truthful legacy-editor removal

`ImageEditorPanel` is a legacy side panel with no current activation call. Its callback manufactures image or video nodes with `status: 'done'`, `outputLabel: '<action> 已应用'`, and a textual preview rather than a persisted media result. That violates the product meaning of a completed node.

Remove the component import, `image-editor` active-panel state, `appliedImageEdit` state, render branch, and `handleApplyImageEdit` callback from `VisualCanvasWorkspace`. Remove the now-unused `ImageEditorPanel` source file. Existing nodes and their stored metadata are not touched. The active, separately-modelled annotation and scene-edit tooling remains intact.

### Grid-cell placement

Extract a pure placement helper in `apps/web/src/lib/canvas/` that accepts the source bounds, a grid cell's `row` and `col`, the cell node size, and occupied node bounds. It must:

1. Start the grid to the right of the source node.
2. Compute horizontal placement from `col` and vertical placement from `row`.
3. Resolve collisions against current nodes using the same 24px-safe overlap rule as the workspace.
4. Return deterministic coordinates without modifying input bounds.

`handleCreateStoryboardGridCellNode` will call the helper immediately before `createNode`. Each resulting node remains an asset-derived `done` image only because the upload flow has already persisted the cropped cell and supplies its `assetId` and `assetUrl`.

### Canonical annotation boundary

New visual annotation work continues through `AnnotationPanel` and `mergeAnnotationMetadata`. This phase records the boundary in implementation comments/tests only; it does not reinterpret or merge legacy scene-edit payloads. A later dedicated compatibility phase may define an adapter after inspecting real saved data.

## Error and Compatibility Rules

- If a source node cannot be found, grid-cell creation continues to return `null` and creates nothing.
- If occupied space conflicts with the intended grid position, the helper moves the candidate down in deterministic increments before trying the next column offset.
- Removing the unreachable image-editor path must not alter existing stored nodes, scene edits, annotations, or asset records.
- No new completed node may be created by a textual-only image-edit action.

## Test Plan

1. Add pure placement tests proving cells in the same row but different columns get different X coordinates for 2x2 and 3x2 grids.
2. Add collision tests proving occupied bounds force a non-overlapping deterministic result.
3. Add a static boundary test proving `VisualCanvasWorkspace` no longer imports/renders `ImageEditorPanel` or contains its fake-completion callback strings.
4. Run the existing storyboard split, annotation, toolbar, type-check, lint, build, diff-check, and targeted browser QA suites.

## Acceptance Criteria

- A 2x2 and 3x2 split produces distinct, non-overlapping child-node positions for every cell.
- Existing nodes are avoided during child-node placement.
- No reachable code path can create a `done` image/video node from `图片编辑器节点`, `姿势生成器`, `涂鸦生图`, or `涂鸦生视频` without a real result asset.
- Existing annotation metadata and scene-edit data are neither changed nor deleted.
- No Provider, generation, billing, credit, wallet, schema, API, executor, package, env, or Production DB behavior changes.
