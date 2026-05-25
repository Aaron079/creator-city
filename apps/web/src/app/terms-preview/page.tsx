// /terms-preview — Static terms and copyright rules preview page
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// Does NOT constitute formal legal advice or a binding agreement.
// Does NOT modify any existing component, style, or module.
import { TermsPreviewPage } from '@/components/terms-preview/TermsPreviewPage'

export const metadata = {
  title: '协议与版权规则预览 | Creator City',
  description: '为 AI 影视创作、素材上传、社区协作和创作者交易提前建立清晰边界',
}

export default function Page() {
  return <TermsPreviewPage />
}
