// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All proposals are mock/preview. No real orders, no payments, no DB writes, no generation triggers.
import Link from 'next/link'
import {
  HERO,
  REASONS,
  PROPOSAL_STRUCTURE_FIELDS,
  MOCK_PROPOSALS,
  QUOTE_BREAKDOWN_FIELDS,
  CREATOR_FLOW,
  COMPARE_FIELDS,
  MILESTONES,
  TRUST_ITEMS,
  RISKS_AND_BOUNDARIES,
  ROADMAP,
  QUICK_LINKS,
} from './proposalFlowPreviewData'

function Section({
  id,
  children,
  style,
}: {
  id?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section id={id} style={{ scrollMarginTop: '80px', marginBottom: '3.5rem', ...style }}>
      {children}
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '1.15rem',
        fontWeight: 700,
        color: '#f4f4f5',
        marginBottom: '1.25rem',
        letterSpacing: '-0.01em',
        borderLeft: '3px solid #7c3aed',
        paddingLeft: '0.75rem',
      }}
    >
      {children}
    </h2>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
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
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '10px',
        padding: '0.625rem 0.875rem',
        marginBottom: '1rem',
        fontSize: '0.78rem',
        color: '#71717a',
      }}
    >
      {children}
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
        padding: '0 0 5rem',
      }}
    >
      {/* Hero */}
      <Section id="hero" style={{ marginBottom: 0 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #18181b 0%, #0f0a1e 60%, #09090b 100%)',
            borderBottom: '1px solid #27272a',
            padding: '3.5rem 2rem 2.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {HERO.statusChips.map((chip) => (
              <Chip key={chip.label} label={chip.label} color={chip.color} />
            ))}
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 30%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.75rem',
              letterSpacing: '-0.03em',
            }}
          >
            {HERO.title}
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#71717a', maxWidth: '520px', margin: '0 auto 1.75rem', lineHeight: 1.65 }}>
            {HERO.tagline}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="#proposal-structure"
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1.1rem',
                background: '#7c3aed', color: '#fff', borderRadius: '9px',
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #7c3aed',
              }}
            >
              查看方案结构
            </a>
            <a
              href="#proposal-flow"
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1.1rem',
                background: 'transparent', color: '#a78bfa', borderRadius: '9px',
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #7c3aed50',
              }}
            >
              查看报价流程
            </a>
          </div>
        </div>
      </Section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 0' }}>

        {/* Why */}
        <Section id="why">
          <SectionTitle>为什么需要报价与方案流程</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
            {REASONS.map((r) => (
              <div key={r.title} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.1rem' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{r.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.3rem' }}>{r.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{r.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Proposal structure */}
        <Section id="proposal-structure">
          <SectionTitle>方案结构预览（{PROPOSAL_STRUCTURE_FIELDS.length} 个字段）</SectionTitle>
          <InfoNote>专业方案应包含以下所有必填项，选填项视项目情况决定。当前为结构预览，不保存任何数据。</InfoNote>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', overflow: 'hidden' }}>
            {PROPOSAL_STRUCTURE_FIELDS.map((f, i) => (
              <div
                key={f.field}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  borderBottom: i < PROPOSAL_STRUCTURE_FIELDS.length - 1 ? '1px solid #27272a' : 'none',
                  background: i % 2 === 0 ? 'transparent' : '#09090b30',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>{f.field}</span>
                  {f.required && <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>*</span>}
                </div>
                <span style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{f.description}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '10px', color: '#52525b' }}>* 必填 · 以上为规划中的方案模板字段，当前不保存</div>
        </Section>

        {/* Mock proposals */}
        <Section id="mock-proposals">
          <SectionTitle>Mock 方案卡片（4 类）</SectionTitle>
          <InfoNote>以下均为 Mock 数据，不代表真实创作者或真实报价。不提供真实接单功能。</InfoNote>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
            {MOCK_PROPOSALS.map((p) => (
              <div
                key={p.id}
                style={{
                  background: '#18181b',
                  border: `1px solid ${p.typeColor}35`,
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  position: 'relative',
                }}
              >
                {/* Type badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: p.typeColor, background: `${p.typeColor}18`, border: `1px solid ${p.typeColor}40`, borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>
                    {p.type}
                  </span>
                  <span style={{ fontSize: '9px', color: '#a78bfa', background: '#a78bfa15', border: '1px solid #a78bfa35', borderRadius: '9999px', padding: '1px 6px', fontWeight: 600 }}>
                    {p.creatorLevel}
                  </span>
                  <span style={{ fontSize: '9px', color: '#6b7280', background: '#6b728015', border: '1px solid #6b728040', borderRadius: '9999px', padding: '1px 6px' }}>
                    MOCK
                  </span>
                </div>
                {/* Title */}
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', lineHeight: 1.4 }}>{p.title}</div>
                {/* Price + days */}
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '1px' }}>报价</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5' }}>¥{p.budgetRmb.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '1px' }}>周期</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d4d4d8' }}>{p.deliveryDays} 天</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '1px' }}>修改</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d4d4d8' }}>{p.modificationRounds} 轮</div>
                  </div>
                </div>
                {/* Highlights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {p.highlights.map((h) => (
                    <div key={h} style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
                      <span style={{ color: p.typeColor, fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>✓</span>
                      {h}
                    </div>
                  ))}
                </div>
                {/* Tools */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {p.tools.map((t) => (
                    <span key={t} style={{ fontSize: '10px', color: '#71717a', background: '#27272a', borderRadius: '6px', padding: '2px 7px' }}>{t}</span>
                  ))}
                </div>
                {/* Rights row */}
                <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem', borderTop: '1px solid #27272a' }}>
                  <span style={{ fontSize: '10px', color: p.includesSource ? '#22c55e' : '#52525b' }}>
                    {p.includesSource ? '✓' : '✗'} 含源文件
                  </span>
                  <span style={{ fontSize: '10px', color: p.includesCommercialRights ? '#22c55e' : '#52525b' }}>
                    {p.includesCommercialRights ? '✓' : '✗'} 商业授权
                  </span>
                </div>
                {/* No real action */}
                <div style={{ padding: '0.45rem 0.75rem', background: '#27272a', borderRadius: '8px', fontSize: '11px', color: '#71717a', textAlign: 'center' }}>
                  查看方案结构预览 · 不可真实提交
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Quote breakdown */}
        <Section id="quote-breakdown">
          <SectionTitle>报价明细结构</SectionTitle>
          <InfoNote>当前只是结构预览，不计算真实价格，不创建支付。</InfoNote>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', overflow: 'hidden' }}>
            {QUOTE_BREAKDOWN_FIELDS.map((f, i) => (
              <div
                key={f.item}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 130px',
                  gap: '0.625rem',
                  padding: '0.625rem 1rem',
                  borderBottom: i < QUOTE_BREAKDOWN_FIELDS.length - 1 ? '1px solid #27272a' : 'none',
                  background: i % 2 === 0 ? 'transparent' : '#09090b30',
                  alignItems: 'start',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>{f.item}</span>
                <span style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>{f.description}</span>
                <span style={{ fontSize: '0.75rem', color: '#a16207', textAlign: 'right', whiteSpace: 'nowrap' }}>{f.typical ?? ''}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Creator flow */}
        <Section id="proposal-flow">
          <SectionTitle>创作者提交方案流程（8 步）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {CREATOR_FLOW.map((step) => (
              <div
                key={step.step}
                style={{
                  display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                  background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '0.875rem 1rem',
                }}
              >
                <div
                  style={{
                    minWidth: '26px', height: '26px', borderRadius: '50%',
                    background: '#7c3aed20', border: '1px solid #7c3aed50',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: '#a78bfa', flexShrink: 0,
                  }}
                >
                  {step.step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>
                    {step.icon} {step.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{step.description}</div>
                  {step.note && (
                    <div style={{ marginTop: '0.3rem', fontSize: '10px', color: '#a16207', background: '#a1620710', borderRadius: '5px', padding: '2px 7px', display: 'inline-block' }}>
                      {step.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Compare fields */}
        <Section id="compare-view">
          <SectionTitle>项目方比较方案维度（{COMPARE_FIELDS.length} 项）</SectionTitle>
          <InfoNote>以下为静态维度预览，未来将在平台内支持多方案并排比较，当前不实现真实比较功能。</InfoNote>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {COMPARE_FIELDS.map((field, i) => (
              <div
                key={field}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: '#18181b', border: '1px solid #27272a', borderRadius: '9px',
                  padding: '0.5rem 0.875rem',
                }}
              >
                <span style={{ fontSize: '10px', color: '#52525b', fontWeight: 700, minWidth: '16px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#d4d4d8' }}>{field}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Milestones */}
        <Section id="milestones">
          <SectionTitle>里程碑预览（{MILESTONES.length} 节点）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {MILESTONES.map((m) => (
              <div
                key={m.index}
                style={{
                  display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                  background: '#18181b',
                  border: `1px solid ${m.triggerPayment ? '#16a34a40' : '#27272a'}`,
                  borderRadius: '10px', padding: '0.75rem 1rem',
                }}
              >
                <div
                  style={{
                    minWidth: '24px', height: '24px', borderRadius: '50%',
                    background: m.triggerPayment ? '#16a34a20' : '#27272a',
                    border: `1px solid ${m.triggerPayment ? '#16a34a60' : '#3f3f46'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    color: m.triggerPayment ? '#4ade80' : '#71717a', flexShrink: 0,
                  }}
                >
                  {m.index}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7' }}>{m.title}</span>
                    {m.triggerPayment && (
                      <span style={{ fontSize: '9px', color: '#22c55e', background: '#16a34a15', border: '1px solid #16a34a35', borderRadius: '9999px', padding: '1px 6px', fontWeight: 600 }}>
                        触发付款（规划）
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.5 }}>{m.description}</div>
                </div>
              </div>
            ))}
          </div>
          {/* CTA → milestone-delivery-preview */}
          <Link
            href="/milestone-delivery-preview"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#1a1508', border: '1px solid #d9770640',
              borderRadius: '12px', padding: '1rem 1.25rem',
              textDecoration: 'none', marginTop: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.2rem' }}>
                查看阶段交付预览
              </div>
              <div style={{ fontSize: '0.75rem', color: '#78716c', lineHeight: 1.5 }}>
                方案确认后，项目如何拆解为需求确认 → 风格样片 → 第一版 → 修改 → 最终交付 → 授权归档的里程碑节点。（预览，尚未上线）
              </div>
            </div>
            <span style={{ color: '#d97706', fontSize: '1.1rem', marginLeft: '1rem', flexShrink: 0 }}>→</span>
          </Link>
        </Section>

        {/* Trust */}
        <Section id="trust">
          <SectionTitle>信任与争议预防</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Risks */}
        <Section id="risks">
          <SectionTitle>风险与边界声明</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {RISKS_AND_BOUNDARIES.map((item) => (
              <div
                key={item.title}
                style={{
                  background: '#18181b',
                  border: `1px solid ${item.level === 'warning' ? '#a1620740' : '#27272a'}`,
                  borderLeft: `3px solid ${item.level === 'warning' ? '#a16207' : '#3f3f46'}`,
                  borderRadius: '10px', padding: '0.875rem 1.125rem',
                }}
              >
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: item.level === 'warning' ? '#ca8a04' : '#a1a1aa', marginBottom: '0.3rem' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{item.content}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Roadmap */}
        <Section id="roadmap">
          <SectionTitle>未来版本计划（{ROADMAP.length} 阶段）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ROADMAP.map((stage) => {
              const statusColor = stage.status === 'done' ? '#22c55e' : stage.status === 'active' ? '#a78bfa' : '#52525b'
              const statusLabel = stage.status === 'done' ? '已完成' : stage.status === 'active' ? '当前' : '规划中'
              return (
                <div
                  key={stage.stage}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem',
                    background: '#18181b', border: `1px solid ${stage.status === 'active' ? '#7c3aed40' : '#27272a'}`, borderRadius: '10px',
                  }}
                >
                  <div
                    style={{
                      minWidth: '22px', height: '22px', borderRadius: '50%',
                      background: `${statusColor}20`, border: `1px solid ${statusColor}60`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color: statusColor, flexShrink: 0,
                    }}
                  >
                    {stage.stage}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: stage.status === 'active' ? 700 : 500, color: stage.status === 'planned' ? '#71717a' : '#d4d4d8', marginRight: '0.5rem' }}>
                      {stage.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#52525b' }}>{stage.description}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#52525b', whiteSpace: 'nowrap' }}>{stage.quarter}</div>
                  <span
                    style={{
                      fontSize: '9px', fontWeight: 600, color: statusColor,
                      background: `${statusColor}15`, border: `1px solid ${statusColor}35`,
                      borderRadius: '9999px', padding: '1px 7px', whiteSpace: 'nowrap',
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Quick links */}
        <Section id="quick-links">
          <SectionTitle>快速链接</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.75rem' }}>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ display: 'block', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '0.875rem 1rem', textDecoration: 'none' }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>{link.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>{link.description}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #27272a', paddingTop: '1.5rem', textAlign: 'center', fontSize: '11px', color: '#3f3f46' }}>
          /proposal-flow-preview · 静态预览 · 不提交真实报价 · 不创建订单 · 不接支付 · 不写数据库 · 不触发生成
        </div>
      </div>
    </div>
  )
}
