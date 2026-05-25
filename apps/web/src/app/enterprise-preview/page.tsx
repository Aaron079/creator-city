// /enterprise-preview — Static enterprise version preview page
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. No payment, no orders, no enterprise account creation.
// Static data only. Not connected to navigation.
// Does NOT modify any existing component, style, or module.
import { EnterprisePreviewPage } from '@/components/enterprise-preview/EnterprisePreviewPage'

export const metadata = {
  title: '企业版预览 | Creator City',
  description: '面向影视公司、广告公司、MCN、品牌内容团队和短剧工作室的专业 AI 影视生产平台方案',
}

export default function Page() {
  return <EnterprisePreviewPage />
}
