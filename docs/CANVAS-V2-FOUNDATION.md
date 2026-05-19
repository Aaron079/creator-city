# Canvas V2 Foundation

Canvas V2 is the next-generation workflow canvas for Creator City, built on `@xyflow/react`. It lives at `/create-v2` and is entirely separate from the legacy canvas at `/create`.

---

## 1. Why @xyflow/react

| Concern | Decision |
|---|---|
| Node drag & drop | Built-in with `useNodesState` |
| Edge connections | Built-in with `addEdge`, `onConnect` |
| Minimap, Controls | Built-in components |
| Custom node rendering | `nodeTypes` map — full React JSX |
| Performance | Virtualized rendering, stable IDs |
| Viewport control | `useReactFlow()` for `getViewport`, `fitView` |

---

## 2. Canvas V2 vs Old Canvas

| | `/create` (old) | `/create-v2` (new) |
|---|---|---|
| Rendering library | Custom SVG | @xyflow/react |
| Components path | `src/components/create/` | `src/components/create-v2/` |
| Page path | `src/app/create/` | `src/app/create-v2/` |
| Adapter | None | `src/lib/canvas-v2/canvasV2Adapter.ts` |
| API | Same `/api/projects/[id]/canvas` GET/PUT | Same |
| DB schema | Shared `CanvasWorkflow`, `CanvasNode`, `CanvasEdge` | Shared |

The two canvases share the same backend API and database. Canvas V2 reads and writes the same records via the existing canvas API.

---

## 3. Node Data Structure

```typescript
type CanvasV2NodeData = {
  nodeId: string                          // Unique node ID, matches ReactFlow node.id
  kind: 'text' | 'image' | 'video' | 'asset' | 'generation'
  title?: string                          // Human-readable label
  prompt?: string                         // Generation prompt
  status?: 'idle' | 'running' | 'succeeded' | 'failed'
  
  // Regional execution
  providerRegion?: 'cn' | 'global'        // Where the AI provider runs
  executionRegion?: 'cn' | 'global'       // Where the executor runs
  storageRegion?: 'cn' | 'global'         // Where the result is stored
  executorKind?: 'aliyun_fc' | 'vercel' | string  // Which executor handled it
  
  // Provider
  providerId?: string                     // e.g. 'volcengine-seedream-image'
  
  // Results
  resultImageUrl?: string
  resultVideoUrl?: string
  thumbnailUrl?: string
  assetId?: string                        // Linked Asset record ID
  
  // Job tracking
  generationJobId?: string                // GenerationJob.id from DB
  
  // Errors
  errorMessage?: string
  errorCode?: string
  upstreamMessage?: string               // Raw error from upstream provider
  
  // Context
  workflowId?: string
  projectId?: string
  metadataJson?: Record<string, unknown>  // Extra metadata stored in DB
  paramsJson?: Record<string, unknown>    // Model parameters stored in DB
}
```

---

## 4. Save / Load Flow

```
User opens /create-v2?projectId=XYZ
         |
         v
CanvasV2Workspace mounts
         |
         v
GET /api/projects/XYZ/canvas
  - Auth: session cookie
  - Returns: { workflow: { id }, nodes: [...], edges: [...] }
         |
         v
canvasNodesToFlowNodes(nodes)      <- adapter converts DB shape -> ReactFlow
canvasApiEdgesToFlowEdges(edges)   <- adapter converts DB shape -> ReactFlow
         |
         v
setNodes / setEdges -> ReactFlow renders
fitView() -> viewport adjusts

--- User Interaction ---

User moves node / edits prompt / adds node
         |
         v
scheduleSave() (debounce 1000ms)
         |
         v (after 1s idle)
saveCanvas(currentNodes, currentEdges)
         |
         v
flowNodesToCanvasNodes(nodes, workflowId, projectId)
flowEdgesToCanvasEdges(edges)
         |
         v
PUT /api/projects/XYZ/canvas
  body: { workflowId, nodes: [...], edges: [...] }
         |
         v
DB upsert via Prisma (parallel, non-transactional)
```

---

## 5. Canvas V2 项目绑定规则

