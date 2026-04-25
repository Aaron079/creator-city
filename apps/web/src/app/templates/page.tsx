import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

const TEMPLATE_GROUPS = [
  {
    title: '广告片',
    scene: '适合品牌露出、产品卖点和节奏明确的商业内容。',
    roles: '导演 / 制片 / 美术 / 后期',
    flow: '文本开题 -> 关键画面 -> 视频镜头 -> 审片',
  },
  {
    title: '品牌短片',
    scene: '适合讲品牌语气、人物情绪和空间世界观。',
    roles: '导演 / 编剧 / 摄影 / 剪辑',
    flow: '文本结构 -> 情绪板 -> 视觉预演 -> 交付包',
  },
  {
    title: '产品展示',
    scene: '适合功能演示、关键卖点和细节特写。',
    roles: '导演 / 产品市场 / 3D / 后期',
    flow: '产品脚本 -> 图片参考 -> 特写镜头 -> 交付',
  },
  {
    title: '短剧片段',
    scene: '适合人物冲突、情节片段和竖屏节奏。',
    roles: '编剧 / 导演 / 摄影 / 剪辑',
    flow: '文本节点 -> 角色画面 -> 视频片段 -> 审片',
  },
  {
    title: '概念短片',
    scene: '适合世界观、风格实验和概念提案。',
    roles: '导演 / 概念设计 / 视觉开发 / 声音',
    flow: '情绪板 -> 概念图 -> 视频试验 -> 声音氛围',
  },
  {
    title: 'MV',
    scene: '适合氛围驱动、节奏先行和视听配合的创作。',
    roles: '导演 / 摄影 / 剪辑 / 声音',
    flow: '音乐方向 -> 关键画面 -> 节奏剪辑 -> 交付',
  },
]

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-[28px]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Templates</div>
          <h1 className="mt-4 text-4xl font-light tracking-[-0.05em] text-white">模板库</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/56">
            模板页独立存在，先帮助用户理解适合场景、推荐角色和流程建议，再决定是否进入自由 AI Canvas。第一版使用前端 mock，不假装这些模板已经接入真实生成链路。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="inline-flex items-center rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition hover:scale-[1.01]"
            >
              进入 AI 画布
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
            >
              查看工作空间
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATE_GROUPS.map((template) => (
            <article
              key={template.title}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-[24px]"
            >
              <div className="h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_34%),linear-gradient(135deg,rgba(62,52,113,0.9),rgba(16,22,32,0.92),rgba(5,5,5,1))]" />
              <div className="p-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/34">Mock Template</div>
                <h2 className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">{template.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/55">{template.scene}</p>

                <div className="mt-5 space-y-2 text-sm leading-7 text-white/48">
                  <div>
                    <span className="text-white/34">推荐角色：</span>
                    {template.roles}
                  </div>
                  <div>
                    <span className="text-white/34">推荐流程：</span>
                    {template.flow}
                  </div>
                </div>

                <Link
                  href="/create"
                  className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:text-white"
                >
                  进入创建
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
