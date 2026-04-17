export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_35%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="text-lg font-semibold tracking-wide">Creator City</div>
        <nav className="flex items-center gap-3 text-sm">
          <a
            href="/create"
            className="px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition"
          >
            创作
          </a>
          <a
            href="/explore"
            className="px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition"
          >
            探索
          </a>
          <a
            href="/community"
            className="px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition"
          >
            社区
          </a>
          <a
            href="/studio"
            className="px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition"
          >
            我的工作室
          </a>
        </nav>
      </header>

      <section className="relative z-10 px-6 md:px-10 pt-20 md:pt-28 pb-20">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-200 text-sm mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            现已开启抢先体验
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">
            你的 AI 创意城市正在等待你
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/65 max-w-3xl mx-auto leading-8">
            一句话生成电影级作品。编剧、导演、演员、摄影协同工作，让你的创意直接进入可视化创作流程。
          </p>

          <div className="mt-10 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 md:p-4 shadow-2xl shadow-indigo-900/20">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  className="flex-1 h-14 rounded-xl bg-black/40 border border-white/10 px-5 text-base outline-none placeholder:text-white/30 focus:border-indigo-400/50"
                  placeholder="输入你的创意，例如：一个孤独的宇航员在月球遇见未来的自己"
                />
                <a
                  href="/create"
                  className="h-14 px-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition flex items-center justify-center text-base font-semibold shadow-lg shadow-indigo-500/30"
                >
                  立即生成
                </a>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-white/45">
                <span>热门方向：</span>
                <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">商业大片</span>
                <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">文艺电影</span>
                <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">爆款短视频</span>
              </div>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-indigo-300">10000+</div>
              <div className="mt-2 text-white/45 text-sm">创作者</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-indigo-300">5万+</div>
              <div className="mt-2 text-white/45 text-sm">项目</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-indigo-300">20万+</div>
              <div className="mt-2 text-white/45 text-sm">AI 代理</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}