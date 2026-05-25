// /pricing-preview — Static commercial model preview page
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  revenueModels,
  pricingPlans,
  commissionFlow,
  apiCostPrinciples,
  investorHighlights,
  risksAndBoundaries,
  quickLinks,
  type RevenueStatus,
  type PlanTier,
} from '@/components/pricing-preview/pricingPreviewData'

// ── Style constants ───────────────────────────────────────────────────────────

const glass: React.CSSProperties = {
  borderRadius: 28,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.025)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
}

const glassLighter: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.04)',
}

// ── Status chip color map ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<RevenueStatus, { color: string; bg: string; border: string }> = {
  '核心原则': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.28)', border: 'rgba(110,231,183,0.22)' },
  '规划中':   { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)', border: 'rgba(252,211,77,0.22)' },
  '长期规划': { color: '#f472b6', bg: 'rgba(131,24,67,0.22)', border: 'rgba(244,114,182,0.18)' },
  '未来规划': { color: '#fb923c', bg: 'rgba(124,45,18,0.28)', border: 'rgba(251,146,60,0.22)' },
}

const TIER_ACCENT: Record<PlanTier, string> = {
  free:       'rgba(148,163,184,0.5)',
  pro:        'rgba(99,102,241,0.9)',
  studio:     'rgba(168,85,247,0.8)',
  enterprise: 'rgba(251,146,60,0.8)',
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.30)',
      marginBottom: 20,
    }}>
      {children}
    </div>
  )
}

function StatusChip({ status }: { status: RevenueStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 999,
      padding: '3px 10px',
    }}>
      {status}
    </span>
  )
}

function StaticChip({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: color ?? 'rgba(255,255,255,0.45)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 999,
      padding: '3px 10px',
    }}>
      {label}
    </span>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px', ...style }}>
      {children}
    </section>
  )
}

// ── 1. Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{
      minHeight: '28vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: '64px 24px 48px',
      maxWidth: 800,
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
        <StaticChip label="静态预览" color="#6ee7b7" />
        <StaticChip label="不接支付" />
        <StaticChip label="不写数据库" />
        <StaticChip label="不触发生成" />
      </div>

      <h1 style={{
        fontSize: 'clamp(28px, 5vw, 52px)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#fff',
        margin: '0 0 20px',
        lineHeight: 1.12,
      }}>
        Creator City 商业模式预览
      </h1>

      <p style={{
        fontSize: 'clamp(14px, 2vw, 17px)',
        color: 'rgba(255,255,255,0.52)',
        lineHeight: 1.7,
        maxWidth: 600,
        margin: 0,
      }}>
        把 AI 影视生产工具、创作者社区、交易市场和企业部署连接成可持续商业闭环。
      </p>
    </section>
  )
}

// ── 2. Revenue model overview ─────────────────────────────────────────────────

