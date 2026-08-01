import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

type CanvasSize = { width: number; height: number }

const COMPACT_NODE_SIZES: Record<VisualCanvasNodeKind, CanvasSize> = {
  text: { width: 236, height: 208 },
  image: { width: 248, height: 220 },
  video: { width: 248, height: 220 },
  audio: { width: 236, height: 190 },
  asset: { width: 236, height: 200 },
  template: { width: 236, height: 200 },
  delivery: { width: 236, height: 200 },
  world: { width: 248, height: 220 },
  upload: { width: 236, height: 200 },
}

const LEGACY_NODE_SIZES: Record<VisualCanvasNodeKind, CanvasSize> = {
  text: { width: 360, height: 300 },
  image: { width: 380, height: 320 },
  video: { width: 380, height: 320 },
  audio: { width: 360, height: 260 },
  asset: { width: 360, height: 280 },
  template: { width: 360, height: 280 },
  delivery: { width: 360, height: 280 },
  world: { width: 380, height: 320 },
  upload: { width: 360, height: 280 },
}

export function getCanvasNodeSize(kind: VisualCanvasNodeKind): CanvasSize {
  return COMPACT_NODE_SIZES[kind] ?? COMPACT_NODE_SIZES.text
}

export function normalizeLegacyCanvasNodeSize<
  T extends { kind: VisualCanvasNodeKind; width: number; height: number },
>(node: T): T {
  const legacySize = LEGACY_NODE_SIZES[node.kind]
  if (node.width !== legacySize.width || node.height !== legacySize.height) return node

  return {
    ...node,
    ...getCanvasNodeSize(node.kind),
  }
}

export function getCanvasNodeDialogSize(viewportWidth: number): CanvasSize {
  const width = Math.min(480, Math.max(0, viewportWidth - 48))

  return {
    width,
    height: viewportWidth <= 900 ? 320 : 420,
  }
}