1. `/create-v2?projectId=xxx` 是正式项目画布。Canvas V2 必须通过该 `projectId` 加载、保存、生成并写回同一项目下的 `CanvasWorkflow` / `CanvasNode` / `CanvasEdge`。
2. `/create-v2` 无 `projectId` 是临时画布，只能编辑，不能生成。Image / Video / Generation 节点的生成按钮必须禁用，并提示 `canvas_v2_project_required`。
3. 生成前必须有 `projectId`。生成请求还必须携带同一上下文中的 `workflowId`、`nodeId`、`prompt`、`providerId`、`providerRegion`、`executionRegion`、`storageRegion`、`executorKind`、`aspectRatio`、`resolution`。
4. `/create` 的 Canvas V2 Beta 入口必须携带当前真实 `projectId`，优先使用 URL `projectId`，其次使用当前项目状态；拿不到项目时不能跳进可生成流程。
5. 后续可以支持“从临时画布创建项目”，将临时节点迁移到新项目后再开启生成。

---

## 6. Inspector Panel Fields

| Field | Editable | Description |
|---|---|---|
| kind | No (badge) | Node type |
| status | No (badge) | Current execution status |
| executorKind | No (badge) | Which runtime handled generation |
| title | Yes | Display name |
| prompt | Yes | Generation prompt text |
| providerRegion | No | AI provider region |
| executionRegion | No | Executor region |
| storageRegion | No | Storage region |
| executorKind | No | aliyun_fc or vercel |
| generationJobId | No | Job tracking ID |
| assetId | No | Linked asset ID |
| errorCode | No | Machine-readable error code |
| errorMessage | No | Human-readable error |
| upstreamMessage | No (collapsible) | Raw provider error |
| resultImageUrl | No (preview) | Generated image |
| resultVideoUrl | No (preview) | Generated video |

**Buttons:**
- 保存节点 — saves title + prompt edits, closes inspector
- 生成 — calls `/api/generate/image` or `/api/generate/video`
- 复制诊断 JSON — copies full node data to clipboard
- 删除节点 — removes node (2-click confirmation)

---

## 7. Regional Execution Fields

Creator City supports dual-region AI execution:

| Field | Values | Meaning |
|---|---|---|
| `providerRegion` | `cn` / `global` | Where the AI model runs |
| `executionRegion` | `cn` / `global` | Where the serverless function runs |
| `storageRegion` | `cn` / `global` | Where result files are stored |
| `executorKind` | `aliyun_fc` / `vercel` | Which function runtime handled the request |

CN execution uses Aliyun Function Compute (`aliyun_fc`) with Volcengine AI models.
Global execution uses Vercel Edge Functions.

The node card shows region badges and an executor badge (🔴 CN FC or 🔵 Vercel).

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected nodes/edges (not in input) |
| `Cmd/Ctrl+S` | Manual save |
| `Cmd/Ctrl+D` | Duplicate selected node |
| `Esc` | Deselect / close inspector |
| Double-click node | Open inspector |

---

## 9. File Structure

```
apps/web/src/
  app/create-v2/
    page.tsx                    # Server component, passes projectId/workflowId
  components/create-v2/
    CanvasV2Workspace.tsx       # Main canvas, load/save/shortcuts
    CanvasV2Node.tsx            # Custom node card component
    CanvasV2Inspector.tsx       # Right-side property inspector
    CanvasV2Toolbar.tsx         # Left-side node type toolbar
  lib/canvas-v2/
    canvasV2Adapter.ts          # Convert DB records <-> ReactFlow nodes/edges
```

---

## 10. Roadmap

1. **Auto-layout** — dagre/elk layout algorithm for imported workflows
2. **Asset Bridge** — drag assets from the asset library onto canvas nodes
3. **Storyboard Timeline** — horizontal sequence view alongside node canvas
4. **Multiplayer** — Liveblocks/Yjs for real-time collaborative editing
5. **Version History** — snapshot canvas state, diff viewer
6. **Director System Nodes** — script → shot → storyboard → video pipeline nodes
7. **Node Groups** — visual grouping / scene containers
8. **Conditional Edges** — if/else branching for dynamic workflows
9. **Batch Generation** — run multiple image/video nodes in parallel
10. **Export** — export canvas as JSON, image, or video sequence
