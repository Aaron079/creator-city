// /enterprise-preview — Static enterprise version preview page
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. No payment, no orders, no enterprise account creation.
// Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  targetCustomers,
  enterpriseCapabilities,
  workflowSteps,
  permissionRoles,
  permissionColumns,
  securityItems,
  enterprisePlans,
  valuePoints,
  onboardingFlow,
  risksAndBoundaries,
  quickLinks,
} from '@/components/enterprise-preview/enterprisePreviewData'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function StaticChip({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: color ?? 'rgba(255,255,255,0.42)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 999,
      padding: '3px 10px',
    }}>
      {label}
    </span>
  )
}

function CapStatusChip({ status }: { status: '规划中' | '企业版预览' }) {
  const isPreview = status === '企业版预览'
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: isPreview ? '#6ee7b7' : '#fcd34d',
      background: isPreview ? 'rgba(6,78,59,0.22)' : 'rgba(120,53,15,0.24)',
      border: `1px solid ${isPreview ? 'rgba(110,231,183,0.22)' : 'rgba(252,211,77,0.20)'}`,
      borderRadius: 999,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px', ...style }}>
      {children}
    </section>
  )
}

function Divider() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

function BoolCell({ value }: { value: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      color: value ? 'rgba(110,231,183,0.85)' : 'rgba(255,255,255,0.15)',
    }}>
      {value ? '✓' : '—'}
    </div>
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
      maxWidth: 840,
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
        <StaticChip label="静态预览" color="#6ee7b7" />
        <StaticChip label="企业方案规划" color="#93c5fd" />
        <StaticChip label="不接支付" />
        <StaticChip label="不写数据库" />
        <StaticChip label="不触发生成" />
      </div>

      <h1 style={{
        fontSize: 'clamp(26px, 4.8vw, 52px)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#fff',
        margin: '0 0 20px',
        lineHeight: 1.12,
      }}>
        Creator City 企业版预览
      </h1>

      <p style={{
        fontSize: 'clamp(13px, 1.8vw, 16px)',
        color: 'rgba(255,255,255,0.50)',
        lineHeight: 1.7,
        maxWidth: 620,
        margin: '0 0 24px',
      }}>
        为专业团队提供项目协作、资产管理、权限控制、私有部署和 AI 生产工作流的一体化方案。
      </p>

      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.28)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '8px 18px',
        lineHeight: 1.6,
      }}>
        当前为静态企业版方案预览。不开通企业服务，不创建订单，不接支付，不写数据库，不触发生成。
      </div>
    </section>
  )
}

// ── 2. Target customers ───────────────────────────────────────────────────────

