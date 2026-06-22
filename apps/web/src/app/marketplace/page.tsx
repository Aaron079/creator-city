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
  description: '创作者资产展示与授权意向登记 — 会员可直接联系创作者沟通授权合作',
}

const glassPanel = {
  borderRadius: 20,
  border: '1px solid #dbe3ef',
  background: '#fff',
  padding: '24px',
  boxShadow: '0 10px 30px rgba(16,24,40,0.05)',
}

const card = {
  borderRadius: 16,
  border: '1px solid #e4eaf3',
  background: '#f8fafc',
  padding: '16px 18px',
}

export default function MarketplacePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', color: '#101828' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .marketplace-section-header > div {
              border-bottom-color: #dbe3ef !important;
            }
            .marketplace-section-header a,
            .marketplace-section-header span {
              color: #667085 !important;
            }
            .marketplace-section-header nav a[href="/marketplace"] {
              background: #e8f0ff !important;
              color: #2563eb !important;
            }
            .marketplace-section-header > div > span {
              background: #dbe3ef !important;
            }
          `,
        }}
      />
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
        <div className="marketplace-section-header">
          <CommunitySectionHeader
            districtZh="交易市场"
            desc="创作者资产展示 · 会员授权合作意向登记。"
            activeHref="/marketplace"
          />
        </div>

        {/* ── Hero banner ── */}
        <section
          style={{
            borderRadius: 24,
            border: '1px solid #dbe3ef',
            background: 'linear-gradient(135deg,#ffffff 0%,#f4f8ff 100%)',
            padding: '32px',
            boxShadow: '0 18px 50px rgba(16,24,40,0.07)',
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
                  color: '#98a2b3',
                }}
              >
                Marketplace
              </div>
              <h1
                style={{
                  marginTop: 14,
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: 0,
                  color: '#101828',
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
                  color: '#667085',
                }}
              >
                创作者资产展示与授权意向登记。
                <br />
                <span style={{ fontSize: 12, color: '#667085' }}>
                  第一版不开放平台内积分支付，如需授权合作请直接联系创作者。Creator City 会员可查看创作者联系方式并提交合作意向。
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
                color: '#2563eb',
                background: '#e8f0ff',
                border: '1px solid #c8d7ee',
                borderRadius: 99,
                padding: '2px 9px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              展示 · 意向登记 · 会员合作
            </span>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link
              href="/assets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 99,
                border: '1px solid #c8d7ee',
                background: '#fff',
                padding: '7px 16px',
                fontSize: 13,
                color: '#2563eb',
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
                border: '1px solid #dbe3ef',
                background: '#fff',
                padding: '7px 16px',
                fontSize: 13,
                color: '#475467',
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
              color: '#98a2b3',
            }}
          >
            服务委托 · Coming Soon
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 22,
            fontWeight: 700,
              letterSpacing: 0,
              color: '#101828',
            }}
          >
            创作者服务委托
          </div>
          <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, color: '#667085' }}>
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
                    border: '1px solid #dbe3ef',
                    color: '#667085',
                    background: '#f8fafc',
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
                color: '#98a2b3',
              }}
            >
              平台规则
            </div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, letterSpacing: 0, color: '#101828' }}>
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
                    borderBottom: i < marketplaceRules.length - 1 ? '1px solid #edf1f7' : 'none',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: '#e8f0ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#2563eb',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 650, color: '#101828', marginBottom: 5 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: '#667085' }}>
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
                color: '#98a2b3',
              }}
            >
              安全提示
            </div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, letterSpacing: 0, color: '#101828' }}>
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
                  <span style={{ fontSize: 14, lineHeight: 1.75, color: '#667085' }}>{item.tip}</span>
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
              color: '#98a2b3',
            }}
          >
            快速导航
          </div>
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, letterSpacing: 0, color: '#101828' }}>
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
                  color: '#2563eb',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 650, color: '#101828' }}>{link.label}</span>
                <span style={{ fontSize: 12, color: '#667085', lineHeight: 1.4 }}>{link.desc}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
