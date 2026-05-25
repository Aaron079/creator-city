// /marketplace — Creator Marketplace 创作者市场
// Read-only page. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static mock data only.
import { MarketplaceCenter } from '@/components/marketplace/MarketplaceCenter'

export const metadata = {
  title: '创作者市场 | Creator City',
  description: '连接项目需求、专业创作者和 AI 影视生产服务的交易入口',
}

export default function MarketplacePage() {
  return <MarketplaceCenter />
}
