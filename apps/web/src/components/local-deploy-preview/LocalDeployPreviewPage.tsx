// /local-deploy-preview — Static local deployment preview page
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. No real downloads. No real deployment.
// Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  reasons,
  deployModes,
  capabilityMap,
  architectureLayers,
  securityPrinciples,
  prerequisites,
  roadmapPhases,
  risksAndBoundaries,
  quickLinks,
  type DeployModeStatus,
  type CapabilityStatus,
  type RoadmapPhaseStatus,
} from '@/components/local-deploy-preview/localDeployPreviewData'

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

const DEPLOY_STATUS: Record<DeployModeStatus, { color: string; bg: string; border: string }> = {
  '规划中':   { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)', border: 'rgba(252,211,77,0.22)' },
  '长期规划': { color: '#f472b6', bg: 'rgba(131,24,67,0.22)', border: 'rgba(244,114,182,0.18)' },
  '未来规划': { color: '#fb923c', bg: 'rgba(124,45,18,0.28)', border: 'rgba(251,146,60,0.22)' },
}

const CAPABILITY_STATUS: Record<CapabilityStatus, { color: string; bg: string }> = {
  '规划中':   { color: '#fcd34d', bg: 'rgba(120,53,15,0.20)' },
  '预览':     { color: '#6ee7b7', bg: 'rgba(6,78,59,0.20)' },
  '长期规划': { color: '#f472b6', bg: 'rgba(131,24,67,0.16)' },
}

const ROADMAP_STATUS: Record<RoadmapPhaseStatus, { color: string; bg: string; border: string }> = {
  '当前': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.28)', border: 'rgba(110,231,183,0.30)' },
  '近期': { color: '#93c5fd', bg: 'rgba(30,58,138,0.28)', border: 'rgba(147,197,253,0.22)' },
  '中期': { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)', border: 'rgba(252,211,77,0.22)' },
  '长期': { color: '#f472b6', bg: 'rgba(131,24,67,0.22)', border: 'rgba(244,114,182,0.18)' },
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

function DeployStatusChip({ status }: { status: DeployModeStatus }) {
  const s = DEPLOY_STATUS[status]
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
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

function RoadmapChip({ status }: { status: RoadmapPhaseStatus }) {
  const s = ROADMAP_STATUS[status]
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
        <StaticChip label="不提供下载" />
        <StaticChip label="不执行部署" />
        <StaticChip label="不触发生成" />
        <StaticChip label="不写数据库" />
      </div>

      <h1 style={{
        fontSize: 'clamp(26px, 4.8vw, 50px)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#fff',
        margin: '0 0 20px',
        lineHeight: 1.12,
      }}>
        Creator City 本地部署预览
      </h1>

      <p style={{
        fontSize: 'clamp(13px, 1.8vw, 16px)',
        color: 'rgba(255,255,255,0.50)',
        lineHeight: 1.7,
        maxWidth: 600,
        margin: '0 0 24px',
      }}>
        未来支持创作者和团队把 Creator City 部署到自己的电脑、工作站或私有服务器中，保护素材、项目和工作流资产。
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
        当前为静态方案预览。不提供真实下载，不执行部署，不写数据库，不触发生成。
      </div>
    </section>
  )
}

// ── 2. Reasons ────────────────────────────────────────────────────────────────

