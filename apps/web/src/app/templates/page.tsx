import { TopNavigation } from '@/components/layout/TopNavigation'
import { PublicTemplateGallery } from '@/components/templates/PublicTemplateGallery'
import { PUBLIC_TEMPLATE_CATEGORIES } from '@/lib/templates/public-template-categories'
import { PUBLIC_TEMPLATE_COUNT } from '@/lib/templates/public-template-catalog'

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-6">
        <section className="border-b border-white/10 pb-8">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Templates</div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-light tracking-[-0.04em] text-white sm:text-5xl">公共模板库</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/56 sm:text-base">
                {PUBLIC_TEMPLATE_COUNT} 个 Creator City 内置结构模板，覆盖 {PUBLIC_TEMPLATE_CATEGORIES.length} 个常用创作分类。点击“使用模板”会进入 /create，并生成一个本地可编辑的创作起点。
              </p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-6 text-white/46">
              仅聚合模板结构、标题、流程和 prompt starter；封面为本地渐变占位。
            </div>
          </div>
        </section>

        <section className="mt-8">
          <PublicTemplateGallery />
        </section>

        <section className="mt-10 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-xs leading-6 text-white/42">
          <p>
            公共模板为 Creator City 内置的可编辑结构模板。外部来源仅作为创作参考，不复制第三方受版权保护素材。使用任何外部素材前，请确认授权。
          </p>
        </section>
      </main>
    </div>
  )
}
