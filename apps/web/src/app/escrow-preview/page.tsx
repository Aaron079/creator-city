// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import EscrowPreviewPage from '@/components/escrow-preview/EscrowPreviewPage'

export const metadata = {
  title: '托管与结算预览 · Creator City',
  description: 'Creator City 托管与结算规则预览 — 让创作交易从报价、托管、阶段验收到最终结算都可解释、可确认、可追溯。规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <EscrowPreviewPage />
}
