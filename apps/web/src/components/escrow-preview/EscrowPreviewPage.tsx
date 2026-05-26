// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All amounts, orders, escrow accounts and settlements are mock/preview only. No real payments, orders, or DB writes.
import Link from 'next/link'
import {
  HERO,
  REASONS,
  ESCROW_FLOW,
  COMMISSION_MODEL,
  STAGED_RELEASE_EXAMPLE,
  SETTLEMENT_STATUSES,
  PROJECT_OWNER_PROTECTIONS,
  CREATOR_PROTECTIONS,
  REFUND_AND_DISPUTE_SCENARIOS,
  PROOF_ARCHIVE,
  RISKS_AND_BOUNDARIES,
  ROADMAP,
  QUICK_LINKS,
} from './escrowPreviewData'

const PAGE_BG = '#09090b'
const SURFACE = '#18181b'
const BORDER = '#27272a'
const TEXT_PRIMARY = '#e4e4e7'
const TEXT_SECONDARY = '#a1a1aa'
const TEXT_MUTED = '#71717a'

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      style={{ scrollMarginTop: '80px', marginBottom: '3rem' }}
    >
      {children}
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '1rem', fontWeight: 700, color: TEXT_PRIMARY,
      marginBottom: '1.25rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem',
    }}>
      {children}
    </h2>
  )
}

