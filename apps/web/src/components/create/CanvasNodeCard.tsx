'use client'

import { motion } from 'framer-motion'
import { CanvasPromptBox } from '@/components/create/CanvasPromptBox'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'ready' | 'generating' | 'done'

export interface VisualCanvasNode {
  id: string
  kind: VisualCanvasNodeKind
  title: string
  subtitle: string
  prompt: string
  model: string
  ratio?: string
  status: VisualCanvasNodeStatus
  outputLabel?: string
}

interface CanvasNodeCardProps {
  node: VisualCanvasNode
  active: boolean
  onSelect: () => void
  onPromptChange: (value: string) => void
  onModelChange: (value: string) => void
  onRatioChange?: (value: string) => void
  onGenerate: () => void
  onUpload: () => void
}

const NODE_ACCENTS: Record<VisualCanvasNodeKind, { glow: string; label: string; icon: string; placeholder: string; models: string[]; ratios?: string[] }> = {
  text: {
    glow: 'rgba(138,43,226,0.28)',
    label: 'Brief / 文本',
    icon: '✦',
    placeholder: '输入项目 brief / 脚本 / 品牌文案',
    models: ['claude', 'gpt-4o', 'director'],
  },
  image: {
    glow: 'rgba(0,255,255,0.28)',
    label: 'Image / 图片',
    icon: '◫',
    placeholder: '描述你想生成的画面，或贴入视觉参考方向',
    models: ['nano-banana', 'flux-dev', 'sdxl'],
    ratios: ['16:9', '9:16', '1:1'],
  },
  video: {
    glow: 'rgba(138,43,226,0.28)',
    label: 'Video / 视频',
    icon: '▣',
    placeholder: '描述镜头运动、情绪和节奏，进入视频生成',
    models: ['runway', 'seedance', 'kling'],
    ratios: ['16:9', '9:16'],
  },
  audio: {
    glow: 'rgba(0,255,127,0.24)',
    label: 'Audio / 音频',
    icon: '♫',
    placeholder: '描述配乐、音效或旁白方向',
    models: ['soundscape', 'voice', 'music'],
  },
  delivery: {
    glow: 'rgba(0,255,127,0.24)',
    label: 'Delivery / 交付',
    icon: '✓',
    placeholder: '整理交付说明、版本摘要与客户确认备注',
    models: ['manifest', 'summary', 'client-note'],
  },
  world: {
    glow: 'rgba(0,255,255,0.2)',
    label: '3D World / 世界',
    icon: '◎',
    placeholder: '描述场景、空间关系与沉浸世界观',
    models: ['spatial-world', 'concept-space'],
  },
  upload: {
    glow: 'rgba(255,255,255,0.18)',
    label: 'Upload / 上传',
    icon: '↑',
    placeholder: '记录需要上传的参考图、视频或音频',
    models: ['asset-drop', 'reference'],
  },
}

const STATUS_META: Record<VisualCanvasNodeStatus, { label: string; tone: string }> = {
  idle: { label: 'Idle', tone: 'rgba(255,255,255,0.38)' },
  ready: { label: 'Ready', tone: '#9ad7ff' },
  generating: { label: 'Generating', tone: '#d6f8ff' },
  done: { label: 'Done', tone: '#baffd9' },
}

export function CanvasNodeCard({
  node,
  active,
  onSelect,
  onPromptChange,
  onModelChange,
  onRatioChange,
  onGenerate,
  onUpload,
}: CanvasNodeCardProps) {
  const meta = NODE_ACCENTS[node.kind]
  const status = STATUS_META[node.status]
  const nodeClassName = [
    'canvas-node-card',
    `node-${node.kind}`,
    active ? 'is-active' : '',
    node.status === 'generating' ? 'is-generating' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const statusClassName = `canvas-node-status status-${node.status}`

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      onClick={onSelect}
      className={`${nodeClassName} group text-left`}
    >
      <div className="canvas-node-topline" />

      <div className="relative z-[1] flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="canvas-node-icon">
                {meta.icon}
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">{meta.label}</div>
                <div className="mt-1 text-base font-light tracking-[-0.03em] text-white">{node.title}</div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-[1.7] text-white/52">{node.subtitle}</p>
          </div>
          <span className={statusClassName} style={{ color: status.tone }}>
            {status.label}
          </span>
        </div>

        <CanvasPromptBox
          prompt={node.prompt}
          onPromptChange={onPromptChange}
          model={node.model}
          models={meta.models}
          onModelChange={onModelChange}
          ratio={node.ratio}
          ratios={meta.ratios}
          onRatioChange={onRatioChange}
          placeholder={meta.placeholder}
        />

        <div className={node.status === 'done' ? 'canvas-node-output' : 'canvas-node-dialog'}>
          {node.status === 'done' ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/34">Output Preview</div>
              <div className="canvas-node-output-card">
                {node.outputLabel ?? '生成结果已就绪，可以继续进入下一阶段。'}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/34">Dialog State</div>
              <div className="mt-2 text-sm leading-[1.7] text-white/62">
                {node.status === 'generating'
                  ? '系统正在用前端 mock 状态模拟生成流程，节点完成后会出现结果占位卡。'
                  : '先输入 prompt、选择模型或比例，再手动点击生成或上传。'}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onGenerate()
            }}
            className="create-iridescent-button rounded-full px-3.5 py-2 text-[11px] font-medium transition hover:scale-[1.01]"
          >
            {node.status === 'generating' ? '生成中…' : node.status === 'done' ? '重新生成' : '生成'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onUpload()
            }}
            className="canvas-secondary-button"
          >
            上传
          </button>
        </div>
      </div>
    </motion.button>
  )
}
