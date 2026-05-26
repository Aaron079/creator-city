// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import ProposalFlowPreviewPage from '@/components/proposal-flow-preview/ProposalFlowPreviewPage'

export const metadata = {
  title: '报价与方案流程预览 · Creator City',
  description: '创作者报价与方案流程功能预览 — 把创意需求转化为可比较、可协作、可交付的专业方案。规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <ProposalFlowPreviewPage />
}
