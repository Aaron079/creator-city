// /terms-preview — Static terms and copyright preview page
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// This page does NOT constitute formal legal advice or binding agreements.
import Link from 'next/link'
import {
  ruleOverview,
  userResponsibilities,
  platformBoundaries,
  marketplaceFlow,
  prohibitedActions,
  riskWarnings,
  futureLegalDocs,
  quickLinks,
  type ProhibitedAction,
  type FutureLegalDoc,
} from '@/components/terms-preview/termsPreviewData'

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

const DOC_STATUS_STYLE: Record<FutureLegalDoc['status'], { color: string; bg: string; border: string }> = {
  '优先级高': { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)', border: 'rgba(252,211,77,0.22)' },
  '规划中':   { color: '#93c5fd', bg: 'rgba(30,58,138,0.28)', border: 'rgba(147,197,253,0.22)' },
  '待补齐':   { color: 'rgba(255,255,255,0.38)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
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

function DocStatusChip({ status }: { status: FutureLegalDoc['status'] }) {
  const s = DOC_STATUS_STYLE[status]
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

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px', ...style }}>
      {children}
    </section>
  )
}

function Divider() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto 0', padding: '0 24px' }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ── 1. Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{
      minHeight: '26vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: '60px 24px 44px',
      maxWidth: 800,
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
        <StaticChip label="静态预览" color="#6ee7b7" />
        <StaticChip label="非正式法律文本" color="#fcd34d" />
        <StaticChip label="不写数据库" />
        <StaticChip label="不触发生成" />
      </div>

      <h1 style={{
        fontSize: 'clamp(26px, 4.8vw, 50px)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#fff',
        margin: '0 0 20px',
        lineHeight: 1.12,
      }}>
        Creator City 协议与版权规则预览
      </h1>

      <p style={{
        fontSize: 'clamp(13px, 1.8vw, 16px)',
        color: 'rgba(255,255,255,0.50)',
        lineHeight: 1.7,
        maxWidth: 580,
        margin: '0 0 20px',
      }}>
        让创作者、项目方和平台在素材、AI 生成、商业交付和协作中有清晰边界。
      </p>

      <p style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.28)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '8px 16px',
        margin: 0,
        lineHeight: 1.6,
      }}>
        本页面为静态规则预览，不构成正式法律协议，不代表最终法律文本。正式协议将在商业化前单独补充。
      </p>
    </section>
  )
}

// ── 2. Rule overview ──────────────────────────────────────────────────────────

function RuleOverview() {
  return (
    <Section>
      <SectionLabel>规则总览</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: 14,
      }}>
        {ruleOverview.map((cat) => (
          <div key={cat.id} style={{ ...glassLighter, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)',
                flexShrink: 0,
              }}>
                {cat.letter}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{cat.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.36)', marginTop: 2 }}>{cat.tagline}</div>
              </div>
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {cat.items.map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.52)', lineHeight: 1.55 }}>
                  <span style={{ color: 'rgba(255,255,255,0.20)', marginTop: 2, flexShrink: 0 }}>›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 3. User responsibilities ──────────────────────────────────────────────────

function UserResponsibilities() {
  return (
    <Section>
      <SectionLabel>用户责任</SectionLabel>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {userResponsibilities.map((r, i) => (
          <div key={r.title} style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 20,
            padding: '16px 28px',
            borderBottom: i < userResponsibilities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'start',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>{r.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.46)', lineHeight: 1.6 }}>{r.detail}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 4. Platform boundaries ────────────────────────────────────────────────────

function PlatformBoundariesSection() {
  return (
    <Section>
      <SectionLabel>平台责任边界</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 12,
      }}>
        {platformBoundaries.map((b) => (
          <div key={b.title} style={{ ...glassLighter, padding: '18px 20px', borderLeft: '2px solid rgba(147,197,253,0.30)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', marginBottom: 8 }}>{b.title}</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', lineHeight: 1.60, margin: 0 }}>{b.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 5. Marketplace flow ───────────────────────────────────────────────────────

function MarketplaceFlowSection() {
  return (
    <Section>
      <SectionLabel>创作者交易规则预览</SectionLabel>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginBottom: 24, marginTop: -12 }}>
        当前只是流程预览，不接支付、不创建订单、不写数据库。
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {marketplaceFlow.map((s, i) => (
          <div key={s.step} style={{ ...glassLighter, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: i === marketplaceFlow.length - 1
                ? 'rgba(99,102,241,0.20)'
                : 'rgba(255,255,255,0.05)',
              border: i === marketplaceFlow.length - 1
                ? '1px solid rgba(99,102,241,0.45)'
                : '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: i === marketplaceFlow.length - 1 ? '#a5b4fc' : 'rgba(255,255,255,0.38)',
              flexShrink: 0,
            }}>
              {s.step}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.55 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 6. Prohibited actions ─────────────────────────────────────────────────────

function ProhibitedActionsSection() {
  const high = prohibitedActions.filter((a) => a.severity === 'high')
  const medium = prohibitedActions.filter((a) => a.severity === 'medium')

  function ProhibitedList({ items, accent }: { items: ProhibitedAction[]; accent: string }) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((a) => (
          <li key={a.item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5 }}>
            <span style={{ color: accent, marginTop: 2, flexShrink: 0, fontSize: 11 }}>✕</span>
            {a.item}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Section>
      <SectionLabel>禁止行为</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        <div style={{ ...glassLighter, padding: '20px 22px', borderLeft: '3px solid rgba(248,113,113,0.45)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', marginBottom: 16 }}>
            严重违规
          </div>
          <ProhibitedList items={high} accent="rgba(248,113,113,0.80)" />
        </div>
        <div style={{ ...glassLighter, padding: '20px 22px', borderLeft: '3px solid rgba(251,191,36,0.40)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 16 }}>
            一般违规
          </div>
          <ProhibitedList items={medium} accent="rgba(251,191,36,0.75)" />
        </div>
      </div>
    </Section>
  )
}

// ── 7. Risk warnings ──────────────────────────────────────────────────────────

function RiskWarningsSection() {
  return (
    <Section>
      <SectionLabel>风险提示</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {riskWarnings.map((w) => (
          <div key={w.title} style={{ ...glassLighter, padding: '18px 20px' }}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>{w.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 7 }}>{w.title}</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', lineHeight: 1.65, margin: 0 }}>{w.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 8. Future legal docs ──────────────────────────────────────────────────────

function FutureLegalDocsSection() {
  return (
    <Section>
      <SectionLabel>后续正式协议计划</SectionLabel>
      <div style={{ ...glass, padding: '8px 0', overflow: 'hidden' }}>
        {futureLegalDocs.map((doc, i) => (
          <div key={doc.name} style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 16,
            padding: '14px 28px',
            borderBottom: i < futureLegalDocs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>{doc.description}</div>
            </div>
            <DocStatusChip status={doc.status} />
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 9. Quick links ────────────────────────────────────────────────────────────

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
        Creator City 协议与版权规则预览 · 静态页面 · 不构成正式法律协议 · 不写数据库 · 不触发生成
      </p>
    </footer>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function TermsPreviewPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0f',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Hero />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
        <RuleOverview />
        <Divider />
        <UserResponsibilities />
        <Divider />
        <PlatformBoundariesSection />
        <Divider />
        <MarketplaceFlowSection />
        <Divider />
        <ProhibitedActionsSection />
        <Divider />
        <RiskWarningsSection />
        <Divider />
        <FutureLegalDocsSection />
        <Divider />
        <QuickLinksSection />
      </div>

      <Footer />
    </div>
  )
}
