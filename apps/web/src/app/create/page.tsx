'use client'

export default function CreatePage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <a href="/" className="text-white/60 text-sm">← 返回首页</a>

      <h1 className="text-4xl font-bold mt-8">CREATE 页面已独立</h1>
      <p className="mt-4 text-white/60">
        如果你看到这段话，说明 /create 已经不再和首页重复。
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        这里下一步会接入：故事输入框、编剧、导演、选角、摄影、节点画布。
      </div>
    </main>
  )
}
