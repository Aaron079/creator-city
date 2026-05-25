// /roadmap — Static product roadmap
// Read-only. Does NOT call any generation API, canvas API, or DB.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'
import {
  roadmapPhases,
  frozenRules,
  recommendedNextSteps,
  riskLevels,
  quickLinks,
  type PhaseStatus,
  type RiskLevel,
} from '@/components/roadmap/roadmapData'

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

// ── Phase status styles ───────────────────────────────────────────────────────

const PHASE_STATUS: Record<PhaseStatus, { color: string; bg: string; border: string }> = {
  '已完成': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.28)', border: 'rgba(110,231,183,0.22)' },
  '已冻结': { color: '#6ee7b7', bg: 'rgba(6,78,59,0.28)', border: 'rgba(110,231,183,0.22)' },
  '持续增强': { color: '#93c5fd', bg: 'rgba(30,58,138,0.28)', border: 'rgba(147,197,253,0.22)' },
  '规划中': { color: '#fcd34d', bg: 'rgba(120,53,15,0.28)', border: 'rgba(252,211,77,0.22)' },
  '后续开启': { color: '#fb923c', bg: 'rgba(124,45,18,0.28)', border: 'rgba(251,146,60,0.22)' },
  '长期规划': { color: '#f472b6', bg: 'rgba(131,24,67,0.22)', border: 'rgba(244,114,182,0.18)' },
}

// ── Risk level badge map ──────────────────────────────────────────────────────

const RISK_BORDER: Record<RiskLevel, string> = {
  A: 'rgba(110,231,183,0.22)',
  B: 'rgba(147,197,253,0.22)',
  C: 'rgba(252,211,77,0.22)',
  D: 'rgba(251,146,60,0.22)',
  E: 'rgba(248,113,113,0.22)',
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
    }}>
      {children}
    </div>
  )
}

function StatusChip({ status }: { status: PhaseStatus }) {
  const s = PHASE_STATUS[status]
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
      borderRadius: 99,
      padding: '2px 9px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {status}
    </span>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      marginTop: 6,
    }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoadmapPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <TopNavigation />

      <main style={{ maxWidth: 940, margin: '0 auto', padding: '96px 24px 100px' }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ ...glass, padding: '36px 36px 32px', marginBottom: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '3px 10px',
            }}>
              Roadmap
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#6ee7b7', background: 'rgba(6,78,59,0.22)',
              border: '1px solid rgba(110,231,183,0.18)', borderRadius: 99, padding: '3px 10px',
            }}>
              静态预览
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, padding: '3px 10px',
            }}>
              不触发生成
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, padding: '3px 10px',
            }}>
              不写数据库
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300, letterSpacing: '-0.05em', color: '#fff', lineHeight: 1.2 }}>
            Creator City 路线图
          </h1>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 15, lineHeight: 1.8, color: 'rgba(255,255,255,0.50)', maxWidth: 560 }}>
            把 AI 影视生产、项目管理、社区协作和创作者市场整合成专业创作城市。
          </p>

          {/* Quick links */}
          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  borderRadius: 99,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '7px 16px',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.75)',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                {link.label}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{link.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Phase timeline ────────────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ ...glass, padding: '28px 28px 8px', marginBottom: 0 }}>
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>阶段规划</SectionLabel>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {roadmapPhases.map((phase, i) => (
                <div
                  key={phase.id}
                  style={{
                    display: 'flex',
                    gap: 0,
                    paddingBottom: 0,
                  }}
                >
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: phase.accent,
                      border: `2px solid ${phase.accent}`,
                      flexShrink: 0,
                      marginTop: 20,
                      boxShadow: `0 0 8px ${phase.accent}55`,
                    }} />
                    {i < roadmapPhases.length - 1 && (
                      <div style={{
                        width: 1,
                        flex: 1,
                        minHeight: 32,
                        background: `linear-gradient(to bottom, ${phase.accent}44, rgba(255,255,255,0.06))`,
                        marginTop: 4,
                        marginBottom: 4,
                      }} />
                    )}
                  </div>

                  {/* Phase card */}
                  <div style={{
                    flex: 1,
                    ...glassLighter,
                    padding: '20px 22px 18px',
                    marginLeft: 16,
                    marginBottom: i < roadmapPhases.length - 1 ? 16 : 20,
                    borderLeft: `2px solid ${phase.accent}33`,
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: phase.accent, marginBottom: 4 }}>
                          {phase.phase}
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>
                          {phase.title}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.44)', lineHeight: 1.5, maxWidth: 480 }}>
                          {phase.subtitle}
                        </div>
                      </div>
                      <StatusChip status={phase.status} />
                    </div>

                    {/* Items */}
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {phase.items.map((item, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <Dot color={phase.accent} />
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Frozen rules ──────────────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ ...glass, padding: '28px' }}>
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>当前冻结红线</SectionLabel>
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, maxWidth: 520 }}>
                以下规则是平台稳定运行的底线。任何任务越界必须立即停止并报告，不得自行修复。
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {frozenRules.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: '16px 0',
                    borderBottom: i < frozenRules.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    flexShrink: 0, marginTop: 2,
                    width: 20, height: 20, borderRadius: 6,
                    background: 'rgba(248,113,113,0.12)',
                    border: '1px solid rgba(248,113,113,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#f87171', fontWeight: 700,
                  }}>
                    ✕
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>
                      {r.rule}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
                      {r.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Risk levels ───────────────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ ...glass, padding: '28px' }}>
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>任务风险等级</SectionLabel>
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, maxWidth: 520 }}>
                每个任务开始前先判断等级，E 类默认禁止，D 类需用户明确授权。
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {riskLevels.map((r) => (
                <div
                  key={r.level}
                  style={{
                    ...glassLighter,
                    padding: '16px 18px',
                    display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
                    borderLeft: `3px solid ${RISK_BORDER[r.level]}`,
                  }}
                >
                  <div style={{
                    flexShrink: 0,
                    minWidth: 28, height: 28, borderRadius: 8,
                    background: r.bg,
                    border: `1px solid ${r.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: r.color,
                  }}>
                    {r.level}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: r.color, marginBottom: 3 }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', marginBottom: 6 }}>
                      {r.desc}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.examples.map((ex, j) => (
                        <span key={j} style={{
                          fontSize: 11, color: 'rgba(255,255,255,0.38)',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 6, padding: '2px 8px',
                        }}>
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recommended next steps ────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ ...glass, padding: '28px' }}>
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>推荐下一步</SectionLabel>
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, maxWidth: 520 }}>
                按安全优先级排列。每次只做一件事，通过验收后再推进。
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recommendedNextSteps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '14px 0',
                    borderBottom: i < recommendedNextSteps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.32)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, padding: '2px 7px', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
                      {step.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.30)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                    cursor: 'not-allowed',
                  }}>
                    {step.taskType} · 即将开放
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
          此页面为静态规划预览，不代表产品承诺 · 路线图持续迭代{' '}
          <Link href="/help" style={{ color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
            遇到问题？前往诊断帮助
          </Link>
        </div>

      </main>
    </div>
  )
}
