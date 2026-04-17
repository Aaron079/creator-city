'use client'

import { useState } from 'react'

type Node = {
  id: string
  title: string
  desc: string
  detail: string
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setNodes([])

    await new Promise(r => setTimeout(r, 800))

    setNodes([
      { id: '1', title: 'Prompt', desc: prompt || '一个失忆的导演在影院寻找自我', detail: '这是整个故事的核心输入来源。' },
      { id: '2', title: '编剧', desc: '构建故事结构与人物动机', detail: '三幕式结构 + 冲突设计 + 人物弧线。' },
      { id: '3', title: '导演', desc: '确定节奏与镜头语言', detail: '长镜头 vs 快剪，情绪控制方式。' },
      { id: '4', title: '选角', desc: '匹配人物气质', detail: '演员气质决定观众代入感。' },
      { id: '5', title: '摄影', desc: '设计视觉风格与镜头运动', detail: 'ARRI电影感 + 手持混合。' },
      { id: '6', title: '输出', desc: '形成完整创作方案', detail: '可以进入分镜与视频生成阶段。' },
    ])

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white px-10 py-10">
      <h1 className="text-4xl font-bold mb-6">🎬 节点画布工作台</h1>

      <div className="mb-8">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入你的创意..."
          className="w-full h-24 bg-black border border-white/20 rounded-xl p-4"
        />
        <button
          onClick={generate}
          className="mt-4 px-6 py-3 bg-indigo-500 rounded-xl"
        >
          {loading ? '生成中...' : '生成工作流'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-[900px]">
          {nodes.map((node, i) => {
            const active = activeId === node.id

            return (
              <div key={node.id} className="flex items-center gap-6">
                <div
                  onClick={() => setActiveId(active ? null : node.id)}
                  className={`w-[240px] p-4 rounded-xl border cursor-pointer transition ${
                    active
                      ? 'bg-indigo-500/20 border-indigo-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm text-white/40">{node.title}</div>
                  <div className="mt-2 font-bold">{node.desc}</div>

                  {active && (
                    <div className="mt-3 text-sm text-white/60 leading-6">
                      {node.detail}
                    </div>
                  )}
                </div>

                {i < nodes.length - 1 && (
                  <div className="w-10 h-[1px] bg-white/20" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
