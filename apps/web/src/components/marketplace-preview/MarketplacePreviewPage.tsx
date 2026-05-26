// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  MARKETPLACE_HERO,
  MARKET_CHAIN,
  ROLE_PERSPECTIVES,
  TRUST_PILLARS,
} from './marketplacePreviewData'
import { MarketPreviewBackLink } from '../market-preview/MarketPreviewBackLink'
import { MarketPreviewNotice } from '../market-preview/MarketPreviewNotice'

const card: React.CSSProperties = {
  background: '#111117',
  border: '1px solid #1e1e24',
  borderRadius: '14px',
}

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  )
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h2
        style={{
          fontSize: '1.05rem',
          fontWeight: 700,
          color: '#f4f4f5',
          marginBottom: '0.3rem',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: '0.78rem', color: '#52525b' }}>{sub}</p>
    </div>
  )
}

export default function MarketplacePreviewPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090b',
        color: '#a1a1aa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '0 0 6rem',
      }}
    >
      <MarketPreviewBackLink current="marketplace" />
      {/* ── Hero ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0d1422 0%, #09090b 100%)',
          borderBottom: '1px solid #1e1e24',
          padding: '5rem 1.5rem 4.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          {MARKETPLACE_HERO.statusChips.map((chip) => (
            <StatusChip key={chip.label} label={chip.label} color={chip.color} />
          ))}
        </div>

        <p
          style={{
            fontSize: '10px',
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: '#3f3f46',
            marginBottom: '1rem',
          }}
        >
          {MARKETPLACE_HERO.eyebrow}
        </p>

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#f4f4f5',
            letterSpacing: '-0.025em',
            lineHeight: 1.08,
            marginBottom: '1.25rem',
          }}
        >
          {MARKETPLACE_HERO.title}
        </h1>

        <p
          style={{
            maxWidth: '520px',
            margin: '0 auto 2.75rem',
            fontSize: '0.9rem',
            color: '#71717a',
            lineHeight: 1.8,
            whiteSpace: 'pre-line',
          }}
        >
          {MARKETPLACE_HERO.description}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="#market-flow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: '#7c3aed',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            查看市场链路
          </a>
          <Link
            href="/creator-profile-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: 'transparent',
              color: '#a1a1aa',
              border: '1px solid #27272a',
              borderRadius: '8px',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            进入创作者主页预览
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* Market chain flow */}
        <section
          id="market-flow"
          style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}
        >
          <SectionHeader
            title="市场链路"
            sub="6 个环节，从展示到结算构成完整交易闭环"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(256px, 1fr))',
              gap: '1rem',
            }}
          >
            {MARKET_CHAIN.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...card,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  padding: '1.25rem',
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: item.accent,
                    background: `${item.accent}18`,
                    border: `1px solid ${item.accent}30`,
                    borderRadius: '9999px',
                    padding: '1px 9px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {String(item.index).padStart(2, '0')}
                </span>
                <div
                  style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e4e4e7' }}
                >
                  {item.label}
                </div>
                <div
                  style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.65 }}
                >
                  {item.desc}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: item.accent,
                    marginTop: '0.15rem',
                  }}
                >
                  查看预览 →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Role perspectives */}
        <section style={{ marginBottom: '4.5rem' }}>
          <SectionHeader
            title="角色视角"
            sub="不同角色在市场中的体验与收益"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem',
            }}
          >
            {ROLE_PERSPECTIVES.map((r) => (
              <div
                key={r.role}
                style={{
                  ...card,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{r.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#52525b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.15rem',
                      }}
                    >
                      {r.role}
                    </div>
                    <div
                      style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7', lineHeight: 1.35 }}
                    >
                      {r.headline}
                    </div>
                  </div>
                </div>

                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {r.points.map((p) => (
                    <li
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#71717a',
                        lineHeight: 1.55,
                      }}
                    >
                      <span style={{ color: r.accent, flexShrink: 0 }}>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>

                <Link
                  href={r.href}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: r.accent,
                    textDecoration: 'none',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #1e1e24',
                    marginTop: 'auto',
                  }}
                >
                  {r.cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Trust pillars */}
        <section style={{ marginBottom: '4.5rem' }}>
          <SectionHeader
            title="信任机制"
            sub="保护项目方与创作者双方权益的 4 个核心设计"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {TRUST_PILLARS.map((p) => (
              <div
                key={p.title}
                style={{
                  ...card,
                  display: 'flex',
                  gap: '1rem',
                  padding: '1.125rem 1.25rem',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: '1px' }}>
                  {p.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#e4e4e7',
                      marginBottom: '0.3rem',
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.65 }}
                  >
                    {p.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Preview disclaimer */}
        <MarketPreviewNotice text="本页面所有数据均为示例，不接支付、不创建订单、不写数据库。市场功能尚在规划阶段，正式上线时间以路线图为准。" />

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #1e1e24',
            paddingTop: '1.25rem',
            textAlign: 'center',
            fontSize: '11px',
            color: '#3f3f46',
          }}
        >
          /marketplace-preview · 静态预览页 · 不支持真实交易
        </div>
      </div>
    </div>
  )
}