function RevenueOverview() {
  return (
    <Section>
      <SectionLabel>收入方向总览</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {revenueModels.map((m) => (
          <div key={m.id} style={{ ...glassLighter, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 28, height: 28,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)',
                  flexShrink: 0,
                }}>
                  {m.letter}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{m.tagline}</div>
                </div>
              </div>
              <StatusChip status={m.status} />
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, margin: 0 }}>
              {m.description}
            </p>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.highlights.map((h) => (
                <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.22)', marginTop: 1, flexShrink: 0 }}>›</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 3. Pricing plans ──────────────────────────────────────────────────────────

function PricingPlans() {
  return (
    <Section>
      <SectionLabel>套餐预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 24, marginTop: -12 }}>
        价格为预览，不代表最终定价。所有套餐按钮均不接真实支付。
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
        gap: 16,
        alignItems: 'stretch',
      }}>
        {pricingPlans.map((plan) => {
          const accent = TIER_ACCENT[plan.tier]
          return (
            <div key={plan.tier} style={{
              borderRadius: 24,
              border: plan.highlighted
                ? `1px solid ${accent}`
                : '1px solid rgba(255,255,255,0.08)',
              background: plan.highlighted
                ? 'rgba(99,102,241,0.08)'
                : 'rgba(255,255,255,0.025)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              padding: '28px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              position: 'relative',
            }}>
              {plan.highlighted && (
                <div style={{
                  position: 'absolute',
                  top: -1,
                  left: 24,
                  right: 24,
                  height: 2,
                  background: accent,
                  borderRadius: '0 0 2px 2px',
                }} />
              )}

              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{plan.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginLeft: 8 }}>{plan.subtitle}</span>
              </div>

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: plan.tier === 'enterprise' ? 18 : 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  {plan.price}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>{plan.priceNote}</div>

              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', marginBottom: 18 }}>{plan.audience}</div>

              <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.52)' }}>
                    <span style={{ color: 'rgba(110,231,183,0.7)', marginTop: 1, flexShrink: 0, fontSize: 10 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div style={{
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                padding: '9px 0',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.40)',
                letterSpacing: '0.06em',
                cursor: 'default',
                userSelect: 'none',
              }}>
                {plan.cta}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── 4. Commission flow ────────────────────────────────────────────────────────

function CommissionFlow() {
  return (
    <Section>
      <SectionLabel>平台抽佣模型</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 28, marginTop: -12 }}>
        仅为流程预览。当前不创建订单，不接支付，不写数据库。
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {commissionFlow.map((s, i) => (
          <div key={s.step} style={{ ...glassLighter, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i === commissionFlow.length - 1
                ? 'rgba(99,102,241,0.25)'
                : 'rgba(255,255,255,0.05)',
              border: i === commissionFlow.length - 1
                ? '1px solid rgba(99,102,241,0.5)'
                : '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: i === commissionFlow.length - 1 ? '#a5b4fc' : 'rgba(255,255,255,0.40)',
              flexShrink: 0,
            }}>
              {s.step}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 5. API cost principles ────────────────────────────────────────────────────

function ApiCostSection() {
  return (
    <Section>
      <SectionLabel>API 成本原则</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {apiCostPrinciples.map((p) => (
          <div key={p.title} style={{ ...glassLighter, padding: '20px 20px' }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{p.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{p.title}</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, margin: 0 }}>{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 6. Investor highlights ────────────────────────────────────────────────────

function InvestorSection() {
  return (
    <Section>
      <SectionLabel>投资人视角</SectionLabel>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {investorHighlights.map((h, i) => (
          <div key={h.dimension} style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr',
            gap: 20,
            padding: '16px 28px',
            borderBottom: i < investorHighlights.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'start',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.70)' }}>{h.dimension}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.46)', lineHeight: 1.6 }}>{h.mechanic}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 7. Risks & boundaries ─────────────────────────────────────────────────────

function RisksSection() {
  return (
    <Section>
      <SectionLabel>风险与边界</SectionLabel>
      <div style={{ ...glassLighter, padding: '20px 24px', borderLeft: '3px solid rgba(251,146,60,0.40)' }}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {risksAndBoundaries.map((r) => (
            <li key={r.item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.52)', lineHeight: 1.55 }}>
              <span style={{ color: 'rgba(251,146,60,0.7)', marginTop: 1, flexShrink: 0, fontSize: 11 }}>⚠</span>
              {r.item}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ── 8. Quick links ────────────────────────────────────────────────────────────

function QuickLinksSection() {
  return (
    <Section style={{ paddingBottom: 80 }}>
      <SectionLabel>快速链接</SectionLabel>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            padding: '8px 16px',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}>
            {link.label}
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>→</span>
          </Link>
        ))}
      </div>
    </Section>
  )
}

// ── Page footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '28px 24px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', margin: 0 }}>
        Creator City 商业模式预览 · 静态页面 · 不接支付 · 不写数据库 · 不触发生成 · 价格仅为预览
      </p>
    </footer>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto 48px', padding: '0 24px' }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function PricingPreviewPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0f',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Hero />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
        <RevenueOverview />
        <Divider />
        <PricingPlans />
        <Divider />
        <CommissionFlow />
        <Divider />
        <ApiCostSection />
        <Divider />
        <InvestorSection />
        <Divider />
        <RisksSection />
        <Divider />
        <QuickLinksSection />
      </div>
      <Footer />
    </div>
  )
}
