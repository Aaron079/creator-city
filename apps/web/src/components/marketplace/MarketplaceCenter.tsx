// /marketplace — Creator Marketplace 创作者市场
// Read-only preview page. NO API calls, NO DB writes, NO generation triggers.
// All creator/project data is MOCK/DEMO — not real users or real transactions.
import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'
import {
  marketplaceStats,
  serviceCategories,
  creatorServices,
  projectRequests,
  marketplaceRules,
  safetyTips,
  quickLinks,
  type ServiceStatus,
  type ProjectStatus,
} from '@/components/marketplace/marketplaceData'

// ── Style helpers ─────────────────────────────────────────────────────────────

const SERVICE_STATUS: Record<ServiceStatus, { color: string; bg: string; border: string }> = {
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

const PROJECT_STATUS: Record<ProjectStatus, { color: string; bg: string }> = {
  '招募中': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.32)' },
  '预览': { color: 'rgba(255,255,255,0.36)', bg: 'rgba(255,255,255,0.06)' },
}

function Chip({
  label,
  color,
  bg,
  border,
}: {
  label: string
  color: string
  bg: string
  border?: string
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color,
        background: bg,
        border: `1px solid ${border ?? 'transparent'}`,
        borderRadius: 99,
        padding: '2px 9px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.32)',
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 22,
        fontWeight: 300,
        letterSpacing: '-0.04em',
        color: '#fff',
      }}
    >
      {children}
    </div>
  )
}

const card: React.CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(0,0,0,0.18)',
  padding: '16px 18px',
}

