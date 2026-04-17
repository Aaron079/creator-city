'use client'

import { useState } from 'react'

type Node = {
  id: string
  title: string
  desc: string
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    setNodes([])
    await new Promise(r => setTimeout(r, 600))
    setNodes([
      { id: '1', title: 'Prompt', desc: prompt || '一个失忆的导演在影院寻找自我' },
      { id: '2', title: '编剧', desc: '构建故事结构与人物动机' },
      { id: '3', title: '导演', desc: '确定节奏与镜头语言' },
      { id: '4', title: '选角', desc: '匹配人物气质与角色形象' },
      { id: '5', title: '摄影', desc: '设计视觉风格与镜头运动' },
      { id: '6', title: '输出', desc: '形成完整创作方案' },
    ])
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-8">
      <h1 className="text-4xl font-bold mb-6">🚀 节点画布工作台 V2</h1>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/50 mb-3">故事输入</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你的创意..."
            className="w-full h-32 rounded-xl bg-black border border-white/20 p-4"
          />
          <button
            onClick={generate}
            className="mt-4 px-6 py-3 bg-indigo-500 rounded-xl"
          >
            {loading ? '生成中...' : '生成工作流'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
          <div className="text-sm text-white/50 mb-4">Canvas</div>

          {nodes.length === 0 ? (
            <div className="text-white/40">这里会出现：Prompt → 编剧 → 导演 → 选角 → 摄影 → 输出</div>
          ) : (
            <div className="flex gap-4 min-w-[1000px] items-center">
              {nodes.map((node, i) => (
                <div key={node.id} className="flex items-center gap-4">
                  <div className="w-[220px] rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-sm text-indigo-300">{node.title}</div>
                    <div className="mt-2 text-white/80">{node.desc}</div>
                  </div>
                  {i < nodes.length - 1 && <div className="w-8 h-px bg-white/20" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