function TargetCustomersSection() {
  return (
    <Section>
      <SectionLabel>企业客户对象</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {targetCustomers.map((c) => (
          <div key={c.id} style={{ ...glassLighter, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#a5b4fc',
                flexShrink: 0,
              }}>
                {c.letter}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{c.subtitle}</div>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.useCases.map((u) => (
                <li key={u} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5 }}>
                  <span style={{ color: 'rgba(165,180,252,0.60)', marginTop: 2, flexShrink: 0, fontSize: 10 }}>›</span>
                  {u}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 3. Enterprise capabilities ────────────────────────────────────────────────

function CapabilitiesSection() {
  return (
    <Section>
      <SectionLabel>企业版核心能力</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {enterpriseCapabilities.map((cap) => (
          <div key={cap.name} style={{ ...glassLighter, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{cap.name}</div>
              <CapStatusChip status={cap.status} />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.44)', lineHeight: 1.58, margin: 0 }}>{cap.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 4. Workflow steps ─────────────────────────────────────────────────────────

function WorkflowSection() {
  return (
    <Section>
      <SectionLabel>企业工作流示例</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 24, marginTop: -12 }}>
        静态流程示例，不调用 API，不触发生成。
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 11,
      }}>
        {workflowSteps.map((s, i) => (
          <div key={s.step} style={{ ...glassLighter, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: i === workflowSteps.length - 1 ? 'rgba(99,102,241,0.20)' : 'rgba(255,255,255,0.05)',
              border: i === workflowSteps.length - 1 ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: i === workflowSteps.length - 1 ? '#a5b4fc' : 'rgba(255,255,255,0.38)',
              flexShrink: 0,
            }}>
              {s.step}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.action}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#a5b4fc',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.22)',
                  borderRadius: 999, padding: '1px 7px',
                }}>
                  {s.role}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 5. Permission matrix ──────────────────────────────────────────────────────

function PermissionMatrixSection() {
  return (
    <Section>
      <SectionLabel>企业权限模型预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 18, marginTop: -12 }}>
        静态权限矩阵，不写 DB。窄屏可横向滚动。
      </p>
      <div style={{ overflowX: 'auto', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
        <table style={{
          width: '100%',
          minWidth: 640,
          borderCollapse: 'collapse',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '12px 20px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.30)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                whiteSpace: 'nowrap',
                minWidth: 140,
              }}>
                角色
              </th>
              {permissionColumns.map((col) => (
                <th key={col.key} style={{
                  padding: '12px 12px',
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.30)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  whiteSpace: 'nowrap',
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionRoles.map((r, i) => (
              <tr key={r.role} style={{ borderBottom: i < permissionRoles.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <td style={{ padding: '11px 20px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.role}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.36)', marginTop: 1 }}>{r.subtitle}</div>
                </td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canView} /></td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canEdit} /></td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canGenerate} /></td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canManageMembers} /></td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canExport} /></td>
                <td style={{ padding: '11px 12px' }}><BoolCell value={r.canViewCost} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── 6. Security ───────────────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <Section>
      <SectionLabel>企业数据与安全</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {securityItems.map((s) => (
          <div key={s.title} style={{ ...glassLighter, padding: '18px 20px', borderLeft: '2px solid rgba(110,231,183,0.25)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{s.icon}</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7' }}>{s.title}</div>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', lineHeight: 1.62, margin: 0 }}>{s.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 7. Enterprise plans ───────────────────────────────────────────────────────

function EnterprisePlansSection() {
  return (
    <Section>
      <SectionLabel>企业方案套餐预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 22, marginTop: -12 }}>
        价格和正式服务未开放，需后续商务确认。所有按钮均不接支付。
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: 16,
        alignItems: 'stretch',
      }}>
        {enterprisePlans.map((plan) => (
          <div key={plan.id} style={{
            borderRadius: 24,
            border: plan.highlighted ? '1px solid rgba(99,102,241,0.50)' : '1px solid rgba(255,255,255,0.07)',
            background: plan.highlighted ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            padding: '26px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            position: 'relative',
          }}>
            {plan.highlighted && (
              <div style={{
                position: 'absolute', top: -1, left: 24, right: 24,
                height: 2, background: 'rgba(99,102,241,0.80)',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{plan.name}</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>{plan.subtitle}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', marginBottom: 18, fontStyle: 'italic' }}>{plan.audience}</div>
            <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.54)' }}>
                  <span style={{ color: 'rgba(110,231,183,0.70)', marginTop: 1, flexShrink: 0, fontSize: 10 }}>✓</span>
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
        ))}
      </div>
    </Section>
  )
}

// ── 8. Value points ───────────────────────────────────────────────────────────

function ValueSection() {
  return (
    <Section>
      <SectionLabel>企业价值</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {valuePoints.map((v) => (
          <div key={v.title} style={{ ...glassLighter, padding: '18px 20px' }}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>{v.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 7 }}>{v.title}</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', lineHeight: 1.65, margin: 0 }}>{v.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 9. Onboarding flow ────────────────────────────────────────────────────────

function OnboardingSection() {
  return (
    <Section>
      <SectionLabel>接入流程预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 22, marginTop: -12 }}>
        当前只是流程预览，不创建任何表单或订单。
      </p>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {onboardingFlow.map((s, i) => (
          <div key={s.step} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr',
            gap: 16,
            padding: '14px 28px',
            borderBottom: i < onboardingFlow.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'start',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i === onboardingFlow.length - 1 ? 'rgba(99,102,241,0.20)' : 'rgba(255,255,255,0.05)',
              border: i === onboardingFlow.length - 1 ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: i === onboardingFlow.length - 1 ? '#a5b4fc' : 'rgba(255,255,255,0.38)',
              flexShrink: 0,
            }}>
              {s.step}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 10. Risks ─────────────────────────────────────────────────────────────────

function RisksSection() {
  return (
    <Section>
      <SectionLabel>风险与边界</SectionLabel>
      <div style={{ ...glassLighter, padding: '20px 24px', borderLeft: '3px solid rgba(251,146,60,0.40)' }}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {risksAndBoundaries.map((r) => (
            <li key={r.item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.52)', lineHeight: 1.55 }}>
              <span style={{ color: 'rgba(251,146,60,0.70)', marginTop: 1, flexShrink: 0, fontSize: 11 }}>⚠</span>
              {r.item}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ── 11. Quick links ───────────────────────────────────────────────────────────

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
          }}>
            {link.label}
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>→</span>
          </Link>
        ))}
      </div>
    </Section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '28px 24px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', margin: 0, lineHeight: 1.7 }}>
        Creator City 企业版预览 · 静态页面 · 不开通企业服务 · 不接支付 · 不写数据库 · 不触发生成
      </p>
    </footer>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function EnterprisePreviewPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0f',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Hero />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
        <TargetCustomersSection />
        <Divider />
        <CapabilitiesSection />
        <Divider />
        <WorkflowSection />
        <Divider />
        <PermissionMatrixSection />
        <Divider />
        <SecuritySection />
        <Divider />
        <EnterprisePlansSection />
        <Divider />
        <ValueSection />
        <Divider />
        <OnboardingSection />
        <Divider />
        <RisksSection />
        <Divider />
        <QuickLinksSection />
      </div>

      <Footer />
    </div>
  )
}