export default function EscrowPreviewPage() {
  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh', color: TEXT_PRIMARY, fontFamily: 'system-ui, sans-serif' }}>
      {/* Static disclaimer banner */}
      <div style={{
        background: '#1c1008', borderBottom: '1px solid #92400e40',
        padding: '0.5rem 1rem', textAlign: 'center',
        fontSize: '11px', color: '#78716c', letterSpacing: '0.01em',
      }}>
        静态预览页 · 不接真实支付 · 不创建订单 · 不收款 · 不打款 · 不写数据库 · 不触发生成 · 所有金额为 mock 示例
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

        {/* Hero */}
        <Section id="hero">
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
              {HERO.statusChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '9999px', border: `1px solid ${chip.color}40`,
                    color: chip.color, background: `${chip.color}12`,
                  }}
                >
                  {chip.label}
                </span>
              ))}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: TEXT_PRIMARY, marginBottom: '0.5rem', lineHeight: 1.25 }}>
              {HERO.title}
            </h1>
            <p style={{ fontSize: '0.95rem', color: TEXT_SECONDARY, lineHeight: 1.65, maxWidth: '640px', marginBottom: '1.25rem' }}>
              {HERO.tagline}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {HERO.ctas.map((cta) => (
                <a
                  key={cta.anchor}
                  href={cta.anchor}
                  style={{
                    fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24',
                    background: '#1c1a08', border: '1px solid #d9770630',
                    borderRadius: '8px', padding: '0.45rem 1rem',
                    textDecoration: 'none',
                  }}
                >
                  {cta.label} ↓
                </a>
              ))}
            </div>
          </div>
        </Section>

        {/* Why */}
        <Section id="why">
          <SectionTitle>为什么需要托管与结算</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.875rem' }}>
            {REASONS.map((r) => (
              <div key={r.title} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{r.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '0.25rem' }}>{r.title}</div>
                <div style={{ fontSize: '0.78rem', color: TEXT_MUTED, lineHeight: 1.6 }}>{r.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Escrow Flow */}
        <Section id="escrow-flow">
          <SectionTitle>托管流程预览（{ESCROW_FLOW.length} 步）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {ESCROW_FLOW.map((step) => (
              <div
                key={step.index}
                style={{
                  display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  borderRadius: '10px', padding: '0.75rem 1rem',
                }}
              >
                <div style={{
                  minWidth: '24px', height: '24px', borderRadius: '50%',
                  background: '#1e3a5f', border: '1px solid #3b82f660',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#60a5fa', flexShrink: 0,
                }}>
                  {step.index}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '0.15rem' }}>{step.title}</div>
                  <div style={{ fontSize: '0.78rem', color: TEXT_MUTED, lineHeight: 1.55, marginBottom: step.note ? '0.3rem' : 0 }}>{step.description}</div>
                  {step.note && (
                    <div style={{ fontSize: '10px', color: '#d97706', background: '#1c1208', border: '1px solid #92400e30', borderRadius: '6px', padding: '3px 8px', display: 'inline-block' }}>
                      {step.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Commission Model */}
        <Section id="commission-model">
          <SectionTitle>平台 30% 抽佣模型预览</SectionTitle>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem' }}>
            {COMMISSION_MODEL.rows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '0.75rem 1.125rem',
                  borderBottom: i < COMMISSION_MODEL.rows.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: row.highlight ? '#0d2818' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.83rem', color: row.highlight ? '#4ade80' : TEXT_SECONDARY, fontWeight: row.highlight ? 700 : 400 }}>{row.label}</div>
                  {row.note && <div style={{ fontSize: '10px', color: TEXT_MUTED, marginTop: '2px' }}>{row.note}</div>}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: row.highlight ? 800 : 600, color: row.highlight ? '#22c55e' : TEXT_MUTED, whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, background: '#18181b', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '0.5rem 0.875rem' }}>
            {COMMISSION_MODEL.disclaimer}
          </div>
        </Section>

        {/* Staged Release */}
        <Section id="staged-release">
          <SectionTitle>阶段释放款预览</SectionTitle>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '1.125rem 1.25rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: TEXT_PRIMARY }}>{STAGED_RELEASE_EXAMPLE.projectName}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>
                ¥{STAGED_RELEASE_EXAMPLE.totalAmount.toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {STAGED_RELEASE_EXAMPLE.stages.map((stage) => {
                const creatorAmount = Math.round(stage.amount * (1 - STAGED_RELEASE_EXAMPLE.platformFeeRate))
                return (
                  <div key={stage.index} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{
                      minWidth: '22px', height: '22px', borderRadius: '50%',
                      background: '#1e3a5f', border: '1px solid #3b82f640',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: '#60a5fa', flexShrink: 0,
                    }}>
                      {stage.index}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.83rem', color: TEXT_PRIMARY }}>{stage.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_MUTED, whiteSpace: 'nowrap' }}>
                      {Math.round(stage.ratio * 100)}%
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap', minWidth: '60px', textAlign: 'right' }}>
                      ¥{stage.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4ade80', whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'right' }}>
                      到手 ¥{creatorAmount.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, background: '#18181b', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '0.5rem 0.875rem' }}>
            {STAGED_RELEASE_EXAMPLE.platformFeeNote}
          </div>
        </Section>

        {/* Settlement Statuses */}
        <Section id="settlement-status">
          <SectionTitle>结算状态系统</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
            {SETTLEMENT_STATUSES.map((s) => (
              <span
                key={s.label}
                style={{
                  fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px',
                  borderRadius: '9999px',
                  color: s.color,
                  background: s.bg,
                  border: `1px solid ${s.color}40`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED }}>全部为静态展示，不改变真实状态。</div>
        </Section>

        {/* Protections — two columns */}
        <Section id="protections">
          <SectionTitle>双方保护机制</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
            {/* Project Owner */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>对项目方的保护</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {PROJECT_OWNER_PROTECTIONS.map((p) => (
                  <div key={p.title} style={{ display: 'flex', gap: '0.625rem', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '0.15rem' }}>{p.title}</div>
                      <div style={{ fontSize: '0.76rem', color: TEXT_MUTED, lineHeight: 1.55 }}>{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Creator */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4ade80', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>对创作者的保护</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {CREATOR_PROTECTIONS.map((p) => (
                  <div key={p.title} style={{ display: 'flex', gap: '0.625rem', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '0.15rem' }}>{p.title}</div>
                      <div style={{ fontSize: '0.76rem', color: TEXT_MUTED, lineHeight: 1.55 }}>{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Refund & Dispute */}
        <Section id="refund-dispute">
          <SectionTitle>退款与争议预览</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {REFUND_AND_DISPUTE_SCENARIOS.map((s) => (
              <div
                key={s.scenario}
                style={{
                  background: SURFACE, border: '1px solid #a1620730',
                  borderLeft: '3px solid #a16207',
                  borderRadius: '10px', padding: '0.875rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#ca8a04', marginBottom: '0.3rem' }}>{s.scenario}</div>
                <div style={{ fontSize: '0.73rem', color: TEXT_MUTED, lineHeight: 1.55 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Proof Archive */}
        <Section id="proof-archive">
          <SectionTitle>凭证与归档</SectionTitle>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            {PROOF_ARCHIVE.map((item, i) => (
              <div
                key={item}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 1.125rem',
                  borderBottom: i < PROOF_ARCHIVE.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3f3f46', flexShrink: 0 }} />
                <span style={{ fontSize: '0.83rem', color: TEXT_SECONDARY }}>{item}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#3f3f46' }}>规划中</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, marginTop: '0.5rem' }}>以上凭证记录均为未来规划，当前不创建任何真实记录。</div>
        </Section>

        {/* Risks */}
        <Section id="risks">
          <SectionTitle>风险与边界声明</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {RISKS_AND_BOUNDARIES.map((item) => (
              <div
                key={item.title}
                style={{
                  background: SURFACE,
                  border: `1px solid ${item.level === 'warning' ? '#a1620740' : BORDER}`,
                  borderLeft: `3px solid ${item.level === 'warning' ? '#a16207' : '#3f3f46'}`,
                  borderRadius: '10px', padding: '0.875rem 1.125rem',
                }}
              >
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: item.level === 'warning' ? '#ca8a04' : TEXT_SECONDARY, marginBottom: '0.3rem' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: TEXT_MUTED, lineHeight: 1.6 }}>{item.content}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Roadmap */}
        <Section id="roadmap">
          <SectionTitle>未来版本计划（{ROADMAP.length} 阶段）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ROADMAP.map((stage) => {
              const statusColor = stage.status === 'done' ? '#22c55e' : stage.status === 'active' ? '#fbbf24' : '#52525b'
              const statusLabel = stage.status === 'done' ? '已完成' : stage.status === 'active' ? '当前' : '规划中'
              return (
                <div
                  key={stage.stage}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.75rem 1rem',
                    background: SURFACE,
                    border: `1px solid ${stage.status === 'active' ? '#d9770640' : BORDER}`,
                    borderRadius: '10px',
                  }}
                >
                  <div style={{
                    minWidth: '22px', height: '22px', borderRadius: '50%',
                    background: `${statusColor}20`, border: `1px solid ${statusColor}60`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: statusColor, flexShrink: 0,
                  }}>
                    {stage.stage}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: stage.status === 'active' ? 700 : 500, color: stage.status === 'planned' ? TEXT_MUTED : TEXT_PRIMARY, marginRight: '0.5rem' }}>
                      {stage.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#52525b' }}>{stage.description}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#52525b', whiteSpace: 'nowrap' }}>{stage.quarter}</div>
                  <span style={{
                    fontSize: '9px', fontWeight: 600, color: statusColor,
                    background: `${statusColor}15`, border: `1px solid ${statusColor}35`,
                    borderRadius: '9999px', padding: '1px 7px', whiteSpace: 'nowrap',
                  }}>
                    {statusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Quick Links */}
        <Section id="quick-links">
          <SectionTitle>快速链接</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.75rem' }}>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ display: 'block', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.875rem 1rem', textDecoration: 'none' }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: '0.2rem' }}>{link.label}</div>
                <div style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>{link.description}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '1.5rem', textAlign: 'center', fontSize: '11px', color: '#3f3f46' }}>
          /escrow-preview · 静态预览 · 不接真实支付 · 不创建订单 · 不收款 · 不打款 · 不写数据库 · 不触发生成
        </div>
      </div>
    </div>
  )
}
