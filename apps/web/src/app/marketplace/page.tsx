// /marketplace — Creator Marketplace 创作者市场
// Real asset listings via MarketplaceListings (client component).
// Static sections (rules, safety, quick links) rendered on server.
// No POST, no PUT, no DELETE. No payment, no transactions.
import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'
import { CommunitySectionHeader } from '@/components/community/CommunitySectionHeader'
import { MarketplaceListings } from '@/components/marketplace/MarketplaceListings'
import { marketplaceRules, safetyTips, quickLinks } from '@/components/marketplace/marketplaceData'

export const metadata = {
  title: '创作者市场 | Creator City',
  description: '公开可复用资产展示与市场意向登记 — 购买授权功能规划中',
}

const glassPanel = {
  borderRadius: 30,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.025)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  padding: '24px',
}

const card = {
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(0,0,0,0.18)',
  padding: '16px 18px',
}

export default function MarketplacePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <TopNavigation />

      <main
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '96px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <CommunitySectionHeader
          districtZh="交易市场"
          desc="公开可复用资产展示与市场意向登记。"
          activeHref="/marketplace"
        />

        {/* ── Hero banner ── */}
        <section
          style={{
            borderRadius: 34,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            padding: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.32)',
                }}
              >
                Marketplace
              </div>
              <h1
                style={{
                  marginTop: 14,
                  fontSize: 36,
                  fontWeight: 300,
                  letterSpacing: '-0.05em',
                  color: '#fff',
                }}
              >
                创作者市场
              </h1>
              <p
                style={{
                  marginTop: 12,
                  maxWidth: 600,
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: 'rgba(255,255,255,0.54)',
                }}
              >
                当前为公开可复用资产展示。
                <br />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
                  购买授权、定价、收益分成将在后续 Marketplace 阶段接入。所有交易功能当前不可用。
                </span>
              </p>
            </div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.38)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 99,
                padding: '2px 9px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              仅展示 · 不可交易
            </span>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link
              href="/assets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
              }}
            >
              我的资产库
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                padding: '7px 16px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
              }}
            >
              返回工作台
            </Link>
          </div>
        </section>

        {/* ── Real listings (client component) ── */}
        <MarketplaceListings />

        {/* ── Coming Soon: creator services ── */}
        <section style={glassPanel}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.32)',
            }}
          >
            服务委托 · Coming Soon
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: '-0.04em',
              color: '#fff',
            }}
          >
            创作者服务委托
          </div>
          <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, color: 'rgba(255,255,255,0.40)' }}>
            创作者接单、项目委托、服务报价等功能正在规划中，尚未上线。
          </p>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {['AI 广告片制作', 'AI 短剧 / 漫剧', 'AI 图像视觉', '分镜 / 脚本', '剪辑 / 后期', '选角 / 角色设计'].map(
              (label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 12,
                    padding: '5px 14px',
                    borderRadius: 99,
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.30)',
                    cursor: 'not-allowed',
                  }}
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </section>

        {/* ── Rules + Safety ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 20,
          }}
        >
          <section style={glassPanel}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.32)',
              }}
            >
              平台规则
            </div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 300, letterSpacing: '-0.04em', color: '#fff' }}>
              交易规则预览
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {marketplaceRules.map((rule, i) => (
                <div
                  key={rule.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    paddingBottom: i < marketplaceRules.length - 1 ? 14 : 0,
                    borderBottom: i < marketplaceRules.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.30)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 5 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.44)' }}>
                      {rule.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={glassPanel}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.32)',
              }}
            >
              安全提示
            </div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 300, letterSpacing: '-0.04em', color: '#fff' }}>
              保护自己与他人
            </div>
            <ul style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {safetyTips.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 3,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'rgba(167,139,250,0.55)',
                    }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.56)' }}>{item.tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Quick Links ── */}
        <section style={glassPanel}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.32)',
            }}
          >
            快速导航
          </div>
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 300, letterSpacing: '-0.04em', color: '#fff' }}>
            前往其他页面
          </div>
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  ...card,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}>{link.label}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>{link.desc}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
