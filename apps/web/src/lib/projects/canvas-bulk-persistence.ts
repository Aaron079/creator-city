import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'

export type CanvasNodeSaveInput = {
  id?: string
  kind?: string
  title?: string
  providerId?: string
  model?: string
  status?: string
  x?: number
  y?: number
  width?: number
  height?: number
  prompt?: string
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  resultPreview?: string
  errorMessage?: string
  assetId?: string
  stage?: string
  ratio?: string
  outputLabel?: string
  preview?: unknown
  metadataJson?: unknown
}

export type CanvasEdgeSaveInput = {
  id?: string
  fromNodeId?: string
  toNodeId?: string
  status?: string
  type?: string
  metadataJson?: unknown
}

export type CanvasNodeWriteRow = {
  id: string
  workflowId: string
  nodeId: string
  kind: string
  title: string | null
  providerId: string | null
  status: string
  x: number
  y: number
  width: number
  height: number
  prompt: string | null
  resultText: string | null
  resultImageUrl: string | null
  resultVideoUrl: string | null
  resultAudioUrl: string | null
  resultPreview: string | null
  errorMessage: string | null
  paramsJson: string
  metadataJson: string
  updatedAt: Date
}

export type CanvasEdgeWriteRow = {
  id: string
  workflowId: string
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  type: string | null
  metadataJson: string
  updatedAt: Date
}