function ReasonsSection() {
  return (
    <Section>
      <SectionLabel>为什么需要本地部署</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}>
        {reasons.map((r) => (
          <div key={r.title} style={{ ...glassLighter, padding: '20px 20px' }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{r.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{r.title}</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, margin: 0 }}>{r.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 3. Deploy modes ───────────────────────────────────────────────────────────

function DeployModesSection() {
  return (
    <Section>
      <SectionLabel>部署形态预览</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 16,
      }}>
        {deployModes.map((m) => (
          <div key={m.id} style={{ ...glassLighter, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)',
                  flexShrink: 0,
                }}>
                  {m.letter}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{m.subtitle}</div>
                </div>
              </div>
              <DeployStatusChip status={m.status} />
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
              适用：{m.audience}
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {m.highlights.map((h) => (
                <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                  <span style={{ color: 'rgba(99,102,241,0.70)', marginTop: 2, flexShrink: 0, fontSize: 10 }}>›</span>
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

// ── 4. Capability map ─────────────────────────────────────────────────────────

function CapabilityMapSection() {
  return (
    <Section>
      <SectionLabel>本地部署能力地图</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {capabilityMap.map((cap) => {
          const cs = CAPABILITY_STATUS[cap.status]
          return (
            <div key={cap.name} style={{
              ...glassLighter,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
                {cap.name}
              </div>
              <span style={{
                alignSelf: 'flex-start',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: cs.color,
                background: cs.bg,
                borderRadius: 999,
                padding: '2px 8px',
              }}>
                {cap.status}
              </span>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── 5. Architecture layers ────────────────────────────────────────────────────

function ArchitectureSection() {
  return (
    <Section>
      <SectionLabel>技术架构预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 24, marginTop: -12 }}>
        架构预览，不改实际架构，不新增服务。
      </p>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {architectureLayers.map((layer, i) => (
          <div key={layer.layer} style={{
            display: 'grid',
            gridTemplateColumns: '48px 200px 1fr',
            gap: 16,
            padding: '14px 28px',
            borderBottom: i < architectureLayers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'center',
            borderLeft: `3px solid ${layer.accent}`,
          }}>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.12em',
            }}>
              {layer.layer}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{layer.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.44)', lineHeight: 1.55 }}>{layer.detail}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 6. Security principles ────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <Section>
      <SectionLabel>数据安全原则</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 12,
      }}>
        {securityPrinciples.map((p) => (
          <div key={p.title} style={{ ...glassLighter, padding: '18px 20px', borderLeft: '2px solid rgba(110,231,183,0.30)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7', marginBottom: 8 }}>{p.title}</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', lineHeight: 1.62, margin: 0 }}>{p.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 7. Prerequisites ──────────────────────────────────────────────────────────

function PrerequisitesSection() {
  return (
    <Section>
      <SectionLabel>部署前置条件预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 24, marginTop: -12 }}>
        当前不提供真实安装包，不提供真实部署命令。以下为规划中的前置要求。
      </p>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {prerequisites.map((p, i) => (
          <div key={p.item} style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr auto',
            gap: 16,
            padding: '13px 28px',
            borderBottom: i < prerequisites.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: p.optional ? 'rgba(255,255,255,0.48)' : '#fff' }}>
              {p.item}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>{p.note}</div>
            <span style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: p.optional ? 'rgba(255,255,255,0.30)' : 'rgba(110,231,183,0.70)',
              background: p.optional ? 'rgba(255,255,255,0.04)' : 'rgba(6,78,59,0.20)',
              borderRadius: 999,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}>
              {p.optional ? '可选' : '必需'}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 8. Roadmap ────────────────────────────────────────────────────────────────

function RoadmapSection() {
  return (
    <Section>
      <SectionLabel>未来版本计划</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {roadmapPhases.map((phase) => (
          <div key={phase.phase} style={{ ...glassLighter, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 999,
                padding: '2px 9px',
              }}>
                {phase.phase}
              </span>
              <RoadmapChip status={phase.status} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{phase.label}</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.44)', lineHeight: 1.58, margin: 0 }}>{phase.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 9. Risks ──────────────────────────────────────────────────────────────────

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

// ── 10. Quick links ───────────────────────────────────────────────────────────

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
        Creator City 本地部署预览 · 静态页面 · 不提供下载 · 不执行部署 · 不写数据库 · 不触发生成
      </p>
    </footer>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function LocalDeployPreviewPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0f',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Hero />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
        <ReasonsSection />
        <Divider />
        <DeployModesSection />
        <Divider />
        <CapabilityMapSection />
        <Divider />
        <ArchitectureSection />
        <Divider />
        <SecuritySection />
        <Divider />
        <PrerequisitesSection />
        <Divider />
        <RoadmapSection />
        <Divider />
        <RisksSection />
        <Divider />
        <QuickLinksSection />
      </div>

      <Footer />
    </div>
  )
}
