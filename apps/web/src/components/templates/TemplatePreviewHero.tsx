'use client'

import Link from 'next/link'
import { Play, Sparkles } from 'lucide-react'

interface TemplatePreviewHeroProps {
  compact?: boolean
  onDismiss?: () => void
}

export function TemplatePreviewHero({ compact = false, onDismiss }: TemplatePreviewHeroProps) {
  return (
    <div className={compact ? 'canvas-template-preview-card' : 'rounded-[22px] border border-white/10 bg-white/[0.035] p-4'}>
      <div className={compact ? 'canvas-template-preview-media' : 'aspect-video rounded-[18px] bg-[linear-gradient(135deg,#101827,#26345d_48%,#31c2ff)]'}>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/28 text-white backdrop-blur">
          <Play size={15} fill="currentColor" />
        </span>
      </div>
      <div className={compact ? 'canvas-template-preview-copy' : 'mt-4'}>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
          <Sparkles size={12} />
          Workflow starter
        </div>
        <h3 className={compact ? 'mt-1 text-[14px] font-semibold text-white' : 'mt-2 text-lg font-semibold text-white'}>
          使用模板加速创作
        </h3>
        <p className={compact ? 'mt-1 text-[11px] leading-5 text-white/48' : 'mt-2 text-sm leading-6 text-white/52'}>
          一键使用专业模板，快速构建你的专属场景。示意画面为本地占位，不包含第三方视频或封面。
        </p>
        <div className="mt-3 flex items-center gap-2">
          {onDismiss ? (
            <button type="button" onClick={onDismiss} className="h-8 whitespace-nowrap rounded-full bg-white px-3 text-[11px] font-semibold text-black">
              知道了
            </button>
          ) : null}
          <Link href="/templates" className="h-8 whitespace-nowrap rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold leading-none text-white/64 hover:text-white">
            了解更多
          </Link>
        </div>
      </div>
    </div>
  )
}
