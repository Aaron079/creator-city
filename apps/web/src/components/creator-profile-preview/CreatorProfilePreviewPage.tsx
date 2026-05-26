// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  PROFILE_HERO,
  PROFILE_STATS,
  SKILL_TAGS,
  PORTFOLIO_ITEMS,
  SERVICE_OFFERINGS,
  TRUST_CHAIN,
} from './creatorProfilePreviewData'
import { MarketPreviewBackLink } from '../market-preview/MarketPreviewBackLink'
import { MarketChainNav } from '../market-preview/MarketChainNav'
import { MarketPreviewNotice } from '../market-preview/MarketPreviewNotice'

const card: CSSProperties = {
  background: '#111117',
  border: '1px solid #1e1e24',
  borderRadius: '14px',
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
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
      {sub && <p style={{ fontSize: '0.78rem', color: '#52525b' }}>{sub}</p>}
    </div>
  )
}

export default function CreatorProfilePreviewPage() {
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
          padding: '2rem 1.5rem 3rem',
        }}
      >
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <MarketPreviewBackLink current="creator-profile" />
          </div>

          {/* Status chips */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            {PROFILE_HERO.statusChips.map((chip) => (
              <span
                key={chip.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: chip.color,
                  background: `${chip.color}18`,
                  border: `1px solid ${chip.color}40`,
                  letterSpacing: '0.02em',
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>

          {/* Avatar + info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1.5rem',
              flexWrap: 'wrap',
              marginBottom: '1.75rem',
            }}
          >
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                flexShrink: 0,
                background: `${PROFILE_HERO.avatarColor}20`,
                border: `2px solid ${PROFILE_HERO.avatarColor}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: PROFILE_HERO.avatarColor,
              }}
            >
              {PROFILE_HERO.avatarInitials}
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.2rem',
                }}
              >
                <h1
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#f4f4f5',
                    letterSpacing: '-0.02em',
                    margin: 0,
                  }}
                >
                  {PROFILE_HERO.name}
                </h1>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: PROFILE_HERO.levelColor,
                    background: `${PROFILE_HERO.levelColor}18`,
                    border: `1px solid ${PROFILE_HERO.levelColor}40`,
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    letterSpacing: '0.08em',
                  }}
                >
                  {PROFILE_HERO.level}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#52525b', marginBottom: '0.5rem' }}>
                {PROFILE_HERO.handle} · {PROFILE_HERO.location} · 加入于 {PROFILE_HERO.joinedAt}
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#71717a',
                  marginBottom: '0.65rem',
                }}
              >
                {PROFILE_HERO.tagline}
              </div>
              <p
                style={{
                  fontSize: '0.82rem',
                  color: '#71717a',
                  lineHeight: 1.7,
                  maxWidth: '520px',
                  margin: 0,
                }}
              >
                {PROFILE_HERO.bio}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '1.75rem',
              paddingBottom: '1.75rem',
              borderBottom: '1px solid #1e1e24',
            }}
          >
            {PROFILE_STATS.map((stat) => (
              <div key={stat.label}>
                <div>
                  <span
                    style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5' }}
                  >
                    {stat.value}
                  </span>
                  {stat.sub && (
                    <span style={{ fontSize: '10px', color: '#52525b', marginLeft: '3px' }}>
                      {stat.sub}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '1px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="#services"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.6rem 1.4rem',
                background: '#7c3aed',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              查看服务套餐
            </a>
            <Link
              href="/demand-board-preview"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.6rem 1.4rem',
                background: 'transparent',
                color: '#a1a1aa',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              进入需求广场
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '4.5rem 1.5rem 0' }}>

        {/* Portfolio */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="作品集"
            sub="6 件代表作品 · 全程 AI 创作工作台生产"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {PORTFOLIO_ITEMS.map((item) => (
              <div key={item.id} style={{ ...card, overflow: 'hidden' }}>
                {/* CSS gradient placeholder — no media request */}
                <div
                  style={{
                    background: item.bgGradient,
                    aspectRatio: '16 / 9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #1e1e24',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '2rem', opacity: 0.2 }}>🎬</span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      fontSize: '10px',
                      color: '#a1a1aa',
                      background: '#09090b90',
                      borderRadius: '4px',
                      padding: '1px 6px',
                    }}
                  >
                    {item.duration}
                  </span>
                </div>
                <div style={{ padding: '0.875rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#7c3aed',
                        background: '#7c3aed18',
                        borderRadius: '6px',
                        padding: '1px 7px',
                        fontWeight: 600,
                      }}
                    >
                      {item.category}
                    </span>
                    <span style={{ fontSize: '10px', color: '#52525b' }}>{item.deliveredAt}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      color: '#e4e4e7',
                      marginBottom: '0.35rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#71717a',
                      lineHeight: 1.55,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {item.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '9px',
                          color: '#71717a',
                          background: '#1e1e24',
                          borderRadius: '4px',
                          padding: '1px 6px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader title="技能标签" sub="创作方向 · 工具能力 · 风格能力" />
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.875rem' }}
          >
            {SKILL_TAGS.map((tag) => {
              const color =
                tag.category === 'creation'
                  ? '#7c3aed'
                  : tag.category === 'tool'
                  ? '#0e7490'
                  : '#a16207'
              return (
                <span
                  key={tag.label}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color,
                    background: `${color}15`,
                    border: `1px solid ${color}35`,
                    borderRadius: '8px',
                    padding: '3px 10px',
                  }}
                >
                  {tag.label}
                </span>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            {(
              [
                { cat: 'creation', color: '#7c3aed', label: '创作方向' },
                { cat: 'tool', color: '#0e7490', label: '工具能力' },
                { cat: 'style', color: '#a16207', label: '风格能力' },
              ] as const
            ).map(({ cat, color, label }) => (
              <span
                key={cat}
                style={{
                  fontSize: '10px',
                  color: '#52525b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: color,
                    display: 'inline-block',
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Services */}
        <section id="services" style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader title="服务套餐" sub="3 档方案预览 · 金额为人民币 RMB" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
              marginBottom: '0.875rem',
            }}
          >
            {SERVICE_OFFERINGS.map((svc) => (
              <div
                key={svc.id}
                style={{
                  ...card,
                  border: `1px solid ${svc.popular ? '#7c3aed50' : '#1e1e24'}`,
                  padding: '1.25rem',
                  position: 'relative',
                }}
              >
                {svc.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-1px',
                      right: '1rem',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#a78bfa',
                      background: '#7c3aed',
                      borderRadius: '0 0 6px 6px',
                      padding: '2px 8px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    最受欢迎
                  </span>
                )}
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#e4e4e7',
                    marginBottom: '0.35rem',
                  }}
                >
                  {svc.title}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: '#71717a',
                    lineHeight: 1.55,
                    marginBottom: '0.75rem',
                  }}
                >
                  {svc.description}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5' }}>
                    ¥{svc.priceRmb.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '11px', color: '#52525b' }}>起 · {svc.deliveryDays}天交付</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {svc.includes.map((inc) => (
                    <div
                      key={inc}
                      style={{
                        fontSize: '11px',
                        color: '#71717a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span style={{ color: '#22c55e', fontSize: '10px' }}>✓</span>
                      {inc}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Services disclaimer */}
          <div
            style={{
              background: '#111117',
              border: '1px solid #1e1e24',
              borderLeft: '3px solid #52525b',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '11px',
              color: '#52525b',
            }}
          >
            预览数据，不创建订单，不接支付。了解实际报价流程请查看→
            <Link
              href="/proposal-flow-preview"
              style={{ color: '#7c3aed', textDecoration: 'none', marginLeft: '4px' }}
            >
              报价方案
            </Link>
          </div>
        </section>

        {/* Trust chain */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader
            title="信任保障"
            sub="所有合作均经过平台机制保障，4 个环节完整闭环"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {TRUST_CHAIN.map((item) => (
              <div
                key={item.title}
                style={{
                  ...card,
                  display: 'flex',
                  gap: '1rem',
                  padding: '1.125rem 1.25rem',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: '1px' }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#e4e4e7',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#71717a',
                      lineHeight: 1.65,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {item.desc}
                  </div>
                  <Link
                    href={item.href}
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#7c3aed',
                      textDecoration: 'none',
                    }}
                  >
                    {item.linkLabel} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Market chain quick links */}
        <section style={{ scrollMarginTop: '80px', marginBottom: '4.5rem' }}>
          <SectionHeader title="市场链路" sub="从创作者主页出发，完整交易闭环" />
          <MarketChainNav current="creator-profile" />
        </section>

        {/* Preview disclaimer */}
        <MarketPreviewNotice text="本页面所有数据均为示例，不接支付、不创建订单、不写数据库。创作者主页功能尚在规划阶段，正式上线时间以路线图为准。" />

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
          /creator-profile-preview · 静态预览页 · 不支持真实交易
        </div>
      </div>
    </div>
  )
}
