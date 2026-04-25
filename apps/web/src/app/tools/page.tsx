import { TopNavigation } from '@/components/layout/TopNavigation'
import { ToolProviderStatusPanel } from '@/components/tools/ToolProviderStatusPanel'

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-[28px]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Tool Provider Catalog / API Matrix</div>
          <h1 className="mt-4 text-[38px] font-light tracking-[-0.05em] text-white">能力与接入状态</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/56">
            这里展示平台可调用、可桥接、模拟或待配置的 AI 工具。未配置 API 的工具不会被伪装为可用。
          </p>
        </section>

        <section className="mt-8">
          <ToolProviderStatusPanel />
        </section>
      </main>
    </div>
  )
}