function jsonText(value: unknown) {
  try {
    return JSON.stringify(value ?? null) ?? 'null'
  } catch {
    return '{}'
  }
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function prepareCanvasNodeRows({
  workflowId,
  projectId,
  now,
  nodes,
}: {
  workflowId: string
  projectId: string
  now: Date
  nodes: CanvasNodeSaveInput[]
}): CanvasNodeWriteRow[] {
  return nodes.flatMap((node) => {
    if (!node.id || !node.kind) return []
    const providerId = node.providerId ?? node.model ?? null
    const nodeMetadata = node.metadataJson && typeof node.metadataJson === 'object'
      ? node.metadataJson as Record<string, unknown>
      : {}

    return [{
      id: randomUUID(),
      workflowId,
      nodeId: node.id,
      kind: node.kind,
      title: node.title ?? null,
      providerId,
      status: node.status ?? 'idle',
      x: Number(node.x ?? 0),
      y: Number(node.y ?? 0),
      width: Number(node.width ?? 320),
      height: Number(node.height ?? 220),
      prompt: node.prompt ?? null,
      resultText: node.resultText ?? null,
      resultImageUrl: nonEmptyString(node.resultImageUrl),
      resultVideoUrl: nonEmptyString(node.resultVideoUrl),
      resultAudioUrl: node.resultAudioUrl ?? null,
      resultPreview: node.resultPreview ?? null,
      errorMessage: node.errorMessage ?? null,
      paramsJson: jsonText({ model: providerId, stage: node.stage ?? 'draft', ratio: node.ratio ?? null }),
      metadataJson: jsonText({
        ...nodeMetadata,
        projectId,
        workflowId,
        nodeId: node.id,
        ...(typeof node.assetId === 'string' && node.assetId.trim() ? { assetId: node.assetId.trim() } : {}),
        outputLabel: node.outputLabel ?? nodeMetadata.outputLabel ?? null,
        preview: node.preview ?? nodeMetadata.preview ?? null,
      }),
      updatedAt: now,
    }]
  })
}

export function prepareCanvasEdgeRows({
  workflowId,
  now,
  edges,
}: {
  workflowId: string
  now: Date
  edges: CanvasEdgeSaveInput[]
}): CanvasEdgeWriteRow[] {
  return edges.flatMap((edge) => {
    if (!edge.id || !edge.fromNodeId || !edge.toNodeId) return []
    const edgeMetadata = edge.metadataJson && typeof edge.metadataJson === 'object'
      ? edge.metadataJson as Record<string, unknown>
      : {}

    return [{
      id: randomUUID(),
      workflowId,
      edgeId: edge.id,
      sourceNodeId: edge.fromNodeId,
      targetNodeId: edge.toNodeId,
      type: edge.type ?? 'flow',
      metadataJson: jsonText({ ...edgeMetadata, status: edge.status ?? edgeMetadata.status ?? 'active' }),
      updatedAt: now,
    }]
  })
}

export function buildCanvasNodeBulkUpsert(rows: readonly CanvasNodeWriteRow[]): Prisma.Sql | null {
  if (rows.length === 0) return null

  const values = rows.map((row) => Prisma.sql`(
    ${row.id}, ${row.workflowId}, ${row.nodeId}, ${row.kind}, ${row.title},
    ${row.providerId}, ${row.status}, ${row.x}, ${row.y}, ${row.width}, ${row.height},
    ${row.prompt}, ${row.resultText}, ${row.resultImageUrl}, ${row.resultVideoUrl},
    ${row.resultAudioUrl}, ${row.resultPreview}, ${row.errorMessage},
    ${row.paramsJson}::jsonb, ${row.metadataJson}::jsonb, ${row.updatedAt}
  )`)

  return Prisma.sql`
    INSERT INTO "CanvasNode" (
      "id", "workflowId", "nodeId", "kind", "title", "providerId", "status",
      "x", "y", "width", "height", "prompt", "resultText", "resultImageUrl",
      "resultVideoUrl", "resultAudioUrl", "resultPreview", "errorMessage",
      "paramsJson", "metadataJson", "updatedAt"
    ) VALUES ${Prisma.join(values)}
    ON CONFLICT ("workflowId", "nodeId") DO UPDATE SET
      "kind" = EXCLUDED."kind",
      "title" = EXCLUDED."title",
      "providerId" = EXCLUDED."providerId",
      "status" = EXCLUDED."status",
      "x" = EXCLUDED."x",
      "y" = EXCLUDED."y",
      "width" = EXCLUDED."width",
      "height" = EXCLUDED."height",
      "prompt" = EXCLUDED."prompt",
      "resultText" = EXCLUDED."resultText",
      "resultImageUrl" = COALESCE(EXCLUDED."resultImageUrl", "CanvasNode"."resultImageUrl"),
      "resultVideoUrl" = COALESCE(EXCLUDED."resultVideoUrl", "CanvasNode"."resultVideoUrl"),
      "resultAudioUrl" = EXCLUDED."resultAudioUrl",
      "resultPreview" = EXCLUDED."resultPreview",
      "errorMessage" = EXCLUDED."errorMessage",
      "paramsJson" = EXCLUDED."paramsJson",
      "metadataJson" = EXCLUDED."metadataJson",
      "updatedAt" = EXCLUDED."updatedAt"
  `
}

export function buildCanvasEdgeBulkUpsert(rows: readonly CanvasEdgeWriteRow[]): Prisma.Sql | null {
  if (rows.length === 0) return null

  const values = rows.map((row) => Prisma.sql`(
    ${row.id}, ${row.workflowId}, ${row.edgeId}, ${row.sourceNodeId},
    ${row.targetNodeId}, ${row.type}, ${row.metadataJson}::jsonb, ${row.updatedAt}
  )`)

  return Prisma.sql`
    INSERT INTO "CanvasEdge" (
      "id", "workflowId", "edgeId", "sourceNodeId", "targetNodeId", "type", "metadataJson", "updatedAt"
    ) VALUES ${Prisma.join(values)}
    ON CONFLICT ("workflowId", "edgeId") DO UPDATE SET
      "sourceNodeId" = EXCLUDED."sourceNodeId",
      "targetNodeId" = EXCLUDED."targetNodeId",
      "type" = EXCLUDED."type",
      "metadataJson" = EXCLUDED."metadataJson",
      "updatedAt" = EXCLUDED."updatedAt"
  `
}