const glassPanel: React.CSSProperties = {
  borderRadius: 30,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.025)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  padding: '24px',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketplaceCenter() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <TopNavigation />

      <main
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '96px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >

        {/* ── Hero ── */}
        <section
          style={{
            borderRadius: 34,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            padding: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <SectionLabel>Marketplace</SectionLabel>
              <h1
                style={{
                  marginTop: 14,
                  fontSize: 36,
                  fontWeight: 300,
                  letterSpacing: '-0.05em',
                  color: '#fff',
                }}
              >
                创作者市场
              </h1>
              <p
                style={{
                  marginTop: 12,
                  maxWidth: 600,
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: 'rgba(255,255,255,0.54)',
                }}
              >
                连接项目需求、专业创作者和 AI 影视生产服务的交易入口。
                <br />
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.36)',
                  }}
                >
                  当前为只读预览 — 不接单、不支付、不写入数据库、不触发生成。
                </span>
              </p>
            </div>
            <Chip
              label="只读预览 · Demo"
              color="rgba(255,255,255,0.38)"
              bg="rgba(255,255,255,0.05)"
              border="rgba(255,255,255,0.09)"
            />
          </div>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.40)',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              发布需求 <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)' }}>即将开放</span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.40)',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              成为创作者 <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)' }}>即将开放</span>
            </span>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
              }}
            >
              返回工作台
            </Link>
            <Link
              href="/community"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
              }}
            >
              进入社区
            </Link>
          </div>
        </section>

        {/* ── Market Stats ── */}
        <section>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {marketplaceStats.map((stat) => (
              <div key={stat.label} style={glassPanel}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {stat.label}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 32,
                    fontWeight: 200,
                    letterSpacing: '-0.04em',
                    color: '#fff',
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                  {stat.note}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Service Categories ── */}
        <section style={glassPanel}>
          <SectionLabel>服务分类</SectionLabel>
          <SectionTitle>可委托服务</SectionTitle>
          <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.42)' }}>
            前端预览 — 服务接单功能即将上线，当前不触发任何写入。
          </p>
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {serviceCategories.map((cat) => {
              const s = SERVICE_STATUS[cat.status]
              return (
                <div key={cat.title} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 400, color: '#fff' }}>{cat.title}</span>
                    <Chip label={cat.status} color={s.color} bg={s.bg} border={s.border} />
                  </div>
                  <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.46)' }}>
                    {cat.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Creator Services ── */}
        <section style={glassPanel}>
          <SectionLabel>创作者服务</SectionLabel>
          <SectionTitle>入驻创作者</SectionTitle>
          <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.42)' }}>
            以下均为 mock/demo 展示 — 非真实创作者，非真实订单，价格仅供参考。
          </p>
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {creatorServices.map((creator) => (
              <div
                key={creator.name}
                style={{
                  ...card,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
                {/* Avatar row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.55)',
                      flexShrink: 0,
                    }}
                  >
                    {creator.name.slice(-2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{creator.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>{creator.role}</div>
                  </div>
                </div>

                {/* Specialty */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 5, letterSpacing: '0.06em' }}>擅长</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {creator.specialty.map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.55)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          padding: '2px 7px',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Price + Delivery */}
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 3 }}>报价</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: '#a78bfa', letterSpacing: '-0.02em' }}>
                      {creator.priceFrom}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 3 }}>交付</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{creator.deliveryDays}</div>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {creator.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.38)',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 5,
                        padding: '2px 6px',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Disabled buttons */}
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 12,
                      padding: '7px 0',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.32)',
                      cursor: 'not-allowed',
                      userSelect: 'none',
                    }}
                  >
                    查看服务
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 12,
                      padding: '7px 0',
                      borderRadius: 10,
                      border: '1px solid rgba(167,139,250,0.20)',
                      color: 'rgba(167,139,250,0.45)',
                      cursor: 'not-allowed',
                      userSelect: 'none',
                    }}
                  >
                    发起委托
                  </span>
                </div>
                <div style={{ marginTop: 6, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.20)', letterSpacing: '0.08em' }}>
                  MOCK · DEMO · 即将开放
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Project Requests ── */}
        <section style={glassPanel}>
          <SectionLabel>项目需求</SectionLabel>
          <SectionTitle>待委托项目</SectionTitle>
          <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.42)' }}>
            以下均为 mock/demo — 非真实需求，非真实报价，不接单，不写入任何数据。
          </p>
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 14,
            }}
          >
            {projectRequests.map((req) => {
              const ps = PROJECT_STATUS[req.status]
              return (
                <div key={req.title} style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.38)',
                          marginBottom: 6,
                        }}
                      >
                        {req.type}
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 400, color: '#fff', lineHeight: 1.4, margin: 0 }}>
                        {req.title}
                      </h3>
                    </div>
                    <Chip label={req.status} color={ps.color} bg={ps.bg} />
                  </div>

                  <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.48)' }}>
                    {req.summary}
                  </p>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>预算</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#fcd34d', letterSpacing: '-0.02em' }}>
                        {req.budgetRange}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>截止</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{req.deadline}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 12,
                        padding: '7px 16px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.32)',
                        cursor: 'not-allowed',
                        userSelect: 'none',
                      }}
                    >
                      查看需求 · 即将开放
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Marketplace Rules + Safety (side by side) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 20,
          }}
        >
          {/* Rules */}
          <section style={glassPanel}>
            <SectionLabel>平台规则</SectionLabel>
            <SectionTitle>交易规则预览</SectionTitle>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {marketplaceRules.map((rule, i) => (
                <div
                  key={rule.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    paddingBottom: i < marketplaceRules.length - 1 ? 14 : 0,
                    borderBottom: i < marketplaceRules.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.30)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 5 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.44)' }}>
                      {rule.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Safety */}
          <section style={glassPanel}>
            <SectionLabel>安全提示</SectionLabel>
            <SectionTitle>保护自己与他人</SectionTitle>
            <ul style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {safetyTips.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 3,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'rgba(167,139,250,0.55)',
                    }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.56)' }}>
                    {item.tip}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Quick Links ── */}
        <section style={glassPanel}>
          <SectionLabel>快速导航</SectionLabel>
          <SectionTitle>前往其他页面</SectionTitle>
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)',
                  textDecoration: 'none',
                  color: '#fff',
                  transition: 'border-color 0.12s',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}>
                  {link.label}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>
                  {link.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
