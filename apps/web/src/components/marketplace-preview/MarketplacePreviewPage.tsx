// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  MARKETPLACE_HERO,
  MARKET_ROLES,
  SERVICE_CARDS,
  COMMISSION_FLOW,
  COMMISSION_MODEL,
  CREATOR_PROFILE_CAPABILITIES,
  MOCK_DEMAND_CARDS,
  TRUST_MECHANISMS,
  RISKS_AND_BOUNDARIES,
  ROADMAP_STAGES,
  QUICK_LINKS,
} from './marketplacePreviewData'

function Section({
  id,
  children,
  style,
}: {
  id?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section
      id={id}
      style={{ scrollMarginTop: '80px', marginBottom: '3.5rem', ...style }}
    >
      {children}
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#f4f4f5',
        marginBottom: '1.25rem',
        letterSpacing: '-0.01em',
        borderLeft: '3px solid #7c3aed',
        paddingLeft: '0.75rem',
      }}
    >
      {children}
    </h2>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
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

export default function MarketplacePreviewPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090b',
        color: '#a1a1aa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '0 0 5rem',
      }}
    >
      {/* Hero */}
      <Section id="hero" style={{ marginBottom: 0 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #18181b 0%, #1c1028 60%, #09090b 100%)',
            borderBottom: '1px solid #27272a',
            padding: '4rem 2rem 3rem',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {MARKETPLACE_HERO.statusChips.map((chip) => (
              <Chip key={chip.label} label={chip.label} color={chip.color} />
            ))}
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 30%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
              letterSpacing: '-0.03em',
            }}
          >
            {MARKETPLACE_HERO.title}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#52525b', marginBottom: '1rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {MARKETPLACE_HERO.subtitle}
          </p>
          <p
            style={{
              maxWidth: '560px',
              margin: '0 auto',
              fontSize: '0.9rem',
              color: '#71717a',
              lineHeight: 1.7,
            }}
          >
            {MARKETPLACE_HERO.description}
          </p>
        </div>
      </Section>

      {/* Main content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 0' }}>

        {/* Why creator market */}
        <Section id="why">
          <SectionTitle>为什么需要创作者市场</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {[
              { icon: '🎯', title: '精准匹配', desc: '需求方不再盲目外包，按类别、风格、预算精准找到对应创作者。' },
              { icon: '🤖', title: 'AI 原生创作', desc: '创作者使用 Creator City 工作台生成，交付质量与工具能力直接挂钩。' },
              { icon: '💸', title: '透明定价', desc: '服务标准化定价，避免信息不对称，需求方清楚每分钱买了什么。' },
              { icon: '🔐', title: '权益保障', desc: '托管支付 + 版权自动转移，双方权益均有平台机制兜底。' },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.35rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#71717a', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Market roles */}
        <Section id="roles">
          <SectionTitle>市场角色（6 种）</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {MARKET_ROLES.map((role) => (
              <div
                key={role.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  position: 'relative',
                }}
              >
                {role.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#a78bfa',
                      background: '#a78bfa18',
                      border: '1px solid #a78bfa40',
                      borderRadius: '9999px',
                      padding: '1px 7px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {role.badge}
                  </span>
                )}
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{role.icon}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.15rem' }}>{role.title}</div>
                <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>{role.titleEn}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6, marginBottom: '0.75rem' }}>{role.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {role.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontSize: '10px',
                        color: '#a1a1aa',
                        background: '#27272a',
                        borderRadius: '6px',
                        padding: '2px 7px',
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Service cards */}
        <Section id="services">
          <SectionTitle>服务类型预览（12 类）</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {SERVICE_CARDS.map((svc) => (
              <div
                key={svc.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#7c3aed', background: '#7c3aed18', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>
                    {svc.category}
                  </span>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>{svc.sellerLevel}</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', lineHeight: 1.4 }}>{svc.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5' }}>¥{svc.priceRmb.toLocaleString()}</span>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>{svc.deliveryDays}天交付</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>{svc.sellerName}</span>
                  <span style={{ fontSize: '11px', color: '#a16207' }}>★ {svc.rating} ({svc.reviewCount})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {svc.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: '9px', color: '#71717a', background: '#27272a', borderRadius: '4px', padding: '1px 6px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Commission flow */}
        <Section id="flow">
          <SectionTitle>委托流程（9 步）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {COMMISSION_FLOW.map((step, index) => (
              <div
                key={step.step}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                }}
              >
                <div
                  style={{
                    minWidth: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: index < 2 ? '#7c3aed20' : '#27272a',
                    border: `1px solid ${index < 2 ? '#7c3aed60' : '#3f3f46'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: index < 2 ? '#a78bfa' : '#71717a',
                    flexShrink: 0,
                  }}
                >
                  {step.step}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>
                    {step.icon} {step.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Platform 30% commission model */}
        <Section id="commission-model">
          <SectionTitle>平台佣金模式</SectionTitle>
          <div
            style={{
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '14px',
              padding: '1.5rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed' }}>{COMMISSION_MODEL.platformRate}%</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>平台服务费</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e' }}>{COMMISSION_MODEL.creatorRate}%</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>创作者到手</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e4e4e7' }}>{COMMISSION_MODEL.escrowDays}天</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>资金托管期</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e4e4e7' }}>{COMMISSION_MODEL.modificationLimit}次</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>免费修改次数</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e4e4e7' }}>{COMMISSION_MODEL.disputeWindowDays}天</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>争议保护期</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {COMMISSION_MODEL.features.map((f) => (
                <div key={f.label} style={{ background: '#09090b', borderRadius: '8px', padding: '0.75rem', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '0.3rem' }}>{f.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Creator profile capabilities */}
        <Section id="profile">
          <SectionTitle>创作者主页能力</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {CREATOR_PROFILE_CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{cap.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{cap.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.5 }}>{cap.description}</div>
              </div>
            ))}
          </div>
          {/* CTA — link to creator profile preview */}
          <Link
            href="/creator-profile-preview"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.875rem 1.25rem',
              background: '#1c1028',
              border: '1px solid #7c3aed40',
              borderRadius: '12px',
              textDecoration: 'none',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c4b5fd', marginBottom: '0.2rem' }}>
                查看创作者主页预览
              </div>
              <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>
                了解未来创作者如何展示作品集、服务套餐、技能标签与信任保障（预览页，示例数据）
              </div>
            </div>
            <span style={{ fontSize: '1rem', color: '#7c3aed', flexShrink: 0 }}>→</span>
          </Link>
        </Section>

        {/* Mock demand cards */}
        <Section id="demands">
          <SectionTitle>需求广场示例</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {MOCK_DEMAND_CARDS.map((demand) => (
              <div
                key={demand.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#7c3aed', background: '#7c3aed18', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>
                    {demand.category}
                  </span>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>{demand.postedAt}</span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e4e4e7', lineHeight: 1.4 }}>{demand.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{demand.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {demand.requirements.map((req) => (
                    <span key={req} style={{ fontSize: '10px', color: '#a1a1aa', background: '#27272a', borderRadius: '6px', padding: '2px 7px' }}>
                      {req}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem', borderTop: '1px solid #27272a' }}>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>{demand.clientName}</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5' }}>¥{demand.budgetRmb.toLocaleString()}</span>
                    <span style={{ fontSize: '10px', color: '#52525b' }}>{demand.deliveryDays}天内</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* CTA — link to demand board preview */}
          <Link
            href="/demand-board-preview"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.875rem 1.25rem',
              background: '#0f1a12',
              border: '1px solid #16a34a40',
              borderRadius: '12px',
              textDecoration: 'none',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#86efac', marginBottom: '0.2rem' }}>
                查看需求广场预览
              </div>
              <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>
                了解未来项目方如何发布结构化 Brief，创作者如何浏览预算、周期、角色后提交方案（预览页，Mock 数据）
              </div>
            </div>
            <span style={{ fontSize: '1rem', color: '#22c55e', flexShrink: 0 }}>→</span>
          </Link>
        </Section>

        {/* Trust & delivery */}
        <Section id="trust">
          <SectionTitle>信任与交付保障</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {TRUST_MECHANISMS.map((m) => (
              <div
                key={m.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  gap: '0.875rem',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{m.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{m.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Risks & boundaries */}
        <Section id="risks">
          <SectionTitle>风险与边界声明</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {RISKS_AND_BOUNDARIES.map((item) => (
              <div
                key={item.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderLeft: '3px solid #a16207',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ca8a04', marginBottom: '0.35rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.6 }}>{item.content}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Roadmap */}
        <Section id="roadmap">
          <SectionTitle>未来路线图（9 阶段）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ROADMAP_STAGES.map((stage) => {
              const statusColor =
                stage.status === 'done' ? '#22c55e' : stage.status === 'active' ? '#a78bfa' : '#52525b'
              const statusLabel =
                stage.status === 'done' ? '已完成' : stage.status === 'active' ? '进行中' : '规划中'
              return (
                <div
                  key={stage.stage}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    padding: '0.75rem 1rem',
                    background: '#18181b',
                    border: `1px solid ${stage.status === 'active' ? '#7c3aed40' : '#27272a'}`,
                    borderRadius: '10px',
                  }}
                >
                  <div
                    style={{
                      minWidth: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: `${statusColor}20`,
                      border: `1px solid ${statusColor}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: statusColor,
                      flexShrink: 0,
                    }}
                  >
                    {stage.stage}
                  </div>
                  <div style={{ flex: 1, fontSize: '0.83rem', color: stage.status === 'planned' ? '#71717a' : '#d4d4d8', fontWeight: stage.status === 'active' ? 600 : 400 }}>
                    {stage.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#52525b', whiteSpace: 'nowrap' }}>{stage.quarter}</div>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      color: statusColor,
                      background: `${statusColor}15`,
                      border: `1px solid ${statusColor}35`,
                      borderRadius: '9999px',
                      padding: '1px 7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Quick links */}
        <Section id="quick-links">
          <SectionTitle>快速链接</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'block',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>{link.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>{link.description}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Footer note */}
        <div
          style={{
            borderTop: '1px solid #27272a',
            paddingTop: '1.5rem',
            textAlign: 'center',
            fontSize: '11px',
            color: '#3f3f46',
          }}
        >
          /marketplace-preview · 本页面为静态预览，所有数据为示例，不代表真实服务 · 不支持真实交易
        </div>
      </div>
    </div>
  )
}
