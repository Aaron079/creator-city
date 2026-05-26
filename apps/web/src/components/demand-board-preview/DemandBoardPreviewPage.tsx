// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All demands are mock/preview. No real orders, no payments, no DB writes, no generation triggers.
import Link from 'next/link'
import {
  HERO,
  REASONS,
  DEMAND_TYPES,
  MOCK_DEMANDS,
  BRIEF_FIELDS,
  PROPOSAL_FLOW,
  FILTER_TAGS,
  PROJECT_OWNER_VALUES,
  CREATOR_VALUES,
  RISKS_AND_BOUNDARIES,
  ROADMAP,
  QUICK_LINKS,
} from './demandBoardPreviewData'

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

function MockBadge() {
  return (
    <span
      style={{
        fontSize: '9px',
        fontWeight: 700,
        color: '#6b7280',
        background: '#6b728018',
        border: '1px solid #6b728040',
        borderRadius: '9999px',
        padding: '1px 6px',
        letterSpacing: '0.06em',
      }}
    >
      MOCK
    </span>
  )
}

export default function DemandBoardPreviewPage() {
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
          {/* Status chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {HERO.statusChips.map((chip) => (
              <Chip key={chip.label} label={chip.label} color={chip.color} />
            ))}
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
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
          <p style={{ fontSize: '0.92rem', color: '#71717a', maxWidth: '520px', margin: '0 auto 1.75rem', lineHeight: 1.65 }}>
            {HERO.tagline}
          </p>

          {/* CTA — anchor links only, no API */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="#mock-demands"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                background: '#7c3aed',
                color: '#fff',
                borderRadius: '9px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid #7c3aed',
              }}
            >
              查看需求卡片
            </a>
            <a
              href="#proposal-flow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                background: 'transparent',
                color: '#a78bfa',
                borderRadius: '9px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid #7c3aed50',
              }}
            >
              查看报价流程
            </a>
          </div>
        </div>
      </Section>

      {/* Main content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 0' }}>

        {/* Why */}
        <Section id="why">
          <SectionTitle>为什么需要需求广场</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
            {REASONS.map((r) => (
              <div
                key={r.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1.1rem',
                }}
              >
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{r.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.3rem' }}>{r.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{r.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Demand types */}
        <Section id="demand-types">
          <SectionTitle>需求类型（{DEMAND_TYPES.length} 类）</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {DEMAND_TYPES.map((dt) => (
              <div
                key={dt.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  display: 'flex',
                  gap: '0.625rem',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{dt.icon}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>{dt.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#71717a', lineHeight: 1.5 }}>{dt.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Mock demands */}
        <Section id="mock-demands">
          <SectionTitle>Mock 需求卡片（{MOCK_DEMANDS.length} 张）</SectionTitle>
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
            以下均为 Mock 数据，不代表真实需求、真实公司或真实客户。不提供真实接单功能。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {MOCK_DEMANDS.map((demand) => (
              <div
                key={demand.id}
                style={{
                  background: '#18181b',
                  border: `1px solid ${demand.urgency === 'urgent' ? '#dc262640' : '#27272a'}`,
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  position: 'relative',
                }}
              >
                {demand.urgency === 'urgent' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#f87171',
                      background: '#dc262618',
                      border: '1px solid #dc262640',
                      borderRadius: '9999px',
                      padding: '1px 7px',
                    }}
                  >
                    急单
                  </span>
                )}
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: '#7c3aed', background: '#7c3aed18', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>
                    {demand.category}
                  </span>
                  <MockBadge />
                </div>
                {/* Title */}
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7', lineHeight: 1.35 }}>
                  {demand.title}
                </div>
                {/* Description */}
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>
                  {demand.description}
                </div>
                {/* Budget + duration */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingTop: '0.25rem' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '1px' }}>预算</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f4f4f5' }}>
                      ¥{demand.budgetMin.toLocaleString()}–{demand.budgetMax.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '1px' }}>周期</div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#d4d4d8' }}>{demand.durationDays}</div>
                  </div>
                </div>
                {/* Roles */}
                <div>
                  <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '4px' }}>所需角色</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {demand.roles.map((role) => (
                      <span key={role} style={{ fontSize: '10px', color: '#a1a1aa', background: '#27272a', borderRadius: '6px', padding: '2px 7px' }}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Styles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {demand.styles.map((s) => (
                    <span key={s} style={{ fontSize: '10px', color: '#71717a', background: '#7c3aed12', border: '1px solid #7c3aed25', borderRadius: '6px', padding: '2px 7px' }}>
                      {s}
                    </span>
                  ))}
                </div>
                {/* CTA — preview only, no API */}
                <div
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.5rem 0.75rem',
                    background: '#27272a',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#71717a',
                    textAlign: 'center',
                  }}
                >
                  查看需求结构预览 · 不可真实接单
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Brief template */}
        <Section id="brief-template">
          <SectionTitle>结构化 Brief 模板</SectionTitle>
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
            当前只是模板预览，不保存任何数据。
          </div>
          <div
            style={{
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            {BRIEF_FIELDS.map((field, i) => (
              <div
                key={field.field}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 1fr',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  borderBottom: i < BRIEF_FIELDS.length - 1 ? '1px solid #27272a' : 'none',
                  alignItems: 'start',
                  background: i % 2 === 0 ? 'transparent' : '#09090b30',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>{field.field}</span>
                  {field.required && (
                    <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>*</span>
                  )}
                </div>
                <span style={{ fontSize: '10px', color: '#52525b', paddingTop: '2px' }}>{field.type}</span>
                <span style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>{field.example}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.625rem', fontSize: '10px', color: '#52525b' }}>
            * 必填字段 · 以上字段为规划中的 Brief Builder 模板，当前不实际保存
          </div>
        </Section>

        {/* Proposal flow */}
        <Section id="proposal-flow">
          <SectionTitle>报价与方案流程（7 步）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {PROPOSAL_FLOW.map((step) => (
              <div
                key={step.step}
                style={{
                  display: 'flex',
                  gap: '0.875rem',
                  alignItems: 'flex-start',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                }}
              >
                <div
                  style={{
                    minWidth: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#7c3aed20',
                    border: '1px solid #7c3aed50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#a78bfa',
                    flexShrink: 0,
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
          {/* CTA — link to proposal flow preview */}
          <Link
            href="/proposal-flow-preview"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.875rem 1.25rem',
              background: '#0f1a1a',
              border: '1px solid #0e749040',
              borderRadius: '12px',
              textDecoration: 'none',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#67e8f9', marginBottom: '0.2rem' }}>
                查看报价与方案流程预览
              </div>
              <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>
                了解未来创作者如何根据需求 Brief 提交方案、报价、修改轮次和交付边界（预览页，Mock 数据）
              </div>
            </div>
            <span style={{ fontSize: '1rem', color: '#0e7490', flexShrink: 0 }}>→</span>
          </Link>
        </Section>

        {/* Filter preview */}
        <Section id="filter-preview">
          <SectionTitle>需求筛选能力预览</SectionTitle>
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
            以下为静态筛选标签预览，不实现真实筛选逻辑。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FILTER_TAGS.map((group) => (
              <div key={group.dimension} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#52525b', minWidth: '80px', paddingTop: '3px', flexShrink: 0 }}>
                  {group.dimension}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {group.values.map((val) => (
                    <span
                      key={val}
                      style={{
                        fontSize: '11px',
                        color: '#a1a1aa',
                        background: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '7px',
                        padding: '2px 9px',
                        cursor: 'default',
                      }}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Values — project owner */}
        <Section id="project-owner-value">
          <SectionTitle>对项目方的价值</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
            {PROJECT_OWNER_VALUES.map((v) => (
              <div
                key={v.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{v.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{v.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{v.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Values — creator */}
        <Section id="creator-value">
          <SectionTitle>对创作者的价值</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
            {CREATOR_VALUES.map((v) => (
              <div
                key={v.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{v.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{v.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{v.description}</div>
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
                  borderRadius: '10px',
                  padding: '0.875rem 1.125rem',
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
              const statusColor =
                stage.status === 'done' ? '#22c55e' :
                stage.status === 'active' ? '#a78bfa' :
                '#52525b'
              const statusLabel =
                stage.status === 'done' ? '已完成' :
                stage.status === 'active' ? '当前' :
                '规划中'
              return (
                <div
                  key={stage.stage}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    padding: '0.75rem 1rem',
                    background: '#18181b',
                    border: `1px solid ${stage.status === 'active' ? '#7c3aed40' : '#27272a'}`,
                    borderRadius: '10px',
                  }}
                >
                  <div
                    style={{
                      minWidth: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: `${statusColor}20`,
                      border: `1px solid ${statusColor}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: statusColor,
                      flexShrink: 0,
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
                      fontSize: '9px',
                      fontWeight: 600,
                      color: statusColor,
                      background: `${statusColor}15`,
                      border: `1px solid ${statusColor}35`,
                      borderRadius: '9999px',
                      padding: '1px 7px',
                      whiteSpace: 'nowrap',
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
                style={{
                  display: 'block',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>{link.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>{link.description}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #27272a',
            paddingTop: '1.5rem',
            textAlign: 'center',
            fontSize: '11px',
            color: '#3f3f46',
          }}
        >
          /demand-board-preview · 静态预览 · 不发布真实需求 · 不创建订单 · 不接支付 · 不写数据库 · 不触发生成
        </div>
      </div>
    </div>
  )
}
