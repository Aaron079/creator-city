import { generate } from '../index'
import type { SkillInput, SkillOutput, ShotSummary } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_FINAL_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
]

let _videoIdx = 0

function buildTimelineSummary(shots: ShotSummary[]): string {
  if (shots.length === 0) return '（暂无镜头）'

  const rhythm =
    shots.length <= 2 ? '节奏舒缓' :
    shots.length <= 4 ? '中等节奏' : '节奏紧凑'

  const parts = shots.map((shot) => {
    const label = shot.idea?.slice(0, 18) ?? shot.label
    return `${shot.label}（${label}）`
  })

  return `【${rhythm}】${parts.join(' → ')} · 转场：cut`
}

// ─── Skill ────────────────────────────────────────────────────────────────────

/**
 * Final-edit skill — Timeline Editor.
 *
 * Reads ALL shots from the input, builds a timelineSummary describing order/
 * rhythm/transitions, and returns a mock finalVideoUrl representing the
 * assembled multi-shot film.
 *
 * Data flow:
 *   shots[].idea + videoUrl  → timelineSummary (order, rhythm, transitions)
 *   role: 'editor'           → editor text (pacing notes, music direction)
 *   mock video URL           → finalVideoUrl placeholder
 */
export async function finalEditSkill({
  idea,
  style,
  context,
  shots,
  params,
}: SkillInput): Promise<SkillOutput> {
  const shotsContext =
    shots && shots.length > 0
      ? `\n\n【多镜头 Timeline — ${shots.length} 个镜头】\n` +
        shots
          .map((s, i) => `镜头 ${i + 1}（${s.label}）：${s.idea ?? '无描述'}${s.videoUrl ? ' ✔' : ''}`)
          .join('\n')
      : ''

  const textResult = await generate({
    idea,
    role: 'editor',
    style,
    context: (context ?? '') + shotsContext,
    params,
  })

  const timelineSummary = shots && shots.length > 0
    ? buildTimelineSummary(shots)
    : '单镜头作品'

  const finalVideoUrl =
    SAMPLE_FINAL_VIDEOS[_videoIdx % SAMPLE_FINAL_VIDEOS.length] ??
    SAMPLE_FINAL_VIDEOS[0] ??
    ''
  _videoIdx++

  return {
    content: textResult.content,
    timelineSummary,
    finalVideoUrl,
    source: textResult.source,
  }
}
