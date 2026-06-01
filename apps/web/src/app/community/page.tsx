import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

// All data is static front-end mock — no DB, no API calls, no generation logic

type DistrictStatus = 'available' | 'coming'

const DISTRICTS: Array<{
  id: string
  zh: string
  en: string
  desc: string
  tags: readonly string[]
  rgb: string
  href: string
  status: DistrictStatus
}> = [
  {
    id: 'plaza',
    zh: '城市广场',
    en: 'Plaza',
    desc: '这里是 Creator City 的公共广场。发现正在发生的创作、公告、挑战与推荐创作者。',
    tags: ['公告', '挑战', '推荐创作者'],
    rgb: '251,191,36',
    href: '/explore',
    status: 'available',
  },
  {
    id: 'gallery',
    zh: '作品展厅',
    en: 'Gallery',
    desc: '发现优秀作品，展示你的创作成果。图片、视频、文本、画布项目、商业案例。',
    tags: ['图片', '视频', '画布项目'],
    rgb: '167,139,250',
    href: '/assets',
    status: 'available',
  },
  {
    id: 'studio',
    zh: '创作者工作室',
    en: 'Studio',
    desc: '建立你的城市工作室和创作者身份。个人主页、作品集、可合作状态、创作者身份。',
    tags: ['个人主页', '作品集', '可合作'],
    rgb: '52,211,153',
    href: '/studio',
    status: 'available',
  },
  {
    id: 'market',
    zh: '交易市场',
    en: 'Market',
    desc: '找创作者、发布需求、项目招募、作品授权。未来用于社群交易与合作，不接支付。',
    tags: ['创作者招募', '项目需求', '授权'],
    rgb: '251,146,60',
    href: '/marketplace',
    status: 'available',
  },
  {
    id: 'passport',
    zh: 'Web3 身份',
    en: 'Passport',
    desc: 'Creator ID、声望、徽章、资产归属、未来钱包绑定。先做 Web3 感，不做真实链上。',
    tags: ['Creator ID', '声望', '徽章'],
    rgb: '96,165,250',
    href: '/me',
    status: 'available',
  },
]

const CITY_STATS = [
  { label: '创作者', value: '2,847+' },
  { label: '生成作品', value: '48,293+' },
  { label: '进行中项目', value: '127' },
  { label: '城市区域', value: '5' },
]

const FEATURED_WORKS = [
  { title: '赛博城市广告片', creator: '@creator_01', kind: '视频', icon: '▶', iconColor: 'rgba(167,139,250,0.85)', iconBg: 'rgba(167,139,250,0.12)' },
  { title: 'Seedream 品牌写真集', creator: '@creator_02', kind: '图片', icon: '⬡', iconColor: 'rgba(52,211,153,0.85)', iconBg: 'rgba(52,211,153,0.10)' },
  { title: '商业短片 30s 全流程', creator: '@creator_03', kind: '画布项目', icon: '✦', iconColor: 'rgba(251,191,36,0.85)', iconBg: 'rgba(251,191,36,0.10)' },
]

const RECOMMENDED_CREATORS = [
  { name: '@creator_01', tag: '导演 · AI 视频', rep: 94 },
  { name: '@creator_02', tag: '摄影 · 图像生成', rep: 97 },
  { name: '@creator_03', tag: '制片 · 商业广告', rep: 89 },
]

const HIRING = [
  { title: '声音设计师招募', by: '@creator_05', kind: '远程协作' },
  { title: '剪辑助手 · 短视频', by: '@creator_06', kind: '长期合作' },
  { title: '品牌广告联合创作', by: '@creator_07', kind: '项目制' },
]

const PASSPORT_BADGES = ['早期创作者', '图像先锋', '画布高手', 'AI 导演']

