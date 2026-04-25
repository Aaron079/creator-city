import Link from 'next/link'
import type { HomeFeatureEntry } from '@/lib/home/content'

interface FeatureGridProps {
  items: HomeFeatureEntry[]
}

export function FeatureGrid({ items }: FeatureGridProps) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Feature Entry</div>
          <h2 className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">从这里进入不同创作任务</h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-white/50">
          首页先帮你分辨当前任务是项目管理、模板挑选、灵感探索还是直接进入自由画布，而不是把所有能力都塞进一个界面。
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-[24px] transition hover:border-white/18 hover:bg-white/[0.05]"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/34">{item.eyebrow}</div>
            <h3 className="mt-3 text-lg font-light tracking-[-0.03em] text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-white/54">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
