// /settings — 设置中心占位页
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// Full settings features will be added incrementally.
import Link from 'next/link'
import { TopNavigation } from '@/components/layout/TopNavigation'

export const metadata = {
  title: '设置中心 | Creator City',
  description: '账号设置、偏好配置与团队管理',
}

const SETTING_SECTIONS = [
  {
    title: '账号设置',
    desc: '用户名、邮箱、密码与登录方式',
    href: '/account',
    available: true,
    cta: '前往账号设置',
  },
  {
    title: '偏好配置',
    desc: '界面语言、主题、通知与默认工作流',
    href: null,
    available: false,
    cta: '即将开放',
  },
  {
    title: '团队与协作',
    desc: '管理团队成员、角色权限与邀请链接',
    href: null,
    available: false,
    cta: '即将开放',
  },
  {
    title: '计费与额度',
    desc: '查看生成额度、充值记录与套餐信息',
    href: '/account/credits',
    available: true,
    cta: '查看计费',
  },
  {
    title: 'API 中心',
    desc: '配置模型 Provider、API Key 与生成参数',
    href: '/providers',
    available: true,
    cta: '前往 API 中心',
  },
  {
    title: '安全与会话',
    desc: '活跃设备、会话管理与登录历史',
    href: null,
    available: false,
    cta: '即将开放',
  },
]

const QUICK_LINKS = [
  { label: '工作台', href: '/dashboard' },
  { label: '创作者市场', href: '/marketplace' },
  { label: '诊断帮助', href: '/help' },
  { label: '生成任务', href: '/tasks' },
]

export default function SettingsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <TopNavigation />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px 80px' }}>

        {/* Hero */}
        <section
          style={{
            borderRadius: 34,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            padding: '32px',
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)' }}>
            Settings
          </div>
          <h1 style={{ marginTop: 14, fontSize: 34, fontWeight: 300, letterSpacing: '-0.05em', color: '#fff' }}>
            设置中心
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.52)', maxWidth: 520 }}>
            账号管理、偏好配置与团队入口。部分功能即将开放，当前可用入口已标注。
          </p>
          <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 99,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '6px 14px',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.72)',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Settings sections */}
        <section
          style={{
            borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.025)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', marginBottom: 20 }}>
            功能入口
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {SETTING_SECTIONS.map((section, i) => (
              <div
                key={section.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom: i < SETTING_SECTIONS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 400, color: section.available ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                    {section.title}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
                    {section.desc}
                  </div>
                </div>
                {section.available && section.href ? (
                  <Link
                    href={section.href}
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '7px 14px',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.80)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {section.cta}
                  </Link>
                ) : (
                  <span
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 99,
                      border: '1px solid rgba(255,255,255,0.07)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.28)',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      cursor: 'not-allowed',
                    }}
                  >
                    即将开放
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.24)' }}>
          设置中心持续迭代 · 如需帮助请前往{' '}
          <Link href="/help" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
            诊断帮助
          </Link>
        </div>

      </main>
    </div>
  )
}
