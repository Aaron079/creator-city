import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getAssetContentText } from '@/lib/delivery/service'

export const dynamic = 'force-dynamic'

function assetTypeLabel(type: string) {
  if (type === 'IMAGE') return '图片'
  if (type === 'VIDEO') return '视频'
  if (type === 'AUDIO') return '音频'
  if (type === 'SCRIPT') return '文本'
  return '文档'
}

export default async function AssetsPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <DashboardShell>
        <div className="p-8 text-sm text-red-400">请先登录后查看素材。</div>
      </DashboardShell>
    )
  }

  const assets = await db.asset.findMany({
    where: { ownerId: user.id },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">素材库</h1>
            <p className="mt-2 text-sm text-white/50">自动保存的生成结果，可加入项目交付链接。</p>
          </div>
          <a href="/create" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100">
            去生成
          </a>
        </div>

        {assets.length === 0 ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-base font-semibold text-white">还没有素材</h2>
            <p className="mt-2 text-sm text-white/45">生成文本或图片后，成功结果会自动进入素材库。</p>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const contentText = getAssetContentText(asset)
              return (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {asset.type === 'IMAGE' && asset.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.title ?? asset.name} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-white/[0.04] px-5 text-sm leading-6 text-white/55">
                      <p className="line-clamp-6 whitespace-pre-wrap">{contentText ?? asset.name}</p>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200">{assetTypeLabel(asset.type)}</span>
                      <span className="text-xs text-white/35">{new Date(asset.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <h2 className="line-clamp-2 text-sm font-semibold text-white">{asset.title ?? asset.name}</h2>
                    <p className="mt-2 text-xs text-white/40">
                      {asset.project ? `项目：${asset.project.title}` : '未关联项目'}
                    </p>
                    {asset.providerId && (
                      <p className="mt-1 text-xs text-white/25">Provider: {asset.providerId}</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </DashboardShell>
  )
}
