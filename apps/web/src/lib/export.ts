import type { Shot } from '@/store/shots.store'
import type { CanvasNode } from '@/store/canvas.store'
import type { GlobalPro } from '@/lib/ai/prompts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findNode(nodes: CanvasNode[], id: string): CanvasNode | undefined {
  return nodes.find((n) => n.id === id)
}

export interface ShotExportData {
  label: string
  idea: string
  style: string
  // camera/visual params (from presetParams or agent-dop node)
  shotType?: string
  framing?: string
  movement?: string
  colorGrade?: string
  lighting?: string
  // agent outputs
  shotDescription?: string
  keyframePrompt?: string
  videoPrompt?: string
  scriptExcerpt?: string
  directionExcerpt?: string
  imageUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  isDone: boolean
}

/** Extract all exportable data from a shot's serialized canvas nodes */
export function extractShotData(shot: Shot): ShotExportData {
  const dop    = findNode(shot.nodes, 'agent-dop')
  const editor = findNode(shot.nodes, 'agent-editor')
  const writer = findNode(shot.nodes, 'agent-writer')
  const director = findNode(shot.nodes, 'agent-director')

  const p = shot.presetParams ?? {}

  return {
    label:          shot.label,
    idea:           shot.idea,
    style:          shot.style,
    shotType:       p.shotType       ?? dop?.params?.shotType as string | undefined,
    framing:        p.framing        ?? dop?.params?.framing as string | undefined,
    movement:       p.movement       ?? dop?.params?.movement as string | undefined,
    colorGrade:     p.colorGrade     ?? dop?.params?.colorGrade as string | undefined,
    lighting:       p.lighting       ?? dop?.params?.lighting as string | undefined,
    shotDescription: dop?.shotDescription,
    keyframePrompt:  dop?.keyframePrompt,
    videoPrompt:     editor?.videoPrompt,
    scriptExcerpt:   writer?.content?.slice(0, 300),
    directionExcerpt: director?.content?.slice(0, 200),
    imageUrl:        dop?.imageUrl   ?? shot.thumbnailUrl,
    videoUrl:        editor?.videoUrl ?? shot.videoUrl,
    thumbnailUrl:    shot.thumbnailUrl,
    isDone:          shot.isDone,
  }
}

// ─── Storyboard (plain text) ──────────────────────────────────────────────────

export function buildStoryboard(shots: Shot[], globalPro?: GlobalPro): string {
  const lines: string[] = [
    '分镜脚本 · Storyboard',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `共 ${shots.length} 个镜头`,
    '',
  ]

  if (globalPro) {
    lines.push('【全局质量控制】')
    lines.push(`风格一致性：${globalPro.styleConsistency}  创意程度：${globalPro.creativity}  写实程度：${globalPro.realism}  细节强度：${globalPro.detailLevel}`)
    lines.push(`图像模型：${globalPro.modelConfig.imageModel}  视频模型：${globalPro.modelConfig.videoModel}`)
    lines.push('')
  }

  lines.push('═'.repeat(50))
  lines.push('')

  shots.forEach((shot, i) => {
    const d = extractShotData(shot)
    lines.push(`Shot ${i + 1}：${d.label}`)
    lines.push('─'.repeat(40))
    lines.push(`描述：${d.idea || '（未填写）'}`)
    lines.push(`风格：${d.style}`)
    if (d.shotType || d.framing)   lines.push(`镜头：${[d.shotType, d.framing].filter(Boolean).join(' / ')}`)
    if (d.movement)                lines.push(`运镜：${d.movement}`)
    if (d.colorGrade || d.lighting) lines.push(`色彩：${[d.colorGrade, d.lighting].filter(Boolean).join(' / ')}`)
    if (d.shotDescription)         lines.push(`摄影备注：${d.shotDescription}`)
    if (d.keyframePrompt)          lines.push(`关键帧 Prompt：${d.keyframePrompt}`)
    if (d.videoPrompt)             lines.push(`视频 Prompt：${d.videoPrompt}`)
    if (d.scriptExcerpt)           lines.push(`剧本摘要：${d.scriptExcerpt}`)
    if (d.imageUrl)                lines.push(`关键帧图像：${d.imageUrl}`)
    if (d.videoUrl)                lines.push(`视频：${d.videoUrl}`)
    lines.push(`状态：${d.isDone ? '✔ 已完成' : '○ 未完成'}`)
    lines.push('')
    lines.push('')
  })

  return lines.join('\n')
}

