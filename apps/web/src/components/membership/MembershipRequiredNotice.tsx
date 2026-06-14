'use client'

interface MembershipRequiredNoticeProps {
  feature?: string
  className?: string
  isLoggedIn?: boolean
}

export function MembershipRequiredNotice({ feature, className, isLoggedIn = true }: MembershipRequiredNoticeProps) {
  if (!isLoggedIn) {
    return (
      <div className={className} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          请先登录后使用{feature ? `「${feature}」` : '该功能'}。
        </div>
        <a href="/login" style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)', color: 'rgba(167,139,250,0.9)', textDecoration: 'none' }}>
          登录
        </a>
      </div>
    )
  }

  return (
    <div className={className} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.05)' }}>
      <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.85)', marginBottom: 6, fontWeight: 500 }}>
        {feature ? `「${feature}」` : '该功能'}需要 Creator City 会员
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 10 }}>
        开通会员（¥100/月）后即可{feature ?? '使用此功能'}。
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href="/account/membership"
          style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)', color: 'rgba(167,139,250,0.95)', textDecoration: 'none', fontWeight: 500 }}
        >
          开通会员
        </a>
        <a
          href="/pricing"
          style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
        >
          查看权益
        </a>
      </div>
    </div>
  )
}
