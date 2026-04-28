'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal } from 'lucide-react'
import { TemplateCard } from '@/components/templates/TemplateCard'
import {
  PUBLIC_TEMPLATE_CATALOG,
  PUBLIC_TEMPLATE_COUNT,
  PUBLIC_TEMPLATE_LICENSE_NOTE,
  type PublicTemplate,
} from '@/lib/templates/public-template-catalog'
import {
  PUBLIC_TEMPLATE_CATEGORIES,
  PUBLIC_TEMPLATE_NODE_TYPES,
  PUBLIC_TEMPLATE_NODE_TYPE_LABELS,
  type PublicTemplateCategory,
  type PublicTemplateNodeType,
} from '@/lib/templates/public-template-categories'

interface PublicTemplateGalleryProps {
  templates?: PublicTemplate[]
  compact?: boolean
  selectedTemplateId?: string
  onUseTemplate?: (template: PublicTemplate) => void
  showLegalNote?: boolean
}

type CategoryFilter = 'all' | PublicTemplateCategory
type NodeTypeFilter = 'all' | PublicTemplateNodeType

export function PublicTemplateGallery({
  templates = PUBLIC_TEMPLATE_CATALOG,
  compact = false,
  selectedTemplateId,
  onUseTemplate,
  showLegalNote = true,
}: PublicTemplateGalleryProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [nodeType, setNodeType] = useState<NodeTypeFilter>('all')
  const [usableOnly, setUsableOnly] = useState(true)

  const categoryCounts = useMemo(() => {
    const counts = new Map<PublicTemplateCategory, number>()
    templates.forEach((template) => {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
    })
    return counts
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return templates.filter((template) => {
      if (category !== 'all' && template.category !== category) return false
      if (nodeType !== 'all' && template.nodeType !== nodeType) return false
      if (usableOnly && !template.isUsable) return false
      if (!normalized) return true
      return [
        template.title,
        template.description,
        template.promptStarter,
        template.category,
        template.nodeType,
        ...template.styleTags,
        ...template.useCases,
      ].join(' ').toLowerCase().includes(normalized)
    })
  }, [category, nodeType, query, templates, usableOnly])

  function handleUseTemplate(template: PublicTemplate) {
    if (onUseTemplate) {
      onUseTemplate(template)
      return
    }
    router.push(`/create?template=${encodeURIComponent(template.id)}`)
  }

  return (
    <section className={compact ? 'grid gap-3' : 'grid gap-6'} aria-label="公共模板库">
      <div className={compact ? 'grid gap-3' : 'grid gap-4'}>
        <div className={compact ? 'grid gap-3' : 'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'}>
          <label
            className={[
              'flex items-center border border-white/10 bg-black/24 text-white/45 backdrop-blur',
              compact ? 'h-11 rounded-[18px] px-3' : 'h-12 rounded-[20px] px-4 lg:max-w-[520px] lg:flex-1',
            ].join(' ')}
          >
            <Search size={compact ? 16 : 18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 title / description / tags"
              className={[
                'min-w-0 flex-1 bg-transparent px-3 text-white outline-none placeholder:text-white/28',
                compact ? 'text-[13px]' : 'text-sm',
              ].join(' ')}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/48">
              <SlidersHorizontal size={13} />
              {filteredTemplates.length}/{templates.length || PUBLIC_TEMPLATE_COUNT}
            </span>
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/52">
              <input
                checked={usableOnly}
                onChange={(event) => setUsableOnly(event.target.checked)}
                type="checkbox"
                className="h-3.5 w-3.5 accent-white"
              />
              可直接使用
            </label>
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={[
              'h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition',
              category === 'all' ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-white/50 hover:text-white',
            ].join(' ')}
          >
            全部
          </button>
          {PUBLIC_TEMPLATE_CATEGORIES.filter((item) => categoryCounts.has(item)).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={[
                'h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition',
                category === item ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-white/50 hover:text-white',
              ].join(' ')}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setNodeType('all')}
            className={[
              'h-7 rounded-full px-2.5 text-[10px] font-semibold transition',
              nodeType === 'all' ? 'bg-sky-300/90 text-black' : 'border border-white/10 bg-white/[0.035] text-white/42 hover:text-white/75',
            ].join(' ')}
          >
            全部类型
          </button>
          {PUBLIC_TEMPLATE_NODE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setNodeType(type)}
              className={[
                'h-7 rounded-full px-2.5 text-[10px] font-semibold transition',
                nodeType === type ? 'bg-sky-300/90 text-black' : 'border border-white/10 bg-white/[0.035] text-white/42 hover:text-white/75',
              ].join(' ')}
            >
              {PUBLIC_TEMPLATE_NODE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div
        className={compact
          ? 'grid max-h-[48vh] grid-cols-2 gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
      >
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            compact={compact}
            selected={selectedTemplateId === template.id}
            onUseTemplate={handleUseTemplate}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-6 text-center text-sm text-white/45">
          没有匹配模板。
        </div>
      ) : null}

      {showLegalNote ? (
        <p className={compact ? 'text-[10px] leading-5 text-white/34' : 'max-w-4xl text-xs leading-6 text-white/40'}>
          公共模板为 Creator City 内置的可编辑结构模板。外部来源仅作为创作参考，不复制第三方受版权保护素材。使用任何外部素材前，请确认授权。{compact ? '' : ` ${PUBLIC_TEMPLATE_LICENSE_NOTE}`}
        </p>
      ) : null}
    </section>
  )
}
