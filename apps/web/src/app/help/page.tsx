// /help — Diagnostics Help Center
// Read-only page. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static diagnostic data only.
import Link from 'next/link'
import { DiagnosticsCenter } from '@/components/help/DiagnosticsCenter'

export const metadata = {
  title: '诊断帮助中心 | Creator City',
  description: '快速定位图片、视频、资产、任务、登录与部署问题',
}

export default function HelpPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', color: '#fff' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
          >
            ← 返回首页
          </Link>
          <Link
            href="/help/api-keys"
            className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
          >
            API Key 接入指南
          </Link>
        </div>
      </div>
      <DiagnosticsCenter />
    </div>
  )
}
