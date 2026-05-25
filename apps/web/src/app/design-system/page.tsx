// /design-system — Static design system reference page
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// Does NOT modify any existing component, style, or module.
import { DesignSystemPage } from '@/components/design-system/DesignSystemPage'

export const metadata = {
  title: '设计规范 | Creator City',
  description: '统一 Creator City 的暗色高级界面、状态表达、卡片比例和交互规范',
}

export default function Page() {
  return <DesignSystemPage />
}
