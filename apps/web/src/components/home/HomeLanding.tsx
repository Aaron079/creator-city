import Link from 'next/link'
import { ContentCard } from '@/components/home/ContentCard'
import { ContentRails } from '@/components/home/ContentRail'
import { FeaturedCarousel } from '@/components/home/FeaturedCarousel'
import { FeatureGrid } from '@/components/home/FeatureGrid'
import {
  HOME_CONTENT_RAILS,
  HOME_FEATURED_ITEMS,
  HOME_FEATURE_ENTRIES,
  HOME_RECOMMENDATIONS,
} from '@/lib/home/content'

const PORTAL_LINKS = [
  { href: '/create', label: '进入 AI 画布', hint: '自由创作、节点生成和素材推进。' },
  { href: '/templates', label: '模板库', hint: '从广告片、短片、Vlog 等流程开始。' },
  { href: '/projects', label: '工作空间 / 项目', hint: '管理项目、团队、审批和交付。' },
  { href: '/explore', label: '探索', hint: '发现创作者、案例和灵感。' },
  { href: '/community', label: '社群', hint: '查看动态、讨论和创作者内容。' },
  { href: '/tools', label: '工具 / API', hint: '查看工具、模型、API 的真实状态。' },
  { href: '/me', label: '我的', hint: '个人工作台、邀请和待办。' },
]

export function HomeLanding() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-[28px] md:p-9">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(118,160,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,164,92,0.08),transparent_28%)]" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/42">
              Creator City Platform
            </div>
            <h1 className="mt-5 text-3xl font-light tracking-[-0.05em] text-white md:text-5xl">
              AI 影视创作工作台
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
              从灵感、画面、视频、声音到审片与交付，用一个协作平台完成。
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/create"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:scale-[1.01]"
              >
                进入 AI 画布
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
              >
                查看项目
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/20 hover:text-white"
              >
                探索创作者
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              '画布只负责自由创作，模板、社区、工具和项目在独立页面各自展开。',
              '首页先给你精选内容、推荐模板和内容流，而不是一上来就塞进复杂流程图。',
              'Tools / API 页面明确标注 available、mock、bridge-only 和 not-configured。',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-white/8 bg-black/20 p-5"
              >
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/32">产品结构</div>
                <div className="mt-3 text-[13px] leading-6 text-white/64">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <FeaturedCarousel items={HOME_FEATURED_ITEMS} />
      </section>

      <FeatureGrid items={HOME_FEATURE_ENTRIES} />

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Portal</div>
            <h2 className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">平台入口</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/50">
            首页只做门户和内容分发；创作画布、模板、项目、社区和工具状态各自进入独立页面。
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PORTAL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[24px] border border-white/8 bg-white/[0.035] p-5 transition hover:border-white/18 hover:bg-white/[0.055]"
            >
              <div className="text-sm font-medium text-white">{item.label}</div>
              <div className="mt-3 text-xs leading-6 text-white/46">{item.hint}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">For You</div>
            <h2 className="mt-3 text-2xl font-light tracking-[-0.04em] text-white">为你推荐</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/50">
            首页用内容流把项目、案例、模板和教程混合呈现，让用户先理解平台里有什么，再决定去哪里创作。
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {HOME_RECOMMENDATIONS.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <ContentRails rails={HOME_CONTENT_RAILS} />
    </main>
  )
}
