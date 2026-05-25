// /roadmap — Static product roadmap
// Read-only placeholder. Does NOT call any generation API, canvas API, or DB directly.
// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
import { RoadmapPage } from '@/components/roadmap/RoadmapPage'

export const metadata = {
  title: '产品路线图 | Creator City',
  description: '从稳定生成链路到城市化创作平台、社区、市场与企业部署的阶段规划',
}

export default function Page() {
  return <RoadmapPage />
}
