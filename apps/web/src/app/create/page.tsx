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

    await new Promise(r => setTimeout(r, 800))

    setNodes([
      { id: '1', title: 'Prompt', desc: prompt || '一个失忆的导演在影院寻找自我' },
      { id: '2', title: '编剧', desc: '构建故事结构与人物动机' },
      { id: '3', title: '导演', desc: '确定节奏与镜头语言' },
      { id: '4', title: '选角', desc: '匹配人物气质' },
      { id: '5', title: '摄影', desc: '设计视觉风格与镜头运动' },
      { id: '6', title: '输出', desc: '形成完整创作方案' },
    ])

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white px-10 py-10">
      
      <h1 className="text-4xl font-bold mb-6">🎬 节点画布工作台</h1>

      {/* 输入区 */}
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

      {/* 画布 */}
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-[900px]">

          {nodes.map((node, i) => (
            <div key={node.id} className="flex items-center gap-6">

              <div className="w-[220px] p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm text-white/40">{node.title}</div>
                <div className="mt-2 font-bold">{node.desc}</div>
              </div>

              {i < nodes.length - 1 && (
                <div className="w-10 h-[1px] bg-white/20" />
              )}

            </div>
          ))}

        </div>
      </div>

    </main>
  )
}
