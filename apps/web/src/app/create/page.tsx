'use client'

import { useState } from 'react'

type Node = {
  id: string
  title: string
  content: string
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)

  const generateFlow = async () => {
    setLoading(true)
    setNodes([])

    await new Promise(r => setTimeout(r, 600))

    const base = prompt || '一个失忆导演在影院看到未来的自己'

    const newNodes: Node[] = [
      {
        id: '1',
        title: 'Prompt',
        content: base
      },
      {
        id: '2',
        title: '编剧',
        content: '构建三幕式结构，确定人物动机与冲突'
      },
      {
        id: '3',
        title: '导演',
        content: '设计镜头节奏与叙事方式'
      },
      {
        id: '4',
        title: '选角',
        content: '匹配冷感主角，强化气质表达'
      },
      {
        id: '5',
        title: '摄影',
        content: 'ARRI电影感，低饱和冷色调'
      },
      {
        id: '6',
        title: '输出',
        content: '生成分镜结构 + 情绪推进'
      }
    ]

    setNodes(newNodes)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <a href="/" className="text-white/60 text-sm">← 返回首页</a>

      <h1 className="text-3xl font-bold mt-6">节点画布（导演系统）</h1>

      <div className="mt-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入你的创意..."
          className="w-full p-4 rounded bg-black border border-white/20"
        />
      </div>

      <button
        onClick={generateFlow}
        className="mt-4 px-6 py-3 bg-indigo-500 rounded"
      >
        生成工作流
      </button>

      <div className="mt-10 flex flex-col items-center gap-6">
        {loading && <div>AI导演系统正在构建流程...</div>}

        {nodes.map((node, index) => (
          <div key={node.id} className="flex flex-col items-center">
            <div className="w-72 p-4 rounded-xl border border-white/10 bg-white/5 text-center">
              <div className="text-sm text-indigo-300">{node.title}</div>
              <div className="mt-2 text-white/70 text-sm">{node.content}</div>
            </div>

            {index < nodes.length - 1 && (
              <div className="h-6 w-px bg-white/20 my-2"></div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
