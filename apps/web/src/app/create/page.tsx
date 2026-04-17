'use client'

import { useState } from 'react'

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    setResult([])

    await new Promise(r => setTimeout(r, 800))

    setResult([
      '开场：建立世界观与人物状态',
      '发展：冲突逐渐升级',
      '高潮：关键抉择与转折',
      '结尾：情绪回收与主题表达'
    ])

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <a href="/" className="text-white/60 text-sm">← 返回首页</a>

      <h1 className="text-3xl font-bold mt-6">创作工作台</h1>

      <div className="mt-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入你的创意..."
          className="w-full p-4 rounded bg-black border border-white/20"
        />
      </div>

      <button
        onClick={generate}
        className="mt-4 px-6 py-3 bg-indigo-500 rounded"
      >
        开始生成
      </button>

      <div className="mt-6">
        {loading && <div>生成中...</div>}

        {result.map((item, i) => (
          <div key={i} className="mt-2 p-3 border border-white/10 rounded">
            {item}
          </div>
        ))}
      </div>
    </main>
  )
}
