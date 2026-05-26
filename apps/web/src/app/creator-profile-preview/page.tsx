// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import CreatorProfilePreviewPage from '@/components/creator-profile-preview/CreatorProfilePreviewPage'

export const metadata = {
  title: '创作者主页预览 · Creator City',
  description: '创作者主页功能预览 — 展示创作者档案、作品集、服务套餐与客户评价，规划中，尚未上线。',
  robots: 'noindex',
}

export default function Page() {
  return <CreatorProfilePreviewPage />
}
