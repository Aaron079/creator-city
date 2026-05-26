// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import DemandBoardPreviewPage from '@/components/demand-board-preview/DemandBoardPreviewPage'

export const metadata = {
  title: '需求广场预览 · Creator City',
  description: '创作者需求广场功能预览 — 品牌方发布结构化创作需求，创作者按类型、预算、周期筛选项目。规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <DemandBoardPreviewPage />
}
