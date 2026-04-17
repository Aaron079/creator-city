'use client'

import { Fragment, useState } from 'react'
import { Nav } from '@/components/layout/Nav'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SelectionMap = Record<string, string>

interface DeptOption { id: string; label: string; sub: string }
interface DeptConfig  { id: string; icon: string; label: string; color: string; options: DeptOption[] }
interface NodeData    { id: string; icon: string; title: string; tag: string; desc: string; detail: string }

// ─── Static data ───────────────────────────────────────────────────────────────

const DEPTS: DeptConfig[] = [
  {
    id: 'writer', icon: '✍️', label: '编剧部门', color: '#818cf8',
    options: [
      { id: 'classic',    label: '经典编剧', sub: '三幕式 · 人物弧线' },
      { id: 'commercial', label: '商业编剧', sub: '爆款节奏 · 强冲突' },
      { id: 'art',        label: '艺术编剧', sub: '意象叙事 · 情绪驱动' },
    ],
  },
  {
    id: 'director', icon: '🎬', label: '导演部门', color: '#f43f5e',
    options: [
      { id: 'commercial', label: '商业导演',   sub: '视觉冲击 · 类型化' },
      { id: 'auteur',     label: '作者导演',   sub: '个人风格 · 主题深度' },
      { id: 'control',    label: '控制型导演', sub: '精确分镜 · 强节奏' },
    ],
  },
  {
    id: 'casting', icon: '🎭', label: '选角部门', color: '#f59e0b',
    options: [
      { id: 'lead',  label: '主角型', sub: '强存在感 · 观众代入' },
      { id: 'cool',  label: '冷感型', sub: '克制表演 · 留白张力' },
      { id: 'youth', label: '少年感', sub: '鲜活气质 · 未来感' },
    ],
  },
  {
    id: 'dop', icon: '📷', label: '摄影部门', color: '#60a5fa',
    options: [
      { id: 'arri',     label: 'ARRI 电影感', sub: '宽容度 · 银盐质感' },
      { id: 'handheld', label: '手持纪实',    sub: '真实感 · 情绪临场' },
      { id: 'gimbal',   label: '稳定器运镜',  sub: '流畅运动 · 现代感' },
    ],
  },
]

const PHASES = [
  '正在解析创意核心…',
  '编剧正在构建故事框架…',
  '导演正在确定视觉语言…',
  '选角师正在匹配人物气质…',
  '摄影师正在规划镜头方案…',
  '整合创作方案，即将输出…',
]

