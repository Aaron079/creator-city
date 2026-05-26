// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All milestones, projects, deliveries are mock/preview. No real orders, payments, DB writes, or generation triggers.
import Link from 'next/link'
import {
  HERO,
  REASONS,
  MILESTONE_STRUCTURE,
  MOCK_PROJECT_BOARD,
  DELIVERY_CHECKLISTS,
  ACCEPTANCE_FLOW,
  CREATOR_WORKFLOW,
  STATUS_CHIPS,
  PROOF_TRAIL_FIELDS,
  RISKS_AND_BOUNDARIES,
  ROADMAP,
  QUICK_LINKS,
} from './milestoneDeliveryPreviewData'
import type { BoardStageStatus } from './milestoneDeliveryPreviewData'

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

function stageStatusColor(status: BoardStageStatus): string {
  return status === 'done' ? '#22c55e' : status === 'active' ? '#a78bfa' : '#3f3f46'
}

function stageStatusLabel(status: BoardStageStatus): string {
  return status === 'done' ? '已完成' : status === 'active' ? '进行中' : '待开始'
}

export default function MilestoneDeliveryPreviewPage() {
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
          <p style={{ fontSize: '0.9rem', color: '#71717a', maxWidth: '500px', margin: '0 auto 1.75rem', lineHeight: 1.65 }}>
            {HERO.tagline}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="#milestone-structure"
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1.1rem',
                background: '#7c3aed', color: '#fff', borderRadius: '9px',
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #7c3aed',
              }}
            >
              查看里程碑结构
            </a>
            <a
              href="#acceptance-flow"
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1.1rem',
                background: 'transparent', color: '#a78bfa', borderRadius: '9px',
                fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #7c3aed50',
              }}
            >
              查看验收流程
            </a>
          </div>
        </div>
      </Section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 0' }}>

        {/* Why */}
        <Section id="why">
          <SectionTitle>为什么需要阶段交付</SectionTitle>
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

        {/* Milestone structure */}
        <Section id="milestone-structure">
          <SectionTitle>里程碑结构（8 个阶段）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {MILESTONE_STRUCTURE.map((stage) => (
              <div
                key={stage.index}
                style={{
                  background: '#18181b',
                  border: `1px solid ${stage.triggerPayment ? '#16a34a40' : '#27272a'}`,
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <div
                    style={{
                      minWidth: '24px', height: '24px', borderRadius: '50%',
                      background: '#7c3aed20', border: '1px solid #7c3aed50',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color: '#a78bfa', flexShrink: 0,
                    }}
                  >
                    {stage.index}
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7' }}>{stage.title}</span>
                  {stage.triggerPayment && (
                    <span style={{ fontSize: '9px', color: '#22c55e', background: '#16a34a15', border: '1px solid #16a34a35', borderRadius: '9999px', padding: '1px 6px', fontWeight: 600 }}>
                      触发付款（规划）
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#a1a1aa', marginBottom: '0.625rem', lineHeight: 1.5 }}>{stage.goal}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.06em' }}>创作者交付物</div>
                    {stage.creatorDeliverables.map((item) => (
                      <div key={item} style={{ fontSize: '11px', color: '#71717a', display: 'flex', gap: '4px', marginBottom: '2px' }}>
                        <span style={{ color: '#7c3aed' }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.06em' }}>项目方确认项</div>
                    {stage.clientConfirmItems.map((item) => (
                      <div key={item} style={{ fontSize: '11px', color: '#71717a', display: 'flex', gap: '4px', marginBottom: '2px' }}>
                        <span style={{ color: '#22c55e' }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#a16207', background: '#a1620710', borderRadius: '5px', padding: '3px 8px', display: 'inline-block' }}>
                  ⚠ {stage.riskNote}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Mock project board */}
        <Section id="mock-board">
          <SectionTitle>Mock 项目阶段看板</SectionTitle>
          <InfoNote>以下为 Mock 数据，不代表真实项目。状态仅为静态展示，不可点击改变，不调用 API，不写数据库。</InfoNote>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '1.25rem' }}>
            {/* Project header */}
            <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #27272a' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e4e4e7' }}>{MOCK_PROJECT_BOARD.title}</div>
                <span style={{ fontSize: '9px', color: '#6b7280', background: '#6b728015', border: '1px solid #6b728040', borderRadius: '9999px', padding: '1px 7px', fontWeight: 700 }}>MOCK</span>
              </div>
              <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '0.5rem' }}>
                {MOCK_PROJECT_BOARD.clientCode} · {MOCK_PROJECT_BOARD.creatorName}
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>预算 </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f4f4f5' }}>
                    ¥{MOCK_PROJECT_BOARD.budgetMin.toLocaleString()}–{MOCK_PROJECT_BOARD.budgetMax.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>周期 </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d4d4d8' }}>{MOCK_PROJECT_BOARD.durationDays}</span>
                </div>
              </div>
            </div>
            {/* Stage timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {MOCK_PROJECT_BOARD.stages.map((stage, i) => {
                const color = stageStatusColor(stage.status)
                const label = stageStatusLabel(stage.status)
                return (
                  <div
                    key={stage.index}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.875rem',
                      background: stage.status === 'active' ? '#1c1028' : 'transparent',
                      border: `1px solid ${stage.status === 'active' ? '#7c3aed40' : '#27272a'}`,
                      borderRadius: '9px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: `${color}20`, border: `2px solid ${color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700, color,
                        }}
                      >
                        {stage.status === 'done' ? '✓' : stage.index}
                      </div>
                      {i < MOCK_PROJECT_BOARD.stages.length - 1 && (
                        <div style={{ width: '1px', height: '8px', background: '#27272a', marginTop: '2px' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: stage.status === 'active' ? 700 : 500, color: stage.status === 'pending' ? '#52525b' : '#d4d4d8' }}>
                        {stage.title}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#52525b', whiteSpace: 'nowrap' }}>
                      {stage.completedAt ?? stage.estimatedAt}
                    </div>
                    <span
                      style={{
                        fontSize: '9px', fontWeight: 600, color,
                        background: `${color}15`, border: `1px solid ${color}35`,
                        borderRadius: '9999px', padding: '1px 7px', whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>

        {/* Delivery checklists */}
        <Section id="checklists">
          <SectionTitle>每阶段交付清单</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {DELIVERY_CHECKLISTS.map((cl) => (
              <div key={cl.stage} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '0.5rem', borderBottom: '1px solid #27272a', paddingBottom: '0.4rem' }}>
                  {cl.stage}
                </div>
                {cl.items.map((item) => (
                  <div key={item} style={{ fontSize: '0.75rem', color: '#71717a', display: 'flex', gap: '5px', alignItems: 'flex-start', marginBottom: '3px' }}>
                    <span style={{ color: '#7c3aed', flexShrink: 0, marginTop: '1px' }}>·</span>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Acceptance flow */}
        <Section id="acceptance-flow">
          <SectionTitle>项目方验收流程（7 步）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {ACCEPTANCE_FLOW.map((step) => (
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

        {/* Creator workflow */}
        <Section id="creator-workflow">
          <SectionTitle>创作者工作流程</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {CREATOR_WORKFLOW.map((item) => (
              <div key={item.title} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Status system */}
        <Section id="status-system">
          <SectionTitle>状态系统预览</SectionTitle>
          <InfoNote>以下为静态状态展示，不改变真实项目状态，不调用 API。</InfoNote>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {STATUS_CHIPS.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '0.75rem 1rem',
                }}
              >
                <span
                  style={{
                    fontSize: '11px', fontWeight: 700, color: s.color,
                    background: `${s.color}15`, border: `1px solid ${s.color}40`,
                    borderRadius: '9999px', padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {s.label}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#71717a', lineHeight: 1.5 }}>{s.description}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Proof trail */}
        <Section id="proof-trail">
          <SectionTitle>交付凭证与留痕</SectionTitle>
          <InfoNote>以下为未来可记录的凭证字段，当前不保存任何真实数据。</InfoNote>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', overflow: 'hidden' }}>
            {PROOF_TRAIL_FIELDS.map((field, i) => (
              <div
                key={field}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  borderBottom: i < PROOF_TRAIL_FIELDS.length - 1 ? '1px solid #27272a' : 'none',
                  background: i % 2 === 0 ? 'transparent' : '#09090b30',
                }}
              >
                <span style={{ fontSize: '10px', color: '#52525b', fontWeight: 700, minWidth: '20px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#d4d4d8' }}>{field}</span>
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
              const color = stage.status === 'done' ? '#22c55e' : stage.status === 'active' ? '#a78bfa' : '#52525b'
              const label = stage.status === 'done' ? '已完成' : stage.status === 'active' ? '当前' : '规划中'
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
                      background: `${color}20`, border: `1px solid ${color}60`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color, flexShrink: 0,
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
                      fontSize: '9px', fontWeight: 600, color,
                      background: `${color}15`, border: `1px solid ${color}35`,
                      borderRadius: '9999px', padding: '1px 7px', whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          {/* CTA → escrow-preview */}
          <Link
            href="/escrow-preview"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#150f1a', border: '1px solid #7c3aed30',
              borderRadius: '12px', padding: '1rem 1.25rem',
              textDecoration: 'none', marginTop: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#c4b5fd', marginBottom: '0.2rem' }}>
                查看托管与结算预览
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                阶段验收通过后，项目如何进入托管、按规则释放款、处理退款与争议。（预览，尚未上线）
              </div>
            </div>
            <span style={{ color: '#7c3aed', fontSize: '1.1rem', marginLeft: '1rem', flexShrink: 0 }}>→</span>
          </Link>
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
          /milestone-delivery-preview · 静态预览 · 不提交真实交付 · 不创建订单 · 不接支付 · 不写数据库 · 不触发生成
        </div>
      </div>
    </div>
  )
}
