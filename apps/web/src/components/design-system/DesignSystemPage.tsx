// /design-system — Static design system reference page
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// Does NOT modify any existing component or style.
import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'
import {
  principles,
  colorTokens,
  typographySamples,
  buttonExamples,
  statusChips,
  cardExamples,
  stateExamples,
  mediaRatios,
  navigationRules,
  dos,
  donts,
  quickLinks,
} from '@/components/design-system/designSystemData'

// ── Style constants ───────────────────────────────────────────────────────────

const glass: React.CSSProperties = {
  borderRadius: 28,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.025)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
}

const glassCard: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.04)',
}

// ── Shared helper components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.24em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)',
      marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 20, fontWeight: 400, letterSpacing: '-0.02em', color: '#fff', marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

function SectionDesc({ children }: { children: string }) {
  return (
    <p style={{
      margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, maxWidth: 520,
    }}>
      {children}
    </p>
  )
}

function DemoTag() {
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px',
    }}>
      DEMO
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DesignSystemPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <TopNavigation />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '96px 24px 100px' }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '36px 36px 32px', marginBottom: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {(['Design System', '静态预览', '不接导航', '不触发生成', '不改旧组件'] as const).map((chip, i) => (
              <span key={i} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: i === 0 ? '#c4b5fd' : 'rgba(255,255,255,0.28)',
                background: i === 0 ? 'rgba(91,33,182,0.20)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${i === 0 ? 'rgba(196,181,253,0.18)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 99, padding: '3px 10px',
              }}>
                {chip}
              </span>
            ))}
          </div>

          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300, letterSpacing: '-0.05em', color: '#fff', lineHeight: 1.2 }}>
            Creator City Design System
          </h1>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 15, lineHeight: 1.8, color: 'rgba(255,255,255,0.50)', maxWidth: 560 }}>
            统一 Creator City 的暗色高级界面、状态表达、卡片比例和交互规范。<br />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>
              本文档仅供新页面开发参考，不反向改动任何已有模块。
            </span>
          </p>

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                borderRadius: 99, border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)', padding: '7px 16px',
                fontSize: 13, color: 'rgba(255,255,255,0.72)', textDecoration: 'none',
              }}>
                {link.label}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)' }}>{link.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Design Principles ─────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>设计原则</SectionLabel>
          <SectionTitle>核心理念</SectionTitle>
          <SectionDesc>指导所有新页面和组件设计决策的基础原则。</SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {principles.map((p) => (
              <div key={p.title} style={{ ...glassCard, padding: '18px 20px' }}>
                <div style={{ fontSize: 22, marginBottom: 10, color: 'rgba(255,255,255,0.55)' }}>
                  {p.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.46)', lineHeight: 1.6 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Color Tokens ──────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>色彩规范</SectionLabel>
          <SectionTitle>颜色 Token</SectionTitle>
          <SectionDesc>
            以下颜色值直接写入 inline style，不修改 Tailwind config 或全局 CSS。
          </SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {colorTokens.map((token) => (
              <div key={token.name} style={{
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: 52,
                  background: token.value,
                  display: 'flex', alignItems: 'flex-end', padding: '6px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: token.textColor === '#fff' ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.40)',
                    fontFamily: 'monospace',
                  }}>
                    {token.value.length > 22 ? token.value.slice(0, 22) + '…' : token.value}
                  </span>
                </div>
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.025)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)', marginBottom: 3 }}>
                    {token.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 1.4 }}>
                    {token.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Typography ────────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>字体规范</SectionLabel>
          <SectionTitle>Typography 层级</SectionTitle>
          <SectionDesc>六个层级，每个层级只在特定场景使用。</SectionDesc>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {typographySamples.map((t, i) => (
              <div key={t.label} style={{
                display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
                padding: '18px 0',
                borderBottom: i < typographySamples.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ width: 100, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.30)', marginBottom: 4 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace' }}>
                    {t.size} · {t.weight}w
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: t.label === 'Hero Title' ? 28 :
                      t.label === 'Section Title' ? 18 :
                      t.label === 'Card Title' ? 15 :
                      t.label === 'Body Text' ? 13 :
                      t.label === 'Caption' ? 11 :
                      t.label === 'Label / Tag' ? 10 : 11,
                    fontWeight: parseInt(t.weight),
                    letterSpacing: t.tracking,
                    color: t.color,
                    textTransform: t.label === 'Label / Tag' ? 'uppercase' : 'none',
                    fontFamily: t.label === 'Code / ID' ? 'monospace' : 'inherit',
                    marginBottom: 6,
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}>
                    {t.sample}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                    {t.usage}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>按钮规范</SectionLabel>
          <SectionTitle>Button Variants</SectionTitle>
          <SectionDesc>按钮仅展示样式，无真实点击行为。每屏 Primary 按钮不超过 1 个。</SectionDesc>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {buttonExamples.map((btn) => {
              const style: React.CSSProperties = {
                display: 'inline-flex', alignItems: 'center',
                borderRadius: 14, padding: '9px 20px',
                fontSize: 13, fontWeight: 500, cursor: btn.variant === 'disabled' ? 'not-allowed' : 'default',
                textDecoration: 'none', border: '1px solid transparent', userSelect: 'none',
                ...(btn.variant === 'primary' && {
                  background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)', color: '#fff',
                }),
                ...(btn.variant === 'secondary' && {
                  background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)',
                }),
                ...(btn.variant === 'ghost' && {
                  background: 'transparent', borderColor: 'transparent', color: 'rgba(255,255,255,0.55)',
                }),
                ...(btn.variant === 'danger' && {
                  background: 'rgba(127,29,29,0.20)', borderColor: 'rgba(248,113,113,0.22)', color: '#f87171',
                }),
                ...(btn.variant === 'disabled' && {
                  background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)',
                }),
              }
              return (
                <div key={btn.variant} style={{
                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                  padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <span style={style}>{btn.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.28)', marginRight: 10,
                    }}>
                      {btn.variant}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>
                      {btn.desc}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Status Chips ──────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>状态规范</SectionLabel>
          <SectionTitle>Status Chip 规范</SectionTitle>
          <SectionDesc>每个 chip 有固定的颜色语义，不同场景不可混用。</SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10,
          }}>
            {statusChips.map((chip) => (
              <div key={chip.label} style={{ ...glassCard, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: chip.color, background: chip.bg, border: `1px solid ${chip.border}`,
                    borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap',
                  }}>
                    {chip.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.30)', marginRight: 4 }}>适用：</span>{chip.when}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.60)', lineHeight: 1.5 }}>
                  <span style={{ color: 'rgba(255,255,255,0.22)', marginRight: 4 }}>避免：</span>{chip.avoid}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Card Examples ─────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>卡片规范</SectionLabel>
          <SectionTitle>Card 样式示例</SectionTitle>
          <SectionDesc>
            所有卡片：borderRadius 20px · border rgba(255,255,255,0.07) · padding 16–20px · gap 12px。
          </SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12,
          }}>
            {cardExamples.map((card) => (
              <div key={card.type} style={{ ...glassCard, padding: '18px 20px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                    {card.type}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {card.isDemo && <DemoTag />}
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: card.statusColor, background: card.statusBg,
                      border: `1px solid ${card.statusColor}33`,
                      borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>
                      {card.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>
                  {card.title}
                </div>
                {card.subtitle && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: card.meta ? 8 : 0 }}>
                    {card.subtitle}
                  </div>
                )}
                {card.meta && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                    {card.meta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Empty / Error / Loading ───────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>状态设计</SectionLabel>
          <SectionTitle>Empty / Error / Loading 状态</SectionTitle>
          <SectionDesc>
            错误状态必须给出可操作的下一步建议，不只显示 errorCode。
          </SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12,
          }}>
            {stateExamples.map((s) => (
              <div key={s.scenario} style={{ ...glassCard, padding: '20px' }}>
                <div style={{ fontSize: 24, marginBottom: 10, color: 'rgba(255,255,255,0.30)', lineHeight: 1 }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                  {s.scenario}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 8, lineHeight: 1.3 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 1.6, marginBottom: s.action ? 12 : 0 }}>
                  {s.desc}
                </div>
                {s.action && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: 11, fontWeight: 600,
                    color: 'rgba(255,255,255,0.45)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 8, padding: '5px 12px',
                    cursor: 'default',
                  }}>
                    {s.action} →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Media Ratios ──────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>媒体规范</SectionLabel>
          <SectionTitle>Media Preview 比例规范</SectionTitle>
          <SectionDesc>
            比例占位块为纯 CSS 实现，不调用任何媒体 URL，不触发 proxy。
          </SectionDesc>

          <div style={{
            marginTop: 20,
            display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end',
          }}>
            {mediaRatios.map((m) => {
              const baseWidth = 140
              const h = Math.round(baseWidth * (m.height / m.width))
              return (
                <div key={m.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: baseWidth, height: Math.min(h, 120),
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.30)' }}>
                      {m.ratio}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.70)', marginBottom: 2 }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>
                      {m.usage}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>
                      {m.note}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Navigation Rules ──────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>导航规范</SectionLabel>
          <SectionTitle>Navigation 设计规则</SectionTitle>
          <SectionDesc>
            以下为设计指导，不改动现有导航组件。新入口必须作为独立 C 类任务接入。
          </SectionDesc>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {navigationRules.map((r, i) => (
              <div key={i} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '16px 0',
                borderBottom: i < navigationRules.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{
                  flexShrink: 0, marginTop: 2,
                  width: 22, height: 22, borderRadius: 6,
                  background: 'rgba(147,197,253,0.12)',
                  border: '1px solid rgba(147,197,253,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#93c5fd',
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
                    {r.rule}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 1.6 }}>
                    {r.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Do / Don't ────────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '28px', marginBottom: 28 }}>
          <SectionLabel>开发守则</SectionLabel>
          <SectionTitle>Do / Don&apos;t</SectionTitle>
          <SectionDesc>写新功能前先对照检查清单。</SectionDesc>

          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Do */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#6ee7b7', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 5,
                  background: 'rgba(6,78,59,0.28)', border: '1px solid rgba(110,231,183,0.22)',
                  fontSize: 11, color: '#6ee7b7',
                }}>✓</span>
                Do
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dos.map((d, i) => (
                  <div key={i} style={{ ...glassCard, padding: '12px 14px', borderLeft: '2px solid rgba(110,231,183,0.25)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 4 }}>
                      {d.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 1.5 }}>
                      {d.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Don't */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#f87171', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 5,
                  background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.22)',
                  fontSize: 11, color: '#f87171',
                }}>✕</span>
                Don&apos;t
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donts.map((d, i) => (
                  <div key={i} style={{ ...glassCard, padding: '12px 14px', borderLeft: '2px solid rgba(248,113,113,0.20)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 4 }}>
                      {d.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', lineHeight: 1.5 }}>
                      {d.risk}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
          此页面为静态设计规范参考，不修改任何现有模块 · 持续迭代{' '}
          <Link href="/help" style={{ color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
            遇到问题？前往诊断帮助
          </Link>
        </div>

      </main>
    </div>
  )
}
