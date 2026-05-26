// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import Link from 'next/link'
import {
  PROFILE_HERO,
  PROFILE_STATS,
  SKILL_TAGS,
  PORTFOLIO_ITEMS,
  SERVICE_OFFERINGS,
  REVIEWS,
  WORKFLOW_STEPS,
  TRUST_BADGES,
  QUICK_LINKS,
} from './creatorProfilePreviewData'

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
    <section id={id} style={{ scrollMarginTop: '80px', marginBottom: '3.5rem', ...style }}>
      {children}
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '1.15rem',
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

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#a16207', fontSize: '13px', letterSpacing: '1px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
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
        padding: '0 0 5rem',
      }}
    >
      {/* Hero — creator profile header */}
      <Section id="hero" style={{ marginBottom: 0 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #18181b 0%, #1c1028 60%, #09090b 100%)',
            borderBottom: '1px solid #27272a',
            padding: '3.5rem 2rem 2.5rem',
          }}
        >
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            {/* Status chips */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {PROFILE_HERO.statusChips.map((chip) => (
                <Chip key={chip.label} label={chip.label} color={chip.color} />
              ))}
            </div>

            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: `${PROFILE_HERO.avatarColor}20`,
                  border: `2px solid ${PROFILE_HERO.avatarColor}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: PROFILE_HERO.avatarColor,
                  flexShrink: 0,
                }}
              >
                {PROFILE_HERO.avatarInitials}
              </div>

              {/* Name block */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                  <h1
                    style={{
                      fontSize: '1.6rem',
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
                <div style={{ fontSize: '12px', color: '#52525b', marginBottom: '0.6rem' }}>
                  {PROFILE_HERO.handle} · {PROFILE_HERO.location} · 加入于 {PROFILE_HERO.joinedAt}
                </div>
                <div style={{ fontSize: '13px', color: '#71717a', fontWeight: 500, marginBottom: '0.75rem' }}>
                  {PROFILE_HERO.tagline}
                </div>
                <p style={{ fontSize: '0.83rem', color: '#71717a', lineHeight: 1.65, maxWidth: '560px', margin: 0 }}>
                  {PROFILE_HERO.bio}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Main content */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '3rem 1.5rem 0' }}>

        {/* Stats */}
        <Section id="stats">
          <SectionTitle>创作者数据</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {PROFILE_STATS.map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f4f4f5', marginBottom: '0.15rem' }}>
                  {stat.value}
                </div>
                {stat.sub && (
                  <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '0.15rem' }}>{stat.sub}</div>
                )}
                <div style={{ fontSize: '11px', color: '#71717a' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section id="skills">
          <SectionTitle>技能标签</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {SKILL_TAGS.map((tag) => {
              const color =
                tag.category === 'creation' ? '#7c3aed' :
                tag.category === 'tool' ? '#0e7490' :
                '#a16207'
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
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {(['creation', 'tool', 'style'] as const).map((cat) => {
              const color = cat === 'creation' ? '#7c3aed' : cat === 'tool' ? '#0e7490' : '#a16207'
              const label = cat === 'creation' ? '创作方向' : cat === 'tool' ? '工具' : '风格'
              return (
                <span key={cat} style={{ fontSize: '10px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                  {label}
                </span>
              )
            })}
          </div>
        </Section>

        {/* Portfolio */}
        <Section id="portfolio">
          <SectionTitle>作品集（6 项）</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {PORTFOLIO_ITEMS.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '14px',
                  overflow: 'hidden',
                }}
              >
                {/* Placeholder for video thumbnail */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1c1028 0%, #18181b 100%)',
                    aspectRatio: item.aspectRatio.replace(':', '/'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #27272a',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '2rem', opacity: 0.3 }}>🎬</span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '10px', color: '#7c3aed', background: '#7c3aed18', borderRadius: '6px', padding: '1px 7px', fontWeight: 600 }}>
                      {item.category}
                    </span>
                    <span style={{ fontSize: '10px', color: '#52525b' }}>{item.deliveredAt}</span>
                  </div>
                  <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.35rem', lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                    {item.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {item.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: '9px', color: '#71717a', background: '#27272a', borderRadius: '4px', padding: '1px 6px' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Services */}
        <Section id="services">
          <SectionTitle>服务套餐</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {SERVICE_OFFERINGS.map((svc) => (
              <div
                key={svc.id}
                style={{
                  background: '#18181b',
                  border: `1px solid ${svc.popular ? '#7c3aed50' : '#27272a'}`,
                  borderRadius: '14px',
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
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.35rem' }}>{svc.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55, marginBottom: '0.75rem' }}>{svc.description}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5' }}>¥{svc.priceRmb.toLocaleString()}</span>
                  <span style={{ fontSize: '11px', color: '#52525b' }}>{svc.deliveryDays} 天交付</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {svc.includes.map((item) => (
                    <div key={item} style={{ fontSize: '11px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#22c55e', fontSize: '10px' }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Reviews */}
        <Section id="reviews">
          <SectionTitle>客户评价（{REVIEWS.length} 条）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {REVIEWS.map((review) => (
              <div
                key={review.id}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7' }}>{review.clientName}</span>
                    <span style={{ fontSize: '10px', color: '#52525b', marginLeft: '0.5rem' }}>· {review.clientIndustry}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Stars rating={review.rating} />
                    <span style={{ fontSize: '10px', color: '#52525b' }}>{review.deliveredAt}</span>
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#52525b', marginBottom: '0.4rem' }}>项目：{review.projectTitle}</div>
                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, fontStyle: 'italic' }}>
                  &ldquo;{review.comment}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Workflow */}
        <Section id="workflow">
          <SectionTitle>创作工作流</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.step}
                style={{
                  display: 'flex',
                  gap: '0.875rem',
                  alignItems: 'flex-start',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                }}
              >
                <div
                  style={{
                    minWidth: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#7c3aed20',
                    border: '1px solid #7c3aed50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#a78bfa',
                    flexShrink: 0,
                  }}
                >
                  {step.step}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.2rem' }}>
                    {step.icon} {step.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.55 }}>{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Trust */}
        <Section id="trust">
          <SectionTitle>信任保障</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.875rem' }}>
            {TRUST_BADGES.map((badge) => (
              <div
                key={badge.title}
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{badge.icon}</div>
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{badge.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>{badge.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Quick links */}
        <Section id="quick-links">
          <SectionTitle>快速链接</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem' }}>
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
          /creator-profile-preview · 本页面为静态预览，所有数据为示例，不代表真实创作者 · 不支持真实交易
        </div>
      </div>
    </div>
  )
}