// ─── Prompt Pack (JSON) ───────────────────────────────────────────────────────

export interface PromptPackShot {
  label: string
  idea: string
  prompt: string          // general idea prompt
  imagePrompt: string     // keyframePrompt for image generation
  videoPrompt: string     // video motion prompt
  imageUrl?: string
  videoUrl?: string
}

export interface PromptPack {
  project: string
  exportedAt: string
  totalShots: number
  globalPro?: GlobalPro
  shots: PromptPackShot[]
}

export function buildPromptPack(shots: Shot[], globalPro?: GlobalPro): PromptPack {
  return {
    project:    'Creator City · AI 导演工作台',
    exportedAt: new Date().toISOString(),
    totalShots: shots.length,
    ...(globalPro ? { globalPro } : {}),
    shots: shots.map((shot) => {
      const d = extractShotData(shot)
      return {
        label:       d.label,
        idea:        d.idea,
        prompt:      d.idea,
        imagePrompt: d.keyframePrompt ?? '',
        videoPrompt: d.videoPrompt    ?? '',
        imageUrl:    d.imageUrl,
        videoUrl:    d.videoUrl,
      }
    }),
  }
}

// ─── Project JSON (full data) ─────────────────────────────────────────────────

export interface ProjectExport {
  version: string
  exportedAt: string
  totalShots: number
  shots: Array<{
    id: string
    label: string
    idea: string
    style: string
    isDone: boolean
    duration?: number
    presetParams?: Record<string, unknown>
    videoUrl?: string
    thumbnailUrl?: string
    shotDescription?: string
    keyframePrompt?: string
    videoPrompt?: string
    imageUrl?: string
  }>
}

export function buildProjectExport(shots: Shot[]): ProjectExport {
  return {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    totalShots: shots.length,
    shots: shots.map((shot) => {
      const d = extractShotData(shot)
      return {
        id:              shot.id,
        label:           shot.label,
        idea:            shot.idea,
        style:           shot.style,
        isDone:          shot.isDone,
        ...(shot.duration      ? { duration:      shot.duration      } : {}),
        ...(shot.presetParams  ? { presetParams:  shot.presetParams  } : {}),
        ...(d.videoUrl         ? { videoUrl:      d.videoUrl         } : {}),
        ...(d.thumbnailUrl     ? { thumbnailUrl:  d.thumbnailUrl     } : {}),
        ...(d.shotDescription  ? { shotDescription: d.shotDescription } : {}),
        ...(d.keyframePrompt   ? { keyframePrompt:  d.keyframePrompt  } : {}),
        ...(d.videoPrompt      ? { videoPrompt:     d.videoPrompt     } : {}),
        ...(d.imageUrl         ? { imageUrl:        d.imageUrl        } : {}),
      }
    }),
  }
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadStoryboard(shots: Shot[], globalPro?: GlobalPro): void {
  downloadFile(buildStoryboard(shots, globalPro), 'storyboard.txt', 'text/plain;charset=utf-8')
}

export function downloadPromptPack(shots: Shot[], globalPro?: GlobalPro): void {
  downloadFile(JSON.stringify(buildPromptPack(shots, globalPro), null, 2), 'prompt-pack.json', 'application/json')
}

export function downloadProjectExport(shots: Shot[]): void {
  downloadFile(JSON.stringify(buildProjectExport(shots), null, 2), 'project.json', 'application/json')
}
