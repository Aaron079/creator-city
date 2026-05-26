// No POST, no PUT, no DELETE. Static data only. Not connected to generation.
import Link from 'next/link'
import {
  HERO,
  ESCROW_FLOW_NODES,
  PARTY_RIGHTS,
  DISPUTE_MECHANISMS,
  MARKET_CHAIN_LINKS,
} from './escrowPreviewData'

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

export default function EscrowPreviewPage() {
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
      {/* ── Hero ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0d0f22 0%, #09090b 100%)',
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
          Creator City · 市场体系 · 06
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
            href="/marketplace-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: '#6366f1',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            返回市场总览
          </Link>
          <Link
            href="/milestone-delivery-preview"
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
            查看阶段交付
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* ── Section 1: 托管流程 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="托管流程"
            sub="6 个规则节点，从预算确认到合作记录，每个节点有项目方与创作者的权益边界"
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
            以下节点均为规则预览，不接支付、不创建订单、不执行结算、不退款、不写数据库。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {ESCROW_FLOW_NODES.map((node) => (
              <div key={node.index} style={{ ...card, padding: '1.25rem' }}>
                {/* Node header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.875rem',
                  }}
                >
                  <div
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#6366f118',
                      border: '1px solid #6366f140',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#818cf8',
                      flexShrink: 0,
                    }}
                  >
                    {String(node.index).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e4e4e7' }}>
                    {node.title}
                  </span>
                </div>

                {/* Two-column: 项目方 / 创作者 */}
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
                      项目方
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55 }}>
                      {node.forOwner}
                    </div>
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
                      创作者
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55 }}>
                      {node.forCreator}
                    </div>
                  </div>
                </div>

                {/* Boundary */}
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
                  {node.boundary}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: 双方权益 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="双方权益"
            sub="托管结算对项目方和创作者分别提供的规则保障"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1rem',
            }}
          >
            {PARTY_RIGHTS.map((party) => (
              <div key={party.party} style={{ ...card, padding: '1.25rem' }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: party.color,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '1rem',
                  }}
                >
                  {party.party}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {party.items.map((item) => (
                    <div key={item.title} style={{ display: 'flex', gap: '0.625rem' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.15rem' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#71717a', lineHeight: 1.6 }}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: 风险与争议 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="风险与争议"
            sub="4 类常见争议情形及对应的处理路径，全部为静态规则说明"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {DISPUTE_MECHANISMS.map((d) => (
              <div
                key={d.title}
                style={{
                  ...card,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{d.icon}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7' }}>{d.title}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.65 }}>
                  {d.description}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#818cf8',
                    background: '#6366f112',
                    border: '1px solid #6366f128',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    lineHeight: 1.55,
                  }}
                >
                  {d.resolution}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: 市场链路 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="市场链路"
            sub="托管结算是创作者市场 6 个环节中的第 6 环，市场闭环在此完成"
          />
          <div
            style={{
              ...card,
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0',
            }}
          >
            {MARKET_CHAIN_LINKS.flatMap((node, i) => [
              <Link
                key={node.href}
                href={node.href}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '10px',
                  background: node.current ? '#6366f118' : 'transparent',
                  border: node.current ? '1px solid #6366f140' : '1px solid transparent',
                  textDecoration: 'none',
                  minWidth: '76px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: node.current ? '#6366f1' : '#3f3f46',
                    letterSpacing: '0.04em',
                  }}
                >
                  {String(node.index).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: node.current ? 700 : 500,
                    color: node.current ? '#818cf8' : '#71717a',
                  }}
                >
                  {node.label}
                </span>
                {node.current && (
                  <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 600 }}>← 当前</span>
                )}
              </Link>,
              i < MARKET_CHAIN_LINKS.length - 1 && (
                <span key={`arrow-${i}`} style={{ fontSize: '12px', color: '#27272a', padding: '0 0.15rem' }}>
                  →
                </span>
              ),
            ])}
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <div
          style={{
            ...card,
            borderLeft: '3px solid #a16207',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ca8a04', marginBottom: '0.3rem' }}>
            当前为预览页
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.65 }}>
            本页面所有数据均为示例规则说明，不接支付、不创建订单、不执行结算、不退款、不写数据库。
            托管结算功能尚在规划阶段，正式上线时间以路线图为准。
          </div>
        </div>

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
          /escrow-preview · 静态预览页 · 预览规则 · 不接支付 · 不创建订单 · 不执行结算 · 不退款 · 不写数据库
        </div>
      </div>
    </div>
  )
}
