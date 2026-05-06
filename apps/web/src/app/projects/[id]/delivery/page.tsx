import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loadProjectDelivery, requireProjectWriteAccess, serializeDeliveryShare } from '@/lib/delivery/service'
import {
  ProjectDeliveryClient,
  type DeliveryAssetForClient,
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
        />
      </main>
    </DashboardShell>
  )
}