export default function CommunityPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#050509', color: '#fff' }}>

      {/* City grid background — pure CSS, no image deps */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: [
            'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)',
            'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(167,139,250,0.05) 0%, transparent 55%)',
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '100% 100%, 100% 100%, 64px 64px, 64px 64px',
          backgroundPosition: 'center top, center bottom, -1px -1px, -1px -1px',
        }}
      />

      <TopNavigation />

      <main className="relative mx-auto max-w-7xl px-5 pb-24 pt-24">

        {/* ── Hero ── */}
        <section className="pt-10">
          <div style={{ fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(99,102,241,0.72)', marginBottom: 18, fontWeight: 700 }}>
            Creator City · Community Hub
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6.5vw, 76px)', fontWeight: 200, letterSpacing: '-0.05em', lineHeight: 1.08, maxWidth: 720 }}>
            Creator City<br />
            <span style={{ color: 'rgba(255,255,255,0.50)' }}>社群</span>
          </h1>
          <p style={{ marginTop: 22, fontSize: 15, lineHeight: 1.95, color: 'rgba(255,255,255,0.48)', maxWidth: 580 }}>
            这里是 AI 创作者的城市。作品、身份、协作与交易都从这里开始。<br />
            选择你想进入的城市区域，开始你的创作者旅程。
          </p>
          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['作品展示', '创作者身份', '社群交易', 'Web3 资产感'].map((tag) => (
              <span
                key={tag}
                style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '4px 13px' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* ── City Stats ── */}
        <section
          className="mt-10 grid grid-cols-2 sm:grid-cols-4"
          style={{ gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden' }}
        >
          {CITY_STATS.map((s) => (
            <div key={s.label} style={{ background: '#050509', padding: '20px 22px' }}>
              <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: '-0.04em' }}>{s.value}</div>
              <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(255,255,255,0.34)', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── Five Districts ── */}
        <section className="mt-14">
          <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.24)', marginBottom: 22, fontWeight: 700 }}>
            城市区域 · Five Districts
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DISTRICTS.map((d) => (
              <div
                key={d.id}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 28,
                  border: `1px solid rgba(${d.rgb},0.22)`,
                  background: `linear-gradient(145deg, rgba(${d.rgb},0.07) 0%, rgba(0,0,0,0.30) 100%)`,
                  padding: '30px 26px 26px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {/* Glow orb */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: -30,
                    right: -30,
                    width: 160,
                    height: 160,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(${d.rgb},0.16) 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />

                {/* District label */}
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: `rgba(${d.rgb},0.75)`, marginBottom: 16, fontWeight: 700 }}>
                  District · {d.en}
                </div>

                {/* District name */}
                <h2 style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.04em', lineHeight: 1.12, position: 'relative' }}>
                  {d.zh}
                </h2>

                {/* Description */}
                <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.85, color: 'rgba(255,255,255,0.48)' }}>
                  {d.desc}
                </p>

                {/* Keyword badges */}
                <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: `rgba(${d.rgb},0.82)`, background: `rgba(${d.rgb},0.09)`, border: `1px solid rgba(${d.rgb},0.18)`, borderRadius: 99, padding: '3px 10px' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Enter button */}
                <div style={{ marginTop: 26 }}>
                  {d.status === 'available' ? (
                    <Link
                      href={d.href}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: `rgba(${d.rgb},0.90)`, background: `rgba(${d.rgb},0.09)`, border: `1px solid rgba(${d.rgb},0.22)`, borderRadius: 99, padding: '8px 18px', textDecoration: 'none', letterSpacing: 0.2 }}
                    >
                      进入区域 →
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.24)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '8px 18px', letterSpacing: 0.2 }}>
                      即将开放
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── City Activity Strip ── */}
        <section className="mt-14">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.24)', fontWeight: 700 }}>
              城市动态 · Live Activity
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, padding: '2px 10px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              MOCK · 前端展示
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Today's featured works */}
            <div style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '22px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', marginBottom: 18, fontWeight: 700 }}>
                今日精选作品
              </div>
              {FEATURED_WORKS.map((w) => (
                <div key={w.title} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: w.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, color: w.iconColor }}>
                    {w.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.title}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{w.creator} · {w.kind}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommended creators */}
            <div style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '22px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', marginBottom: 18, fontWeight: 700 }}>
                推荐创作者
              </div>
              {RECOMMENDED_CREATORS.map((c) => (
                <div key={c.name} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                    {(c.name[1] ?? 'C').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{c.name}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>{c.tag}</div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: 'rgba(52,211,153,0.80)' }}>{c.rep}</div>
                </div>
              ))}
            </div>

            {/* Hiring */}
            <div style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '22px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', marginBottom: 18, fontWeight: 700 }}>
                正在招募合作
              </div>
              {HIRING.map((h) => (
                <div key={h.title} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{h.title}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>{h.by}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(251,191,36,0.75)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.16)', borderRadius: 99, padding: '2px 8px' }}>
                      {h.kind}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.26)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '6px 14px' }}>
                  发布需求入口即将开放
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ── Web3 Passport ── */}
        <section className="mt-14">
          <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.24)', marginBottom: 22, fontWeight: 700 }}>
            Web3 身份 · Creator Passport
          </div>

          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(96,165,250,0.18)', background: 'linear-gradient(140deg, rgba(96,165,250,0.06) 0%, rgba(167,139,250,0.06) 55%, rgba(0,0,0,0.20) 100%)', padding: '34px 30px' }}>

            {/* Glow orbs */}
            <div aria-hidden="true" style={{ position: 'absolute', top: -70, right: -70, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', bottom: -50, left: 60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div className="relative flex flex-wrap gap-10">

              {/* Creator ID */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.65)', marginBottom: 10, fontWeight: 700 }}>Creator ID</div>
                <div style={{ fontSize: 36, fontWeight: 200, letterSpacing: '-0.04em', fontFamily: 'monospace' }}>CC-0042</div>
                <div style={{ marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>早期成员 · 2024</div>
              </div>

              {/* Reputation */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(52,211,153,0.65)', marginBottom: 10, fontWeight: 700 }}>城市声望</div>
                <div style={{ fontSize: 36, fontWeight: 200, letterSpacing: '-0.04em' }}>1,284</div>
                <div style={{ marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>Reputation · 持续成长</div>
              </div>

              {/* Studio Level */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.65)', marginBottom: 10, fontWeight: 700 }}>工作室等级</div>
                <div style={{ fontSize: 36, fontWeight: 200, letterSpacing: '-0.04em' }}>Lv.3</div>
                <div style={{ marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>Studio · 进阶工作室</div>
              </div>

              {/* Badges */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.65)', marginBottom: 14, fontWeight: 700 }}>作品徽章</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PASSPORT_BADGES.map((badge) => (
                    <span key={badge} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(167,139,250,0.85)', background: 'rgba(167,139,250,0.09)', border: '1px solid rgba(167,139,250,0.20)', borderRadius: 99, padding: '5px 13px' }}>
                      ✦ {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* Wallet placeholder */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 14, fontWeight: 700 }}>钱包绑定</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.26)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 99, padding: '8px 16px' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>◌</span>
                  Web3 身份即将开放
                </span>
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.20)' }}>先做 Web3 感，非真实链上逻辑</div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="mt-14 flex flex-wrap items-center justify-between gap-4">
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)' }}>
            Creator City 社群当前为前端预览阶段 · 动态数据均为 mock，不连接数据库
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/create"
              style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.58)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 99, padding: '8px 18px', textDecoration: 'none' }}
            >
              进入 AI 画布
            </Link>
            <Link
              href="/assets"
              style={{ fontSize: 12, fontWeight: 600, color: 'rgba(52,211,153,0.85)', background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 99, padding: '8px 18px', textDecoration: 'none' }}
            >
              资产库
            </Link>
          </div>
        </section>

      </main>
    </div>
  )
}
