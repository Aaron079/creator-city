// /local-deploy-preview — Static local deployment preview page
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. No real downloads. No real deployment commands.
// Static data only. Not connected to navigation.
// Does NOT modify any existing component, style, or module.
import { LocalDeployPreviewPage } from '@/components/local-deploy-preview/LocalDeployPreviewPage'

export const metadata = {
  title: '本地部署预览 | Creator City',
  description: '面向专业创作者、工作室和企业的本地运行、私有数据与离线创作规划',
}

export default function Page() {
  return <LocalDeployPreviewPage />
}
