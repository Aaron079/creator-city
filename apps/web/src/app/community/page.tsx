import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

const COMMUNITY_CHANNELS = [
  {
    title: '灵感分享',
    description: '发布片段、视觉风格、脚本灵感和创作方法，给团队一个公开的起点。',
  },
  {
    title: '项目讨论',
    description: '围绕具体项目交流推进方式、镜头拆解、节奏和交付预期。',
  },
  {
    title: '创作者问答',
    description: '向导演、制片、摄影、剪辑和创作者同行发起具体问题。',
  },
  {
    title: '案例复盘',
    description: '把一次创作过程拆开看，讨论为什么这个方案有效或失效。',
  },
  {
    title: '协作招募',
    description: '寻找摄影、剪辑、声音、后期或联合作品伙伴。',
  },
  {
    title: '开源工作流',
    description: '把自己的节点工作流公开到社群，供其他创作者学习、讨论和复用。',
  },
]

const COMMUNITY_FEED = [
  {
    title: '赛博城市广告片在画布里怎么起手？',
    meta: '灵感分享 · 12 分钟前',
    summary: '大家在讨论是先用文本节点搭结构，还是先抓一张视觉 keyframe 再推视频节点。',
  },
  {
    title: '品牌短片复盘：为什么这次交付比脚本阶段快了两轮？',
    meta: '案例复盘 · 46 分钟前',
    summary: '团队把时间花在前置镜头测试上，最后审片轮次明显减少。',
  },
  {
    title: '正在招募声音设计师，偏电影感与低频氛围方向',
    meta: '协作招募 · 2 小时前',
    summary: '需求是短片级别的声音氛围与音乐结构，支持远程协作。',
  },
  {
    title: '把“文本 -> 首帧 -> 视频”工作流开源给社区复用',
    meta: '开源工作流 · 刚刚',
    summary: '作者把自己的节点顺序、参数选择和阶段说明发布出来，其他人可以从这里学习创作路径。',
  },
]

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-[28px]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Community</div>
          <h1 className="mt-4 text-4xl font-light tracking-[-0.05em] text-white">创作者社群</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/56">
            这里是 Creator City 的公开交流入口。第一版先用前端 mock 把灵感分享、项目讨论、创作者问答、案例复盘、协作招募和开源工作流做清楚，不假装已经有完整社区后端。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
            >
              去探索
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
            >
              回到 AI 画布
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
            >
              查看模板
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">讨论区</div>
            <div className="mt-4 grid gap-3">
              {COMMUNITY_CHANNELS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/8 bg-black/20 p-4"
                >
                  <div className="text-lg font-light tracking-[-0.03em] text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-white/52">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Mock Feed</div>
                <div className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">近期讨论</div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/38">
                前端 mock
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {COMMUNITY_FEED.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[22px] border border-white/8 bg-black/20 p-5"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">{item.meta}</div>
                  <h2 className="mt-3 text-lg font-light tracking-[-0.03em] text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/54">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
