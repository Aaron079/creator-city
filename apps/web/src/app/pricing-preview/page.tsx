// /pricing-preview — Static commercial model preview page
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// Does NOT modify any existing component, style, or module.
import { PricingPreviewPage } from '@/components/pricing-preview/PricingPreviewPage'

export const metadata = {
  title: '商业模式预览 | Creator City',
  description: '平台订阅、创作者市场抽佣、企业部署与 API 自付费模式的未来规划',
}

export default function Page() {
  return <PricingPreviewPage />
}
