// No POST, no PUT, no DELETE. Static data only. Not connected to generation.
import Link from 'next/link'
import {
  HERO,
  DELIVERY_STAGES,
  DELIVERABLE_TYPES,
  ACCEPTANCE_BOUNDARIES,
} from './milestoneDeliveryPreviewData'
import { MarketPreviewBackLink } from '../market-preview/MarketPreviewBackLink'
import { MarketChainNav } from '../market-preview/MarketChainNav'
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

export default function MilestoneDeliveryPreviewPage() {
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
      <MarketPreviewBackLink current="milestone-delivery" />
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
          {HERO.statusChips.map((chip) => (
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
          Creator City · 市场体系 · 05
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
          {HERO.title}
        </h1>

        <p
          style={{
            maxWidth: '520px',
            margin: '0 auto 2.75rem',
            fontSize: '0.9rem',
            color: '#71717a',
            lineHeight: 1.8,
          }}
        >
          {HERO.tagline}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/escrow-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: '#0891b2',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            查看托管结算
          </Link>
          <Link
            href="/proposal-flow-preview"
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
            返回报价方案
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* ── Section 1: 阶段交付路线 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="阶段交付路线"
            sub="6 个阶段节点，从需求确认到结算准备，每个节点均有清晰交付物与验收标准"
          />

          <div
            style={{
              ...card,
              padding: '0.625rem 1.125rem',
              marginBottom: '1.25rem',
              borderLeft: '3px solid #a16207',
              borderRadius: '10px',
              fontSize: '0.78rem',
              color: '#71717a',
            }}
          >
            <span style={{ fontWeight: 600, color: '#ca8a04' }}>静态预览 · </span>
            以下阶段均为演示数据，不提交真实交付、不触发验收、不接支付、不创建订单。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {DELIVERY_STAGES.map((stage) => (
              <div
                key={stage.index}
                style={{
                  ...card,
                  padding: '1.25rem',
                  borderColor: stage.triggerPayment ? '#0891b240' : '#1e1e24',
                }}
              >
                {/* Stage header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#0891b218',
                      border: '1px solid #0891b240',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#22d3ee',
                      flexShrink: 0,
                    }}
                  >
                    {String(stage.index).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e4e4e7' }}>
                    {stage.title}
                  </span>
                  {stage.triggerPayment && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: '#22c55e',
                        background: '#16a34a15',
                        border: '1px solid #16a34a35',
                        borderRadius: '9999px',
                        padding: '1px 7px',
                      }}
                    >
                      触发结算（规划）
                    </span>
                  )}
                </div>

                {/* Goal */}
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#a1a1aa',
                    lineHeight: 1.65,
                    marginBottom: '0.875rem',
                  }}
                >
                  {stage.goal}
                </div>

                {/* Deliverables + Acceptance */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.875rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#52525b',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: '0.4rem',
                      }}
                    >
                      创作者交付
                    </div>
                    {stage.deliverables.map((d) => (
                      <div
                        key={d}
                        style={{
                          display: 'flex',
                          gap: '5px',
                          fontSize: '0.75rem',
                          color: '#71717a',
                          marginBottom: '3px',
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: '#0891b2', flexShrink: 0 }}>·</span>
                        {d}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#52525b',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: '0.4rem',
                      }}
                    >
                      项目方确认
                    </div>
                    {stage.acceptanceItems.map((a) => (
                      <div
                        key={a}
                        style={{
                          display: 'flex',
                          gap: '5px',
                          fontSize: '0.75rem',
                          color: '#71717a',
                          marginBottom: '3px',
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: '#16a34a', flexShrink: 0 }}>·</span>
                        {a}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk note */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '11px',
                    color: '#a16207',
                    background: '#a1620710',
                    border: '1px solid #a1620725',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}
                >
                  <span>⚠</span>
                  {stage.riskNote}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: 交付物清单 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="交付物类型"
            sub="创作项目常见的 8 类交付物，每类均需在阶段节点明确格式与规格"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {DELIVERABLE_TYPES.map((dt) => (
              <div
                key={dt.label}
                style={{
                  ...card,
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{dt.icon}</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7' }}>{dt.label}</div>
                <div style={{ fontSize: '0.73rem', color: '#71717a', lineHeight: 1.6 }}>{dt.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: 验收边界 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="验收边界"
            sub="4 个关键边界，减少扯皮，避免无限返工"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {ACCEPTANCE_BOUNDARIES.map((b) => (
              <div
                key={b.title}
                style={{
                  ...card,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7' }}>{b.title}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.65 }}>
                  {b.description}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#0891b2',
                    background: '#0891b212',
                    border: '1px solid #0891b228',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    lineHeight: 1.55,
                  }}
                >
                  {b.tip}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: 市场链路 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="市场链路"
            sub="阶段交付是创作者市场 6 个环节中的第 5 环"
          />
          <MarketChainNav current="milestone-delivery" />
        </section>

        {/* ── Disclaimer ── */}
        <MarketPreviewNotice text="本页面所有数据均为示例，不提交真实交付、不触发验收、不接支付、不创建订单、不写数据库。阶段交付功能尚在规划阶段，正式上线时间以路线图为准。" />

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
          /milestone-delivery-preview · 静态预览页 · 不提交交付 · 不触发验收 · 不接支付 · 不创建订单 · 不写数据库
        </div>
      </div>
    </div>
  )
}
