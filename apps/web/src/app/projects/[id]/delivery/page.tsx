import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loadProjectDelivery, requireProjectWriteAccess, serializeDeliveryShare } from '@/lib/delivery/service'
import { isPlaceholderProjectId } from '@/lib/routing/placeholders'
import {
  ProjectDeliveryClient,
  type DeliveryAssetForClient,
  type DeliveryCanvasNodeForClient,
  type DeliveryShareForClient,
} from './ProjectDeliveryClient'

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string }
}

function asClientJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T
}

export default async function ProjectDeliveryPage({ params }: Props) {
  const projectId = params.id
  if (isPlaceholderProjectId(projectId)) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
            <h1 className="text-xl font-semibold text-white">这是示例地址，不是真实项目。</h1>
            <p className="mt-3 text-sm leading-6 text-white/55">请从项目列表选择一个项目。</p>
            <a href="/projects" className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100">
              返回项目列表
            </a>
          </section>
        </main>
      </DashboardShell>
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return (
      <DashboardShell>
        <div className="p-8 text-sm text-red-400">请先登录后管理交付。</div>
      </DashboardShell>
    )
  }

  const project = await requireProjectWriteAccess(projectId, user.id)
  if (!project || project === 'FORBIDDEN') {
    return (
      <DashboardShell>
        <div className="p-8 text-sm text-red-400">{project ? '无权访问该项目。' : '项目不存在。'}</div>
      </DashboardShell>
    )
  }

  const delivery = await loadProjectDelivery(projectId)

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">客户交付</h1>
            <p className="mt-2 text-sm text-white/50">{project.title}</p>
          </div>
          <a href={`/projects/${projectId}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white">
            返回项目
          </a>
        </div>

        <ProjectDeliveryClient
          projectId={projectId}
          projectTitle={project.title}
          initialShare={delivery.share ? asClientJson(serializeDeliveryShare(delivery.share)) as unknown as DeliveryShareForClient : null}
          assets={asClientJson(delivery.assets) as unknown as DeliveryAssetForClient[]}
          canvasNodes={asClientJson(delivery.canvasNodes) as unknown as DeliveryCanvasNodeForClient[]}
        />
      </main>
    </DashboardShell>
  )
}