const GHOST_NODES = [
  { icon: '💡', label: '创意' },
  { icon: '✍️', label: '编剧' },
  { icon: '🎬', label: '导演' },
  { icon: '🎭', label: '选角' },
  { icon: '📷', label: '摄影' },
  { icon: '🎯', label: '输出' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function resolveOpt(deptId: string, sel: SelectionMap): DeptOption {
  const dept = DEPTS.find((d) => d.id === deptId)
  return (
    dept?.options.find((o) => o.id === sel[deptId]) ??
    dept?.options[0] ?? { id: '', label: '', sub: '' }
  )
}

function buildNodes(prompt: string, sel: SelectionMap): NodeData[] {
  const w = resolveOpt('writer', sel)
  const d = resolveOpt('director', sel)
  const c = resolveOpt('casting', sel)
  const p = resolveOpt('dop', sel)
  const story = prompt.trim() || '一个失忆的女导演在废弃影院里看见自己未拍完的未来电影'
  const short  = story.length > 38 ? story.slice(0, 38) + '…' : story

  return [
    {
      id: 'prompt', icon: '💡', title: '创意输入', tag: '核心灵感',
      desc: short,
      detail: `这是整个工作流的起点。AI 将基于你的创意"${story}"，提炼核心主题、情感基调与叙事张力，驱动后续所有部门协同创作。`,
    },
    {
      id: 'writer', icon: '✍️', title: '编剧', tag: w.label,
      desc: `${w.sub} · 故事骨架搭建`,
      detail: `采用【${w.label}】风格：${w.sub}。将核心创意转化为完整叙事结构，包含三幕划分、人物弧线设计、核心冲突与情感节拍全面规划。`,
    },
    {
      id: 'director', icon: '🎬', title: '导演', tag: d.label,
      desc: `${d.sub} · 镜头语言`,
      detail: `【${d.label}】风格：${d.sub}。确定叙事节奏、场景调度与视听逻辑，将剧本转化为可被感知的影像语言与完整观看体验。`,
    },
    {
      id: 'casting', icon: '🎭', title: '选角', tag: c.label,
      desc: `${c.sub} · 人物气质`,
      detail: `【${c.label}】方向：${c.sub}。根据角色定位与故事基调精准匹配演员气质，直接影响观众代入感与情绪传递效率。`,
    },
    {
      id: 'dop', icon: '📷', title: '摄影', tag: p.label,
      desc: `${p.sub} · 视觉风格`,
      detail: `【${p.label}】方案：${p.sub}。制定完整摄影策略——色调基调、镜头运动、景深控制与光效设计，让视觉语言与情绪深度融合。`,
    },
    {
      id: 'output', icon: '🎯', title: '创作方案', tag: '可执行输出',
      desc: '所有部门协同输出，方案就绪',
      detail: '完整创作方案已整合：故事大纲 + 导演阐述 + 选角建议 + 摄影风格指南。可直接进入下一阶段：分镜设计与视频生成。',
    },
  ]
}

// ─── SelectorCard ───────────────────────────────────────────────────────────────

function SelectorCard({
  dept, selected, onSelect,
}: {
  dept: DeptConfig
  selected?: string
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm leading-none">{dept.icon}</span>
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: dept.color }}>
          {dept.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {dept.options.map((opt) => {
          const active = selected === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`relative text-left rounded-xl p-3 border transition-all duration-200 outline-none ${
                active
                  ? 'text-white'
                  : 'text-gray-500 border-white/[0.07] bg-white/[0.015] hover:text-gray-200 hover:bg-white/[0.04] hover:border-white/[0.12]'
              }`}
              style={active ? { background: `${dept.color}13`, borderColor: `${dept.color}42` } : {}}
            >
              <p className="text-[11px] font-semibold leading-none mb-1.5">{opt.label}</p>
              <p className="text-[9px] leading-tight" style={{ opacity: 0.4 }}>{opt.sub}</p>
              {active && (
                <span
                  className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: dept.color }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── NodeConnector ─────────────────────────────────────────────────────────────

function NodeConnector({ visible, index }: { visible: boolean; index: number }) {
  return (
    <div
      className="flex-shrink-0 flex items-center transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        marginTop: 34,
        transitionDelay: `${index * 80 + 60}ms`,
      }}
    >
      <div className="w-8 h-px bg-white/[0.12]" />
      <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
        <path d="M0 0L5 4L0 8V0Z" fill="rgba(255,255,255,0.12)" />
      </svg>
    </div>
  )
}

// ─── WorkflowNode ───────────────────────────────────────────────────────────────

function WorkflowNode({
  node, active, visible, index, onClick,
}: {
  node: NodeData
  active: boolean
  visible: boolean
  index: number
  onClick: () => void
}) {
  return (
    <div
      className="flex-shrink-0 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(20px)',
        transitionDelay: `${index * 90}ms`,
      }}
    >
      <button
        onClick={onClick}
        className={`relative w-[204px] text-left rounded-2xl border p-4 transition-all duration-300 group outline-none ${
          active
            ? 'border-indigo-400/40'
            : 'border-white/[0.07] hover:border-white/[0.15]'
        }`}
        style={
          active
            ? {
                background: 'rgba(99,102,241,0.09)',
                boxShadow: '0 0 0 1px rgba(129,140,248,0.18) inset, 0 8px 32px rgba(99,102,241,0.14)',
              }
            : { background: 'rgba(255,255,255,0.025)' }
        }
      >
        {/* header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-colors duration-300 ${
              active ? 'bg-indigo-500/20' : 'bg-white/[0.05] group-hover:bg-white/[0.08]'
            }`}
          >
            {node.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white leading-none mb-1.5 truncate">{node.title}</p>
            <span
              className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none transition-colors duration-300 ${
                active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.06] text-gray-600'
              }`}
            >
              {node.tag}
            </span>
          </div>
        </div>

        {/* desc */}
        <p className="text-[11px] text-gray-500 leading-[1.65] line-clamp-2 group-hover:text-gray-400 transition-colors duration-200">
          {node.desc}
        </p>

        {/* expanded detail */}
        {active && (
          <div className="mt-3.5 pt-3.5 border-t border-white/[0.06]">
            <p className="text-[11px] text-gray-300 leading-[1.8]">{node.detail}</p>
          </div>
        )}

        {/* chevron */}
        <div
          className={`absolute bottom-3 right-3 transition-all duration-200 text-gray-600 ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
          }`}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d={active ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'}
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [prompt,       setPrompt]       = useState('')
  const [selections,   setSelections]   = useState<SelectionMap>({
    writer: 'commercial', director: 'auteur', casting: 'cool', dop: 'arri',
  })
  const [loading,      setLoading]      = useState(false)
  const [phaseIdx,     setPhaseIdx]     = useState(0)
  const [nodes,        setNodes]        = useState<NodeData[]>([])
  const [visibleCount, setVisibleCount] = useState(0)
  const [activeId,     setActiveId]     = useState<string | null>(null)
  const [generated,    setGenerated]    = useState(false)

  const generate = async () => {
    if (loading) return
    setLoading(true)
    setGenerated(false)
    setNodes([])
    setVisibleCount(0)
    setActiveId(null)

    for (let i = 0; i < PHASES.length; i++) {
      setPhaseIdx(i)
      await wait(460)
    }

    const built = buildNodes(prompt, selections)
    setNodes(built)

    for (let i = 1; i <= built.length; i++) {
      setVisibleCount(i)
      await wait(100)
    }

    setLoading(false)
    setGenerated(true)
  }

  const select = (deptId: string, optId: string) =>
    setSelections((prev) => ({ ...prev, [deptId]: optId }))

  const toggleNode = (id: string) =>
    setActiveId((prev) => (prev === id ? null : id))

  return (
    <div className="h-screen flex flex-col bg-[#0a0f1a] text-white overflow-hidden">
      <Nav />

      <div className="flex flex-col flex-1 overflow-hidden pt-14">

        {/* ── Status bar ────────────────────────────────────────────────────── */}
        <div
          className="h-9 flex-shrink-0 border-b border-white/[0.05] px-6 flex items-center gap-3 relative overflow-hidden transition-colors duration-500"
          style={{ background: loading ? 'rgba(99,102,241,0.04)' : 'transparent' }}
        >
          {loading ? (
            <>
              <div className="flex gap-[3px] flex-shrink-0">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block w-[3px] h-[3px] rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-indigo-300 font-medium">{PHASES[phaseIdx]}</span>
              <div
                className="absolute bottom-0 left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${((phaseIdx + 1) / PHASES.length) * 100}%` }}
              />
            </>
          ) : generated ? (
            <span className="text-[11px] text-emerald-400/80 font-medium">
              ✓ 工作流生成完成 — 点击节点展开详情
            </span>
          ) : (
            <span className="text-[11px] text-gray-600">
              配置创作参数，点击「生成工作流」启动 AI 剧组
            </span>
          )}
        </div>

        {/* ── Main split ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left panel (420px) ─────────────────────────────────────────── */}
          <aside className="w-[420px] flex-shrink-0 flex flex-col border-r border-white/[0.05]">

            {/* scrollable config */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
              {/* header */}
              <div>
                <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-indigo-400/50 mb-1">
                  Creator City · 创作工作台
                </p>
                <h1 className="text-[18px] font-bold tracking-tight">AI 剧组配置</h1>
                <p className="text-[11px] text-gray-600 mt-1 leading-5">
                  选择你的创作班底，让 AI 协同生成完整方案
                </p>
              </div>

              <div className="h-px bg-white/[0.05]" />

              {/* story textarea */}
              <div>
                <label className="block text-[10px] font-bold tracking-[0.16em] uppercase text-gray-500 mb-2.5">
                  故事创意
                </label>
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="输入你的创意，例如：一个失忆的女导演在废弃影院里看见自己未拍完的未来电影"
                    rows={4}
                    className="w-full bg-white/[0.025] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-700 resize-none outline-none leading-[1.7] focus:border-indigo-500/40 focus:bg-indigo-500/[0.03] transition-all duration-200"
                  />
                  <span className="absolute bottom-3 right-3.5 text-[10px] text-gray-700 pointer-events-none">
                    {prompt.length}
                  </span>
                </div>
              </div>

              {/* dept selectors */}
              {DEPTS.map((dept) => (
                <SelectorCard
                  key={dept.id}
                  dept={dept}
                  selected={selections[dept.id]}
                  onSelect={(id) => select(dept.id, id)}
                />
              ))}

              <div className="h-2" />
            </div>

            {/* CTA button */}
            <div className="px-5 py-4 border-t border-white/[0.05] flex-shrink-0">
              <button
                onClick={generate}
                disabled={loading}
                className={`w-full h-[46px] rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2.5 outline-none ${
                  loading
                    ? 'bg-indigo-600/25 text-indigo-300/50 cursor-not-allowed'
                    : 'bg-indigo-500 text-white hover:bg-indigo-400 active:scale-[0.98] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
                }`}
              >
                {loading ? (
                  <>
                    <span className="w-[14px] h-[14px] border-[1.5px] border-indigo-400/30 border-t-indigo-300/70 rounded-full animate-spin flex-shrink-0" />
                    AI 剧组创作中…
                  </>
                ) : (
                  <>
                    <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                      <path d="M0 0L10 6L0 12V0Z" />
                    </svg>
                    生成工作流
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-gray-700 mt-2">
                约 3 秒 · 编剧 · 导演 · 选角 · 摄影协同输出
              </p>
            </div>
          </aside>

          {/* ── Right canvas ──────────────────────────────────────────────── */}
          <div className="flex-1 relative overflow-hidden">

            {/* dot grid */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />

            {/* radial vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 55%, #0a0f1a 100%)',
              }}
            />

            {nodes.length === 0 ? (
              /* ── Empty state ──────────────────────────────────────────── */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 select-none pointer-events-none">
                {/* icon */}
                <div className="w-[72px] h-[72px] rounded-[22px] border border-white/[0.07] bg-white/[0.02] flex items-center justify-center text-4xl">
                  🎬
                </div>

                {/* copy */}
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-gray-400">
                    这里将生成你的创作工作流
                  </p>
                  <p className="text-[12px] text-gray-700 mt-1.5">
                    在左侧配置 AI 剧组后点击「生成工作流」
                  </p>
                </div>

                {/* ghost node chain */}
                <div className="flex items-center gap-0 mt-3" style={{ opacity: 0.14 }}>
                  {GHOST_NODES.map((n, i) => (
                    <Fragment key={n.label}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-12 h-12 rounded-xl border border-white/25 bg-white/[0.03] flex items-center justify-center text-xl">
                          {n.icon}
                        </div>
                        <span className="text-[9px] text-gray-500">{n.label}</span>
                      </div>
                      {i < GHOST_NODES.length - 1 && (
                        <div className="flex items-center mb-4 mx-1.5">
                          <div className="w-5 h-px bg-white/20" />
                          <div
                            className="w-0 h-0"
                            style={{
                              borderTop: '3px solid transparent',
                              borderBottom: '3px solid transparent',
                              borderLeft: '4px solid rgba(255,255,255,0.20)',
                            }}
                          />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Node chain ──────────────────────────────────────────── */
              <div className="h-full overflow-x-auto overflow-y-hidden flex items-start">
                <div className="flex items-start px-12 py-14 min-w-max gap-0">
                  {nodes.map((node, i) => (
                    <Fragment key={node.id}>
                      <WorkflowNode
                        node={node}
                        active={activeId === node.id}
                        visible={i < visibleCount}
                        index={i}
                        onClick={() => toggleNode(node.id)}
                      />
                      {i < nodes.length - 1 && (
                        <NodeConnector visible={i + 1 < visibleCount} index={i} />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
