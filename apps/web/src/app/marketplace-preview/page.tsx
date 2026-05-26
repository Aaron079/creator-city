// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import MarketplacePreviewPage from '@/components/marketplace-preview/MarketplacePreviewPage'

export const metadata = {
  title: '创作者市场预览 · Creator City',
  description: '创作者市场功能预览 — 连接品牌需求与 AI 创作能力，规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <MarketplacePreviewPage />
}
