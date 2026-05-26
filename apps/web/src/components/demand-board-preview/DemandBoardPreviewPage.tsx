// No POST, no PUT, no DELETE. Static data only. Not connected to generation.
import Link from 'next/link'
import {
  HERO,
  BRIEF_FIELDS,
  MOCK_DEMANDS,
  FILTER_DIMENSIONS,
} from './demandBoardPreviewData'
import { MarketPreviewBackLink } from '../market-preview/MarketPreviewBackLink'
import { MarketChainNav } from '../market-preview/MarketChainNav'
import { MarketPreviewNotice } from '../market-preview/MarketPreviewNotice'

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

const STATUS_COLOR: Record<string, string> = {
  '可报价': '#22c55e',
  '需求澄清': '#d97706',
  '等待方案': '#2563eb',
}

export default function DemandBoardPreviewPage() {
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
          background: 'linear-gradient(180deg, #0d1422 0%, #09090b 100%)',
          borderBottom: '1px solid #1e1e24',
          padding: '2.5rem 1.5rem 4.5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '880px', margin: '0 auto 2rem', textAlign: 'left' }}>
          <MarketPreviewBackLink current="demand-board" />
        </div>
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
          Creator City · 市场体系 · 03
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
            href="/proposal-flow-preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.5rem',
              background: '#16a34a',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            查看报价方案
          </Link>
          <Link
            href="/marketplace-preview"
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
            返回市场总览
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* ── Section 1: 结构化 Brief 模板 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="结构化 Brief 模板"
            sub="项目方发布需求前需填写以下字段，确保创作者能快速判断匹配度"
          />

          <div
            style={{
              ...card,
              overflow: 'hidden',
              marginBottom: '0.75rem',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0',
                padding: '0.625rem 1.25rem',
                borderBottom: '1px solid #1e1e24',
                background: '#0d0d12',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>字段</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>示例</span>
            </div>
            {BRIEF_FIELDS.map((f, i) => (
              <div
                key={f.field}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0',
                  padding: '0.7rem 1.25rem',
                  borderBottom: i < BRIEF_FIELDS.length - 1 ? '1px solid #1e1e24' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.014)',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4d4d8' }}>{f.field}</span>
                  {f.required && (
                    <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700, lineHeight: 1 }}>*</span>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55 }}>{f.example}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '10px', color: '#3f3f46' }}>
            * 必填 · 当前为预览模板，不保存数据，不创建真实需求
          </p>
        </section>

        {/* ── Section 2: 需求卡预览 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="需求卡预览"
            sub="以下为 Mock 数据，展示创作者在需求广场中看到的卡片结构"
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
            <span style={{ fontWeight: 600, color: '#ca8a04' }}>Mock 数据 · </span>
            以下需求均为演示数据，不代表真实项目。不提供接单、支付、创建订单功能。
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {MOCK_DEMANDS.map((d) => {
              const statusColor = STATUS_COLOR[d.status] ?? '#71717a'
              return (
                <div
                  key={d.id}
                  style={{
                    ...card,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative',
                    borderColor: d.urgent ? '#dc262640' : '#1e1e24',
                  }}
                >
                  {d.urgent && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '0.875rem',
                        right: '0.875rem',
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

                  {/* Category + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#7c3aed',
                        background: '#7c3aed18',
                        border: '1px solid #7c3aed30',
                        borderRadius: '9999px',
                        padding: '1px 8px',
                        fontWeight: 600,
                      }}
                    >
                      {d.category}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: statusColor,
                        background: `${statusColor}15`,
                        border: `1px solid ${statusColor}35`,
                        borderRadius: '9999px',
                        padding: '1px 8px',
                        fontWeight: 600,
                      }}
                    >
                      {d.status}
                    </span>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7', lineHeight: 1.35 }}>
                    {d.title}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.65 }}>
                    {d.description}
                  </div>

                  {/* Budget + duration */}
                  <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.25rem' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '2px' }}>预算</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f4f4f5' }}>
                        ¥{d.budgetMin.toLocaleString()}–{d.budgetMax.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '2px' }}>周期</div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#d4d4d8' }}>{d.durationDays}</div>
                    </div>
                  </div>

                  {/* Roles */}
                  <div>
                    <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '4px' }}>所需角色</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {d.roles.map((r) => (
                        <span
                          key={r}
                          style={{
                            fontSize: '10px',
                            color: '#a1a1aa',
                            background: '#1e1e2a',
                            border: '1px solid #27272a',
                            borderRadius: '6px',
                            padding: '2px 7px',
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Styles */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {d.styles.map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: '10px',
                          color: '#71717a',
                          background: '#7c3aed12',
                          border: '1px solid #7c3aed25',
                          borderRadius: '6px',
                          padding: '2px 7px',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <Link
                    href="/proposal-flow-preview"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      background: 'transparent',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#71717a',
                      textDecoration: 'none',
                      gap: '0.35rem',
                    }}
                  >
                    查看报价流程 →
                  </Link>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 3: 筛选维度 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="筛选维度"
            sub="创作者通过以下维度快速判断需求是否匹配自身能力与节奏"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FILTER_DIMENSIONS.map((group) => (
              <div
                key={group.label}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#52525b',
                    minWidth: '76px',
                    paddingTop: '3px',
                    flexShrink: 0,
                    letterSpacing: '0.01em',
                  }}
                >
                  {group.label}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {group.values.map((val) => (
                    <span
                      key={val}
                      style={{
                        fontSize: '11px',
                        color: '#a1a1aa',
                        background: '#111117',
                        border: '1px solid #1e1e24',
                        borderRadius: '7px',
                        padding: '3px 10px',
                      }}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '1.25rem', fontSize: '10px', color: '#3f3f46' }}>
            以上为静态标签，不实现真实筛选逻辑 · 正式版将支持多条件组合筛选
          </p>
        </section>

        {/* ── Section 4: 市场链路 ── */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="市场链路"
            sub="需求广场是创作者市场 6 个环节中的第 3 环"
          />
          <MarketChainNav current="demand-board" />
        </section>

        {/* ── Disclaimer ── */}
        <MarketPreviewNotice text="本页面所有数据均为示例，不保存需求、不接支付、不创建订单、不写数据库。需求广场功能尚在规划阶段，正式上线时间以路线图为准。" />

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
          /demand-board-preview · 静态预览页 · 不保存需求 · 不接支付 · 不创建订单 · 不写数据库
        </div>
      </div>
    </div>
  )
}
