// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import MilestoneDeliveryPreviewPage from '@/components/milestone-delivery-preview/MilestoneDeliveryPreviewPage'

export const metadata = {
  title: '阶段交付与验收预览 · Creator City',
  description: '创作者阶段交付与甲方验收流程功能预览 — 把创意项目拆解为可追踪、可验收、可付款的里程碑节点。规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <MilestoneDeliveryPreviewPage />
}
