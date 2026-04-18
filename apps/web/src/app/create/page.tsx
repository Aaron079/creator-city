'use client'

import { useState, useCallback } from 'react'
import { CanvasProvider } from '@/components/canvas/CanvasProvider'
import { EditorCanvas } from '@/components/canvas/EditorCanvas'
import { useCanvasStore } from '@/store/canvas.store'

const STYLES = ['商业广告', '电影感', '短剧', '纪录片', 'MV', '品牌故事']

function LeftPanel() {
  const [idea, setIdea] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('商业广告')
  const [running, setRunning] = useState(false)

  const updateNode = useCanvasStore((s) => s.updateNode)
  const setPrompt = useCanvasStore((s) => s.setPrompt)

  const handleIdeaChange = useCallback(
    (v: string) => {
      setIdea(v)
      setPrompt(v)
      updateNode('prompt-1', { content: v })
    },
    [setPrompt, updateNode]
  )

  const handleGenerate = useCallback(() => {
    if (!idea.trim() || running) return
    setRunning(true)

    const agents = ['agent-writer', 'agent-director', 'agent-actor', 'agent-dop', 'agent-editor']
    agents.forEach((id, i) => {
      setTimeout(() => updateNode(id, { status: 'pending', progress: 0 }), i * 300)
      setTimeout(() => updateNode(id, { status: 'running', progress: 10 }), i * 300 + 600)

      const tick = (p: number) => {
        if (p >= 100) {
          updateNode(id, { status: 'done', progress: 100, result: `已完成 ${selectedStyle} 方向创作` })
          if (id === 'agent-editor') {
            setRunning(false)
            updateNode('output-1', { content: `《${idea.slice(0, 20)}》${selectedStyle}方案已生成，共 5 个场景。` })
          }
          return
        }
        const next = Math.min(p + Math.floor(Math.random() * 18 + 8), 100)
        updateNode(id, { progress: next })
        setTimeout(() => tick(next), 300)
      }
      setTimeout(() => tick(10), i * 300 + 900)
    })
  }, [idea, running, selectedStyle, updateNode])

  return (
    <aside className="w-[300px] flex-shrink-0 flex flex-col gap-5 px-6 py-7 border-r border-white/[0.07] bg-[#070b14]">
      {/* Brand */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">AI 导演工作台</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">输入创意，AI 剧组立即开工</p>
      </div>

      {/* Creative input */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">创意描述</label>
        <textarea
          value={idea}
          onChange={(e) => handleIdeaChange(e.target.value)}
          placeholder="描述你的视频创意，例如：一个关于咖啡与孤独的短片…"
          rows={5}
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder-gray-600 resize-none outline-none px-3.5 py-3 leading-6 focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Style selection */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">风格</label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStyle(s)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: selectedStyle === s ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                border: selectedStyle === s ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.07)',
                color: selectedStyle === s ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!idea.trim() || running}
        className="mt-auto w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: running
            ? 'rgba(99,102,241,0.15)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
        }}
      >
        {running ? '生成中…' : '🎬 开始生成'}
      </button>

      {/* Hint */}
      <p className="text-[10px] text-gray-600 text-center">
        滚轮缩放 · 空格+拖拽平移
      </p>
    </aside>
  )
}

export default function CreatePage() {
  return (
    <CanvasProvider>
      <div className="flex h-screen bg-[#070b14] overflow-hidden">
        <LeftPanel />
        <div className="flex-1 min-w-0">
          <EditorCanvas />
        </div>
      </div>
    </CanvasProvider>
  )
}
