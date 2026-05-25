import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

type ChannelStatus = '讨论中' | '预览' | '即将开放'
type FeedStatus = '热议' | '新' | '招募中' | '待回答'

const COMMUNITY_CHANNELS: Array<{
  title: string
  description: string
  status: ChannelStatus
}> = [
  {
    title: '灵感分享',
    description: '发布片段、视觉风格、脚本灵感和创作方法，给团队一个公开的起点。',
    status: '讨论中',
  },
  {
    title: '项目讨论',
    description: '围绕具体项目交流推进方式、镜头拆解、节奏和交付预期。',
    status: '讨论中',
  },
  {
    title: '创作者问答',
    description: '向导演、制片、摄影、剪辑和创作者同行发起具体问题。',
    status: '讨论中',
  },
  {
    title: '案例复盘',
    description: '把一次创作过程拆开看，讨论为什么这个方案有效或失效。',
    status: '讨论中',
  },
  {
    title: '协作招募',
    description: '寻找摄影、剪辑、声音、后期或联合作品伙伴。',
    status: '预览',
  },
  {
    title: '开源工作流',
    description: '把自己的节点工作流公开到社群，供其他创作者学习、讨论和复用。',
    status: '预览',
  },
  {
    title: 'AI 视频工作流',
    description: '专门讨论用 AI 工具完成视频生成、节奏控制和批次交付的实战经验。',
    status: '即将开放',
  },
  {
    title: 'AI 图像工作流',
    description: '图像生成的 prompt 策略、参数优化、风格一致性和批量输出方法。',
    status: '即将开放',
  },
  {
    title: '项目招募',
    description: '发布制作需求或寻找联合创作机会，面向独立创作者和小型团队。',
    status: '即将开放',
  },
  {
    title: '商业广告',
    description: '品牌广告、产品片、短视频广告的创作经验与工作流分享。',
    status: '即将开放',
  },
  {
    title: '漫剧 / 短剧',
    description: '以 AI 辅助完成连续性叙事、角色一致性和分集结构的实践讨论。',
    status: '即将开放',
  },
]

// All items are front-end mock — not real user data, not stored in DB
const COMMUNITY_FEED: Array<{
  title: string
  type: string
  meta: string
  summary: string
  author: string
  status: FeedStatus
}> = [
  {
    title: '赛博城市广告片在画布里怎么起手？',
    type: '灵感分享',
    meta: '12 分钟前',
    summary: '大家在讨论是先用文本节点搭结构，还是先抓一张视觉 keyframe 再推视频节点。',
    author: 'creator_demo_01',
    status: '热议',
  },
  {
    title: '品牌短片复盘：为什么这次交付比脚本阶段快了两轮？',
    type: '案例复盘',
    meta: '46 分钟前',
    summary: '团队把时间花在前置镜头测试上，最后审片轮次明显减少。',
    author: 'creator_demo_02',
    status: '热议',
  },
  {
    title: '正在招募声音设计师，偏电影感与低频氛围方向',
    type: '协作招募',
    meta: '2 小时前',
    summary: '需求是短片级别的声音氛围与音乐结构，支持远程协作。',
    author: 'creator_demo_03',
    status: '招募中',
  },
  {
    title: '把"文本 → 首帧 → 视频"工作流开源给社区复用',
    type: 'AI 视频工作流',
    meta: '刚刚',
    summary: '作者把自己的节点顺序、参数选择和阶段说明发布出来，其他人可以从这里学习创作路径。',
    author: 'creator_demo_04',
    status: '新',
  },
  {
    title: 'Seedream 图像生成 prompt 结构分享：如何稳定输出风格？',
    type: 'AI 图像工作流',
    meta: '3 小时前',
    summary: '从反复迭代中总结出的 prompt 结构模板，适合品牌广告和概念图场景。',
    author: 'creator_demo_05',
    status: '热议',
  },
  {
    title: '商业广告项目：30s 产品片从画布到交付的全流程',
    type: '商业广告',
    meta: '5 小时前',
    summary: '包含镜头策划、配音和后期风格决策，整个过程用 Creator City 画布协调。',
    author: 'creator_demo_06',
    status: '新',
  },
  {
    title: 'AI 漫剧角色一致性怎么做？分集结构和风格锁定经验分享',
    type: '漫剧 / 短剧',
    meta: '8 小时前',
    summary: '连续剧集中保持角色外观一致是难点之一，这里分享一种分镜 + 首帧固定的工作流。',
    author: 'creator_demo_07',
    status: '新',
  },
  {
    title: '有没有人在做纪录片风格的 AI 视频？节奏怎么控制？',
    type: '创作者问答',
    meta: '昨天',
    summary: '纪录片风格需要更强的时间感和叙事节奏，想了解有没有人在 AI 视频里实现过。',
    author: 'creator_demo_08',
    status: '待回答',
  },
]

