import type { OpenSourceToolHealth } from './types'
import { getStorageHealth } from './adapters/storage-adapter'
import { getQueueHealth } from './adapters/queue-adapter'
import { getCanvasHealth } from './adapters/canvas-adapter'
import { getComfyuiHealth } from './adapters/comfyui-adapter'
import { getWhisperHealth } from './adapters/whisper-adapter'
import { getQdrantHealth } from './adapters/qdrant-adapter'
import { getCollaborationHealth } from './adapters/collaboration-adapter'
import { getLivekitHealth } from './adapters/livekit-adapter'
import { getShotDetectionHealth } from './adapters/shot-detection-adapter'
import { getBrowserMediaHealth } from './adapters/browser-media-adapter'
import { getMcpHealth } from './adapters/mcp-adapter'

const HEALTH_CHECKS = [
  getStorageHealth,
  getQueueHealth,
  getCanvasHealth,
  getComfyuiHealth,
  getWhisperHealth,
  getQdrantHealth,
  getCollaborationHealth,
  getLivekitHealth,
  getShotDetectionHealth,
  getBrowserMediaHealth,
  getMcpHealth,
]

export async function runAllHealthChecks(): Promise<OpenSourceToolHealth[]> {
  const results = await Promise.allSettled(HEALTH_CHECKS.map((fn) => fn()))
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      toolId: `unknown-${i}`,
      status: 'error' as const,
      message: r.reason instanceof Error ? r.reason.message : 'health check threw',
      checkedAt: new Date().toISOString(),
    }
  })
}
