export default function Home() {
  const creatableItems = [
    { title: '电影短片', desc: '从一句创意生成剧情短片方向。' },
    { title: '广告脚本', desc: '快速组合商业叙事与品牌表达。' },
    { title: '剧情分镜', desc: '生成结构清晰的镜头与画面节奏。' },
    { title: '视觉概念', desc: '先确定人物、气质、摄影与氛围。' },
  ]

  const outputs = [
    { title: '故事结构', desc: '开场、冲突、高潮、落点' },
    { title: '角色设定', desc: '演员气质与角色功能' },
    { title: '导演方案', desc: '节奏、表达、镜头语言' },
    { title: '摄影风格', desc: '电影感、手持、稳定器、航拍' },
  ]

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <section className="relative min-h-screen flex items-center justify-center px-6 md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_35%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-200 text-sm mb-6">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Creator City 抢先体验
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">
              让 AI 剧组为你开始创作
            </h1>

            <p className="mt-6 text-lg md:text-xl text-white/65 leading-8 max-w-2xl">
              一句创意，进入电影级创作流程。编剧、导演、演员、摄影协同工作，把灵感推进成可执行的作品方案。
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href="/create"
                className="h-14 px-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition flex items-center justify-center text-base font-semibold shadow-lg shadow-indigo-500/30"
              >
                进入创作工作台
              </a>

              <a
                href="/explore"
                className="h-14 px-8 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-base"
              >
                浏览作品
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[16/10] rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl shadow-indigo-900/20">
              <div className="h-full w-full flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.30),transparent_38%)]">
                <div className="text-center px-6">
                  <div className="text-sm uppercase tracking-[0.3em] text-white/40 mb-4">Main Visual</div>
                  <div className="text-2xl md:text-3xl font-bold">这里放你的主视频 / 动图</div>
                  <div className="mt-3 text-white/50 text-sm md:text-base">
                    建议使用电影感动态视觉，突出“AI 剧组正在工作”的感觉
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-sm text-indigo-200/80">你可以开始创作</div>
          <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
            从灵感到作品的起点
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {creatableItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
              >
                <div className="text-lg font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-7 text-white/55">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-sm text-indigo-200/80">生成结果会包含</div>
          <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
            清晰的输出形式
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {outputs.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/25 p-5"
              >
                <div className="text-lg font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-7 text-white/55">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
