// No POST, no PUT, no DELETE. Static data only. Not connected to generation.
import Link from 'next/link'
import {
  HERO,
  PROPOSAL_FIELDS,
  SERVICE_TIERS,
  COMPARE_DIMENSIONS,
} from './proposalFlowPreviewData'
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

export default function ProposalFlowPreviewPage() {
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
      <MarketPreviewBackLink current="proposal-flow" />
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
          Creator City · 市场体系 · 04
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
            href="/milestone-delivery-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: '#d97706',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            查看阶段交付
          </Link>
          <Link
            href="/demand-board-preview"
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
            返回需求广场
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* ── Section 1: 方案结构模板 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="方案结构模板"
            sub="创作者提交报价前需填写以下字段，帮助项目方快速评估方案"
          />

          <div
            style={{
              ...card,
              overflow: 'hidden',
              marginBottom: '0.75rem',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '0.625rem 1.25rem',
                borderBottom: '1px solid #1e1e24',
                background: '#0d0d12',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>字段</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>示例</span>
            </div>
            {PROPOSAL_FIELDS.map((f, i) => (
              <div
                key={f.field}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  padding: '0.7rem 1.25rem',
                  borderBottom: i < PROPOSAL_FIELDS.length - 1 ? '1px solid #1e1e24' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.014)',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>{f.field}</span>
                  {f.required && (
                    <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700, lineHeight: 1 }}>*</span>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55 }}>{f.example}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '10px', color: '#3f3f46' }}>
            * 必填 · 当前为预览模板，不提交真实方案，不创建订单
          </p>
        </section>

        {/* ── Section 2: 报价方案卡 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="报价方案参考"
            sub="3 档方案结构，项目方可按需求复杂度选择对应区间"
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
            <span style={{ fontWeight: 600, color: '#ca8a04' }}>Mock 数据 · </span>
            以下方案均为演示数据，不代表真实创作者报价。不提供接单、支付、创建订单功能。
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))',
              gap: '1rem',
            }}
          >
            {SERVICE_TIERS.map((tier) => (
              <div
                key={tier.id}
                style={{
                  ...card,
                  padding: '1.375rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  position: 'relative',
                  borderColor: tier.popular ? '#d9770640' : '#1e1e24',
                }}
              >
                {tier.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-1px',
                      right: '1.25rem',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#fbbf24',
                      background: '#d9770620',
                      border: '1px solid #d9770640',
                      borderTop: 'none',
                      borderRadius: '0 0 7px 7px',
                      padding: '2px 8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    推荐
                  </span>
                )}

                {/* Title + price */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#71717a', marginBottom: '0.3rem' }}>
                    {tier.title}
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {tier.priceLabel}
                  </div>
                </div>

                {/* Scenario */}
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>
                  {tier.scenario}
                </div>

                {/* Key metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid #1e1e24',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '2px' }}>周期</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8' }}>{tier.deliveryDays}天</div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid #1e1e24', borderRight: '1px solid #1e1e24' }}>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '2px' }}>修改</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8' }}>{tier.modificationRounds}轮</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '2px' }}>起价</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4d4d8' }}>¥{(tier.priceRmb / 1000).toFixed(1)}k</div>
                  </div>
                </div>

                {/* Deliverables */}
                <div>
                  <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '6px' }}>交付物</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {tier.deliverables.map((d) => (
                      <div key={d} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                        <span style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }}>✓</span>
                        {d}
                      </div>
                    ))}
                  </div>
                </div>

                {/* License */}
                <div
                  style={{
                    fontSize: '11px',
                    color: '#71717a',
                    padding: '0.4rem 0.625rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid #1e1e24',
                    borderRadius: '6px',
                  }}
                >
                  授权 · {tier.license}
                </div>

                {/* CTA */}
                <Link
                  href="/milestone-delivery-preview"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    background: 'transparent',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#71717a',
                    textDecoration: 'none',
                    gap: '0.35rem',
                    marginTop: 'auto',
                  }}
                >
                  查看阶段交付 →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: 项目方比较维度 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="项目方比较维度"
            sub="收到多个方案后，项目方按以下维度评估哪个方案更适合"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {COMPARE_DIMENSIONS.map((dim, i) => (
              <div
                key={dim.label}
                style={{
                  ...card,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.875rem',
                  padding: '0.875rem 1.125rem',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#3f3f46',
                    minWidth: '22px',
                    paddingTop: '2px',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>{dim.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55 }}>{dim.description}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '1rem', fontSize: '10px', color: '#3f3f46' }}>
            以上为静态维度 · 正式版将支持多方案并排比较视图
          </p>
        </section>

        {/* ── Section 4: 市场链路 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="市场链路"
            sub="报价方案是创作者市场 6 个环节中的第 4 环"
          />
          <MarketChainNav current="proposal-flow" />
        </section>

        {/* ── Disclaimer ── */}
        <MarketPreviewNotice text="本页面所有数据均为示例，不提交真实方案、不接支付、不创建订单、不写数据库。报价方案功能尚在规划阶段，正式上线时间以路线图为准。" />

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
          /proposal-flow-preview · 静态预览页 · 不提交方案 · 不接支付 · 不创建订单 · 不写数据库
        </div>
      </div>
    </div>
  )
}
