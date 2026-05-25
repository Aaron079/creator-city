// /help — Diagnostics Help Center
// Read-only page. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static diagnostic data only.
import { DiagnosticsCenter } from '@/components/help/DiagnosticsCenter'

export const metadata = {
  title: '诊断帮助中心 | Creator City',
  description: '快速定位图片、视频、资产、任务、登录与部署问题',
}

export default function HelpPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', color: '#fff' }}>
      <DiagnosticsCenter />
    </div>
  )
}
