'use client'

import { useMemo, useState } from 'react'
import type { AssetIntelligence } from '@/lib/asset-intelligence'
import { asAssetIntelligence, getAssetIntelligenceTags } from '@/lib/asset-intelligence'

type AssetIntelligencePanelProps = {
  intelligence?: AssetIntelligence | unknown | null
  compact?: boolean
}

function textList(values?: string[]) {
  return values?.filter(Boolean).join(' · ') || ''
}

function characterLine(character: NonNullable<AssetIntelligence['characters']>[number]) {
  return [
    character.name,
    character.species,
    character.gender,
    character.ageGroup,
    textList(character.clothing),
    textList(character.pose),
    textList(character.emotion),
  ].filter(Boolean).join(' · ')
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="rounded-md border border-white/10 bg-black/18 p-3">
      <div className="text-xs font-semibold text-white/42">{label}</div>
      <div className="mt-1 text-sm leading-6 text-white/74">{value}</div>
    </div>
  )
}

export function AssetIntelligencePanel({ intelligence, compact = false }: AssetIntelligencePanelProps) {
  const assetIntelligence = asAssetIntelligence(intelligence)
  const tags = useMemo(() => getAssetIntelligenceTags(assetIntelligence), [assetIntelligence])
  const [copiedTag, setCopiedTag] = useState('')

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard?.writeText(tag)
      setCopiedTag(tag)
      window.setTimeout(() => setCopiedTag(''), 1200)
    } catch {
      setCopiedTag('')
    }
  }

  if (!assetIntelligence) {
    return (
      <div className="rounded-lg border border-dashed border-white/14 bg-white/[0.025] p-5 text-sm leading-6 text-white/48">
        当前节点还没有智能资产信息。新生成的 Image / Video 成功后会自动写入。
      </div>
    )
  }

  const scene = assetIntelligence.scene
  const cinematography = assetIntelligence.cinematography
  const visualStyle = assetIntelligence.visualStyle
  const characters = assetIntelligence.characters ?? []
  const characterSummary = characters.map(characterLine).filter(Boolean).join('\n')

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white/86">影视资产标签系统</h3>
            <p className="mt-1 text-xs text-white/42">{assetIntelligence.mediaType} · v{assetIntelligence.version}</p>
          </div>
          <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 text-xs font-semibold text-cyan-50">
            AI Tags: {tags.length}
          </span>
        </div>

        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/72 transition hover:border-cyan-200/35 hover:bg-cyan-200/12 hover:text-cyan-50"
                title="复制标签"
                onClick={() => { void copyTag(tag) }}
              >
                {copiedTag === tag ? '已复制' : tag}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/45">暂未识别出可复用标签。</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryBlock
          label="场景"
          value={[
            scene?.location,
            textList(scene?.architecture),
            textList(scene?.environment),
          ].filter(Boolean).join(' · ')}
        />
        <SummaryBlock
          label="天气 / 时间"
          value={[
            textList(scene?.weather),
            textList(scene?.timeOfDay),
          ].filter(Boolean).join(' · ')}
        />
        <SummaryBlock
          label="镜头"
          value={[
            textList(cinematography?.shotType),
            textList(cinematography?.lensStyle),
            textList(cinematography?.cameraAngle),
            textList(cinematography?.movement),
            textList(cinematography?.composition),
          ].filter(Boolean).join(' · ')}
        />
        <SummaryBlock
          label="风格 / 色调"
          value={[
            textList(visualStyle?.colorPalette),
            textList(visualStyle?.lighting),
            textList(visualStyle?.texture),
            textList(visualStyle?.realism),
            textList(visualStyle?.artStyle),
          ].filter(Boolean).join(' · ')}
        />
        <SummaryBlock label="角色" value={characterSummary} />
        <SummaryBlock label="道具 / 情绪" value={[textList(assetIntelligence.props), textList(assetIntelligence.mood)].filter(Boolean).join(' · ')} />
      </div>
    </div>
  )
}
