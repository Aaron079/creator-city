// Stored zoom stays a physical scale; only the user-facing 100% baseline changes.
export const CANVAS_BASE_ZOOM = 0.46

export function canvasZoomPercent(zoom: number): number {
  return Math.round(zoom / CANVAS_BASE_ZOOM * 100)
}
