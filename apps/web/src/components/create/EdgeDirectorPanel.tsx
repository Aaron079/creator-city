'use client'

import { useEffect, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import {
  DEFAULT_EDGE_DIRECTOR_CONFIG,
  EDGE_DIRECTOR_LABELS,
  edgeDirectorMetadata,
  getEdgeDirectorConfig,
  normalizeEdgeDirectorConfig,
  type EdgeDirectorConfig,
  type EdgeDirectorType,
} from '@/lib/canvas/edge-director'

type CanvasEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  metadataJson?: unknown
}

interface EdgeDirectorPanelProps {
  open: boolean
  edge: CanvasEdge | null
  sourceNode?: CanvasNode | null
  targetNode?: CanvasNode | null
  onClose: () => void
  onPatchEdge: (edgeId: string, patch: Partial<CanvasEdge>) => void
}

const EDGE_TYPE_OPTIONS: EdgeDirectorType[] = [
  'default',
  'story-to-visual',
  'image-to-video',
  'style-lock',
  'character-lock',
  'scene-continuity',
  'camera-motion',
  'variant',
  'reference',
]

const TOGGLE_FIELDS: Array<{ key: keyof Pick<EdgeDirectorConfig, 'inheritStory' | 'inheritCharacter' | 'inheritScene' | 'inheritColor' | 'inheritCamera' | 'lockStyle'>; label: string }> = [
  { key: 'inheritStory', label: '继承故事' },
  { key: 'inheritCharacter', label: '继承角色' },
  { key: 'inheritScene', label: '继承场景' },
  { key: 'inheritColor', label: '继承色调' },
  { key: 'inheritCamera', label: '继承镜头语言' },
  { key: 'lockStyle', label: '锁定风格' },
]

function nodeLabel(node?: CanvasNode | null) {
  if (!node) return '未知节点'
  return `${node.title || node.id} · ${node.kind}`
}

export function EdgeDirectorPanel({
  open,
  edge,
  sourceNode,
  targetNode,
  onClose,
  onPatchEdge,
}: EdgeDirectorPanelProps) {
  const [config, setConfig] = useState<EdgeDirectorConfig>(DEFAULT_EDGE_DIRECTOR_CONFIG)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open || !edge) return
    setConfig(getEdgeDirectorConfig(edge.metadataJson) ?? DEFAULT_EDGE_DIRECTOR_CONFIG)
    setSaved(false)
  }, [edge, open])

  if (!open || !edge) return null

  const patchConfig = (patch: Partial<EdgeDirectorConfig>) => {
    setConfig((current) => normalizeEdgeDirectorConfig({ ...current, ...patch }))
    setSaved(false)
  }

  const saveConfig = () => {
    onPatchEdge(edge.id, {
      metadataJson: edgeDirectorMetadata(edge.metadataJson, config),
    })
    setSaved(true)
  }

  const resetConfig = () => {
    setConfig(DEFAULT_EDGE_DIRECTOR_CONFIG)
    setSaved(false)
  }

  return (
    <div
      className="fixed inset-0 z-[92] flex justify-end bg-black/10"
      role="presentation"
      data-no-node-drag="true"
      data-edge-director="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[84vh] w-[min(460px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="连接导演 / Edge Director"
        data-no-node-drag="true"
        data-edge-director="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Edge Director</p>
              <h2 className="mt-1 text-lg font-semibold text-white">连接导演</h2>
              <p className="mt-2 text-sm text-white/58">{nodeLabel(sourceNode)} → {nodeLabel(targetNode)}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-lg leading-none text-white/66 hover:bg-white/10 hover:text-white"
              aria-label="关闭连接导演"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-sm font-semibold text-white/82">连接类型</span>
            <select
              value={config.type}
              onChange={(event) => patchConfig({ type: event.target.value as EdgeDirectorType })}
              className="mt-3 w-full rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm text-white/78 outline-none focus:border-cyan-100/30"
            >
              {EDGE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{EDGE_DIRECTOR_LABELS[type]}</option>
              ))}
            </select>
          </label>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <h3 className="mb-3 text-sm font-semibold text-white/82">继承规则</h3>
            <div className="grid gap-2">
              {TOGGLE_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center justify-between gap-3 rounded-md bg-black/18 px-3 py-2">
                  <span className="text-sm text-white/70">{field.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(config[field.key])}
                    onChange={(event) => patchConfig({ [field.key]: event.target.checked } as Partial<EdgeDirectorConfig>)}
                    className="h-4 w-4 accent-cyan-200"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white/82">影响权重</h3>
              <span className="font-mono text-sm text-cyan-50">{Math.round(config.influenceWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(config.influenceWeight * 100)}
              onChange={(event) => patchConfig({ influenceWeight: Number(event.target.value) / 100 })}
              className="mt-3 w-full accent-cyan-200"
            />
          </section>

          <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-sm font-semibold text-white/82">镜头运动</span>
            <input
              value={config.cameraMotion ?? ''}
              onChange={(event) => patchConfig({ cameraMotion: event.target.value })}
              className="mt-3 w-full rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm text-white/78 outline-none placeholder:text-white/28 focus:border-cyan-100/30"
              placeholder="缓慢推进、横移、环绕、拉远、手持感、低机位跟拍..."
            />
          </label>

          <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-sm font-semibold text-white/82">自定义导演指令</span>
            <textarea
              value={config.customInstruction ?? ''}
              onChange={(event) => patchConfig({ customInstruction: event.target.value })}
              className="mt-3 min-h-28 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 text-white/78 outline-none placeholder:text-white/28 focus:border-cyan-100/30"
              placeholder="保持上游图片的主体、构图和色调，只增加雨水流动和霓虹闪烁。"
            />
          </label>

          <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-sm font-semibold text-white/82">禁止项</span>
            <textarea
              value={config.negativeInstruction ?? ''}
              onChange={(event) => patchConfig({ negativeInstruction: event.target.value })}
              className="mt-3 min-h-24 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 text-white/78 outline-none placeholder:text-white/28 focus:border-cyan-100/30"
              placeholder="不要改变人物服装，不要变成白天，不要改变城市结构。"
            />
          </label>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <span className="text-xs text-white/42">{saved ? '已保存连接导演。' : '配置只会写入当前连接线。'}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/68 hover:bg-white/10" onClick={resetConfig}>
              重置默认
            </button>
            <button type="button" className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/68 hover:bg-white/10" onClick={onClose}>
              关闭
            </button>
            <button type="button" className="rounded-md border border-cyan-100/20 bg-cyan-100/12 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-100/18" onClick={saveConfig}>
              保存连接导演
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
