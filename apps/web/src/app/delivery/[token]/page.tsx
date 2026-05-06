import { DeliveryFeedbackForm, type DeliveryCommentForDisplay } from './DeliveryFeedbackForm'
import { DeliveryItemImage } from './DeliveryItemImage'
import { getPublicDelivery } from '@/lib/delivery/service'

export const dynamic = 'force-dynamic'

type Props = {
  params: { token: string }
}

function typeLabel(type: string) {
  if (type === 'image') return '图片'
  if (type === 'video') return '视频'
  if (type === 'audio') return '音频'
  if (type === 'file') return '文件'
  return '文本'
}

function getItemUrl(item: {
  url: string | null
  asset?: { url: string | null; dataUrl: string | null } | null
}) {
  return item.url || item.asset?.url || item.asset?.dataUrl || ''
}

export default async function PublicDeliveryPage({ params }: Props) {
  const share = await getPublicDelivery(params.token)
  if (!share || share === 'DISABLED' || share === 'EXPIRED') {
    const message = !share ? '交付链接不存在。' : share === 'DISABLED' ? '交付链接已停用。' : '交付链接已过期。'
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="text-xl font-semibold">无法查看交付</h1>
          <p className="mt-3 text-sm text-white/55">{message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-sm text-cyan-200">Creator City Delivery</p>
          <h1 className="mt-2 text-3xl font-semibold">{share.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">{share.project.description || share.project.title}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {share.items.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/45">
              当前交付还没有添加内容。
            </div>
          ) : (
            share.items.map((item) => {
              const itemUrl = getItemUrl(item)
              return (
                <article key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-base font-semibold">{item.title || '未命名交付项'}</h2>
                      <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200">{typeLabel(item.type)}</span>
                    </div>
                  </div>
                  {item.type === 'image' ? (
                    itemUrl ? <DeliveryItemImage src={itemUrl} alt={item.title ?? 'Delivery image'} /> : (
                      <div className="flex min-h-56 items-center justify-center bg-black/40 p-6 text-sm text-white/45">图片无法加载</div>
                    )
                  ) : item.type === 'text' ? (
                    <div className="p-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">{item.contentText || '暂无文本内容。'}</p>
                    </div>
                  ) : itemUrl ? (
                    <a href={itemUrl} className="block p-5 text-sm font-semibold text-cyan-200 underline" target="_blank" rel="noreferrer">打开交付文件</a>
                  ) : (
                    <div className="p-5 text-sm text-white/45">暂无可预览内容。</div>
                  )}
                </article>
              )
            })
          )}
        </section>

        <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold">提交反馈</h2>
          <p className="mt-1 text-sm text-white/45">可以评论、标记通过或要求修改。</p>
          <div className="mt-4">
            <DeliveryFeedbackForm
            token={params.token}
            items={share.items.map((item) => ({ id: item.id, title: item.title }))}
            initialComments={share.comments.map((c): DeliveryCommentForDisplay => ({
              id: c.id,
              itemId: c.itemId ?? null,
              authorName: c.authorName ?? null,
              authorEmail: c.authorEmail ?? null,
              body: c.body,
              status: c.status,
              createdAt: c.createdAt.toISOString(),
              item: c.item ?? null,
            }))}
          />
          </div>
        </aside>
      </div>
    </main>
  )
}
