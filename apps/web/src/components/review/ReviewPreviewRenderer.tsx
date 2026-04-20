'use client'

import Image from 'next/image'
import type { ReviewItem } from '@/lib/review/review-data'

export function ReviewPreviewRenderer({ item }: { item: ReviewItem }) {
  const preview = item.previewData

  if (preview.type === 'storyboard-frame' && preview.imageUrl) {
    return (
      <div className="relative h-44 rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <Image src={preview.imageUrl} alt={item.title} fill unoptimized sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>
    )
  }

  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(20,184,166,0.08))', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>预览摘要</p>

      {preview.type === 'storyboard-frame' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="提示词" value={preview.imagePrompt || '未提供'} />
          <PreviewItem label="创作意图" value={preview.intent || '未设置'} />
          <PreviewItem label="状态" value={preview.status || 'draft'} />
          <PreviewItem label="镜头语言" value={[preview.movement, preview.lighting].filter(Boolean).join(' / ') || '未设置'} />
        </div>
      )}

      {preview.type === 'video-shot' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="镜头摘要" value={preview.frameSummary} />
          <PreviewItem label="Review 状态" value={preview.reviewStatus || '待复核'} />
          <PreviewItem label="Provider" value={preview.provider || 'mock'} />
          <PreviewItem label="时长 / 运动" value={[preview.duration, preview.movement].filter(Boolean).join(' / ') || '未设置'} />
        </div>
      )}

      {preview.type === 'editor-timeline' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="片段数量" value={String(preview.clipCount)} />
          <PreviewItem label="节奏目标" value={preview.pacing || '未设置'} />
          <PreviewItem label="音乐方向" value={preview.musicDirection || '未设置'} />
          <PreviewItem label="转场摘要" value={preview.transitionSummary} />
        </div>
      )}

      {preview.type === 'audio-timeline' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="轨道摘要" value={preview.trackSummary.join(' / ')} />
          <PreviewItem label="时长" value={preview.duration || '待确认'} />
          <PreviewItem label="Music Cue" value={preview.musicCueSummary} />
          <PreviewItem label="对白 / 同步" value={`${preview.voiceSummary}；${preview.syncIssueSummary}`} />
        </div>
      )}

      {preview.type === 'delivery' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="交付状态" value={preview.finalStatus} />
          <PreviewItem label="确认摘要" value={preview.approvalSummary} />
          <PreviewItem label="资产检查" value={preview.assetChecklist.join(' / ')} />
        </div>
      )}

      {preview.type === 'generic' && (
        <div className="grid gap-2 mt-2 md:grid-cols-2">
          <PreviewItem label="摘要" value={preview.summary} />
          <PreviewItem label="变更字段" value={preview.changedFields.join(' / ') || '未记录'} />
        </div>
      )}
    </div>
  )
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>{label}</p>
      <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.62)' }}>{value}</p>
    </div>
  )
}