const COLLAB_ITEMS = [
  { label: '发布项目需求', desc: '向社群发布创作需求，寻找合作伙伴' },
  { label: '寻找创作者', desc: '浏览创作者主页，直接发起协作邀请' },
  { label: '加入制作小组', desc: '加入已有项目团队，参与分工协作' },
  { label: '分享作品', desc: '公开你的创作成果，接受社群反馈' },
]

const COMMUNITY_RULES = [
  '尊重版权，不上传未授权素材或他人完整作品。',
  '不泄露 API key、token 或任何账户凭证。',
  '商业合作需在平台外自行确认权责，本社区不承担法律责任。',
  '保持讨论与创作相关，不发布无关广告或垃圾内容。',
  '后续将接入项目权限和协作流程，规则随功能迭代持续完善。',
]

const CHANNEL_STATUS_STYLE: Record<ChannelStatus, { color: string; bg: string; border: string }> = {
  '讨论中': {
    color: '#6ee7b7',
    bg: 'rgba(6,78,59,0.32)',
    border: 'rgba(52,211,153,0.22)',
  },
  '预览': {
    color: '#93c5fd',
    bg: 'rgba(30,58,138,0.32)',
    border: 'rgba(96,165,250,0.22)',
  },
  '即将开放': {
    color: 'rgba(255,255,255,0.36)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.09)',
  },
}

const FEED_STATUS_STYLE: Record<FeedStatus, { color: string; bg: string }> = {
  '热议': { color: '#f9a8d4', bg: 'rgba(157,23,77,0.28)' },
  '新': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.28)' },
  '招募中': { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)' },
  '待回答': { color: '#93c5fd', bg: 'rgba(30,58,138,0.28)' },
}

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-24">

        {/* ── Hero ── */}
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

        {/* ── Channels + Feed ── */}
        <section className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">

          {/* Left: channels */}
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">讨论区</div>
            <div className="mt-4 grid gap-3">
              {COMMUNITY_CHANNELS.map((item) => {
                const s = CHANNEL_STATUS_STYLE[item.status]
                return (
                  <div
                    key={item.title}
                    style={{
                      borderRadius: 22,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(0,0,0,0.18)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 300, letterSpacing: '-0.03em', color: '#fff' }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          color: s.color,
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                          borderRadius: 99,
                          padding: '2px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.48)' }}>
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: feed */}
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Mock Feed</div>
                <div className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">近期讨论</div>
              </div>
              <span
                style={{
                  borderRadius: 99,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '3px 12px',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.36)',
                  whiteSpace: 'nowrap',
                }}
              >
                前端 mock · 只读预览
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {COMMUNITY_FEED.map((item) => {
                const fs = FEED_STATUS_STYLE[item.status]
                return (
                  <article
                    key={item.title}
                    style={{
                      borderRadius: 22,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(0,0,0,0.18)',
                      padding: '16px 18px',
                    }}
                  >
                    {/* chips row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.38)',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 99,
                          padding: '2px 8px',
                        }}
                      >
                        {item.type}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: fs.color,
                          background: fs.bg,
                          borderRadius: 99,
                          padding: '2px 8px',
                        }}
                      >
                        {item.status}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.26)' }}>
                        {item.meta}
                      </span>
                    </div>

                    <h2 style={{ marginTop: 10, fontSize: 15, fontWeight: 300, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.45 }}>
                      {item.title}
                    </h2>
                    <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.48)' }}>
                      {item.summary}
                    </p>
                    <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
                      @{item.author}
                      <span style={{ opacity: 0.5 }}> · demo</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Collaboration ── */}
        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">创作者协作</div>
          <div className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">协作入口</div>
          <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.44)' }}>
            协作功能正在建设中，以下入口即将开放。纯前端展示，不连接数据库，不触发任何 API 调用。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COLLAB_ITEMS.map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '18px 18px 16px',
                  opacity: 0.70,
                  cursor: 'not-allowed',
                  userSelect: 'none',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.38)' }}>{item.desc}</div>
                <div
                  style={{
                    marginTop: 16,
                    display: 'inline-block',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.30)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 99,
                    padding: '2px 8px',
                  }}
                >
                  即将开放
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Community Rules ── */}
        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[24px]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Community Rules</div>
          <div className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">社区规则</div>
          <ul style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {COMMUNITY_RULES.map((rule, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.20)',
                    paddingTop: 2,
                  }}
                >
                  {i + 1}.
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.56)' }}>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

      </main>
    </div>
  )
}
