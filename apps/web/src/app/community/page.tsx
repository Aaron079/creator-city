import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

// Static front-end only — no DB, no API, no generation logic

const DISTRICTS = [
  {
    num: '01',
    en: 'Plaza',
    zh: '城市广场',
    desc: '发现正在发生的创作、公告与挑战。',
    href: '/explore',
    dot: '#fbbf24',
  },
  {
    num: '02',
    en: 'Gallery',
    zh: '作品展厅',
    desc: '展示你的图片、视频与画布项目。',
    href: '/assets',
    dot: '#a78bfa',
  },
  {
    num: '03',
    en: 'Studio',
    zh: '创作者工作室',
    desc: '建立你的个人主页与创作者身份。',
    href: '/studio',
    dot: '#34d399',
  },
  {
    num: '04',
    en: 'Market',
    zh: '交易市场',
    desc: '找创作者、发布需求与项目招募。',
    href: '/marketplace',
    dot: '#fb923c',
  },
  {
    num: '05',
    en: 'Passport',
    zh: 'Web3 身份',
    desc: 'Creator ID、声望、徽章与未来钱包。',
    href: '/me',
    dot: '#60a5fa',
  },
] as const

export default function CommunityPage() {
  return (
    <div className="min-h-screen" style={{ background: '#080a10', color: '#fff' }}>
      <TopNavigation />

      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'clamp(100px, 14vw, 140px) 24px clamp(60px, 10vw, 100px)',
        }}
      >

        {/* Hero */}
        <header style={{ marginBottom: 72 }}>
          <p style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            fontWeight: 600,
            marginBottom: 28,
          }}>
            Creator City · Community
          </p>
          <h1 style={{
            fontSize: 'clamp(34px, 5vw, 56px)',
            fontWeight: 200,
            letterSpacing: '-0.04em',
            lineHeight: 1.12,
            margin: 0,
          }}>
            展示作品，建立身份，<br />
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>让创作成为你的城市资产。</span>
          </h1>
          <p style={{
            marginTop: 22,
            fontSize: 14,
            color: 'rgba(255,255,255,0.36)',
            lineHeight: 1.75,
          }}>
            选择你想进入的城市区域。
          </p>
        </header>

        {/* District list */}
        <nav aria-label="City districts">
          <p style={{
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.20)',
            fontWeight: 600,
            marginBottom: 0,
          }}>
            Five Districts
          </p>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 14 }}>
            {DISTRICTS.map((d) => (
              <Link
                key={d.num}
                href={d.href}
                className="group"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="transition-colors group-hover:bg-white/[0.025]"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '22px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {/* Indicator + number + en */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexShrink: 0,
                    width: 108,
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: d.dot,
                      flexShrink: 0,
                      opacity: 0.65,
                    }} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.22)',
                      letterSpacing: '0.08em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {d.num}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.22)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      {d.en}
                    </span>
                  </div>

                  {/* Name + desc */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 17,
                      fontWeight: 300,
                      letterSpacing: '-0.02em',
                      color: 'rgba(255,255,255,0.88)',
                      marginBottom: 5,
                    }}>
                      {d.zh}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.34)',
                      lineHeight: 1.5,
                    }}>
                      {d.desc}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div
                    className="transition-colors group-hover:text-white/50"
                    style={{ flexShrink: 0, fontSize: 17, color: 'rgba(255,255,255,0.18)' }}
                  >
                    →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer note */}
        <footer style={{
          marginTop: 56,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px 32px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', lineHeight: 1.6, margin: 0 }}>
            当前为前端预览阶段 · 动态数据为 mock · 不连接数据库<br />
            Web3 身份为视觉预览，不做真实链上逻辑
          </p>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <Link
              href="/create"
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.40)',
                textDecoration: 'none',
                padding: '6px 14px',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 8,
              }}
            >
              AI 画布
            </Link>
            <Link
              href="/assets"
              style={{
                fontSize: 12,
                color: 'rgba(52,211,153,0.75)',
                textDecoration: 'none',
                padding: '6px 14px',
                border: '1px solid rgba(52,211,153,0.15)',
                borderRadius: 8,
              }}
            >
              资产库
            </Link>
          </div>
        </footer>

      </main>
    </div>
  )
}
