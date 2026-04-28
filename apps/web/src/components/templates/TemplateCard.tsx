'use client'

import { ArrowUpRight, CheckCircle2, Play } from 'lucide-react'
import type { PublicTemplate } from '@/lib/templates/public-template-catalog'
import { PUBLIC_TEMPLATE_NODE_TYPE_LABELS } from '@/lib/templates/public-template-categories'

interface TemplateCardProps {
  template: PublicTemplate
  compact?: boolean
  selected?: boolean
  onUseTemplate: (template: PublicTemplate) => void
}

export function TemplateCard({
  template,
  compact = false,
  selected = false,
  onUseTemplate,
}: TemplateCardProps) {
  return (
    <article
      className={[
        'group overflow-hidden border border-white/10 bg-white/[0.035] text-left transition duration-200 hover:border-white/20 hover:bg-white/[0.06]',
        selected ? 'ring-1 ring-sky-300/70' : '',
        compact ? 'rounded-[18px]' : 'rounded-[22px]',
      ].join(' ')}
    >
      <div
        className={compact ? 'h-[96px]' : 'h-[132px] sm:h-[148px]'}
        style={{
          background:
            `radial-gradient(circle at 72% 28%, rgba(255,255,255,0.34), transparent 0 18%, transparent 19%), linear-gradient(135deg, ${template.thumbnail.gradientFrom}, ${template.thumbnail.gradientTo})`,
        }}
      >
        <div className="flex h-full items-end justify-between bg-gradient-to-t from-black/42 via-transparent to-white/[0.03] p-3">
          <span className="rounded-full border border-white/12 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/78 backdrop-blur">
            {template.aspectRatio}
          </span>
          {template.isUsable ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/12 px-2 py-1 text-[10px] font-semibold text-emerald-100">
              <CheckCircle2 size={12} />
              可用
            </span>
          ) : null}
        </div>
      </div>

      <div className={compact ? 'grid gap-2 p-3' : 'grid gap-3 p-4'}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-white/38">
            <span>{template.category}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{PUBLIC_TEMPLATE_NODE_TYPE_LABELS[template.nodeType]}</span>
          </div>
          <h3 className={compact ? 'mt-1 truncate text-[13px] font-semibold text-white/88' : 'mt-1 text-[15px] font-semibold text-white/90'}>
            {template.title}
          </h3>
          <p className={compact ? 'mt-1 line-clamp-2 text-[11px] leading-5 text-white/48' : 'mt-2 line-clamp-2 text-[13px] leading-6 text-white/55'}>
            {template.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {template.styleTags.slice(0, compact ? 2 : 3).map((tag) => (
            <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-white/48">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onUseTemplate(template)}
            className={compact
              ? 'inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-black transition hover:scale-[1.01]'
              : 'inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black transition hover:scale-[1.01]'}
          >
            <Play size={compact ? 12 : 14} fill="currentColor" />
            使用模板
          </button>
          {template.sourceUrl ? (
            <a
              href={template.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/38 transition hover:text-white/70"
              onClick={(event) => event.stopPropagation()}
            >
              参考来源
              <ArrowUpRight size={12} />
            </a>
          ) : (
            <span className="text-[10px] font-semibold text-white/30">内置结构</span>
          )}
        </div>
      </div>
    </article>
  )
}
