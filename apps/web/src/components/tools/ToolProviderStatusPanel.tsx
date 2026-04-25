'use client'

import { useMemo, useState } from 'react'
import { ProviderCategoryRail } from '@/components/tools/ProviderCategoryRail'
import { ProviderStatusBadge, STATUS_META } from '@/components/tools/ProviderStatusBadge'
import {
  getProviderTestLabel,
  getToolProviderGroups,
  getToolProviderStatusCounts,
  type ToolProvider,
  type ToolProviderStatus,
} from '@/lib/tools/provider-status'

function joinList(items: string[]) {
  return items.join(' / ')
}

function getFeedback(provider: ToolProvider) {
  if (provider.status === 'mock') return `${provider.displayName}：模拟测试，不会调用第三方 API。`
  if (provider.status === 'bridge-only') return `${provider.displayName}：当前仅展示桥接格式，不会真实调用。`
  if (provider.status === 'available' && provider.testMode === 'real') return `${provider.displayName}：可进入真实测试入口。`
  if (provider.status === 'coming-soon') return `${provider.displayName}：即将支持，当前不可测试。`
  if (provider.status === 'not-configured') return `${provider.displayName}：未配置 API key、endpoint 或 adapter。`
  return `${provider.displayName}：当前不可测试。`
}

export function ToolProviderStatusPanel() {
  const groups = getToolProviderGroups()
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id ?? 'image-to-video')
  const [feedback, setFeedback] = useState('未配置 API 的工具不会被伪装为可用。')

  const providers = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  )
  const summary = useMemo(
    () => getToolProviderStatusCounts(providers),
    [providers],
  )
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0]

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-[28px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Provider Catalog / API Matrix v1</div>
          <h2 className="mt-3 text-[26px] font-light tracking-[-0.03em] text-white">工具 / API 状态中心</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
            这里展示平台可调用、可桥接、模拟或待配置的 AI 工具。未配置 API 的工具不会被伪装为可用。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as ToolProviderStatus[]).map((status) => (
            <ProviderStatusBadge key={status} status={status} />
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-white/8 bg-black/20 px-4 py-3 text-xs leading-6 text-white/56">
        <span className="text-white/34">当前反馈：</span>
        {feedback}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">total providers</div>
          <div className="mt-2 text-xl font-light text-white">{providers.length}</div>
        </div>
        {(Object.entries(summary) as Array<[ToolProviderStatus, number]>).map(([status, value]) => (
          <div key={status} className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">{status}</div>
            <div className="mt-2 text-xl font-light text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ProviderCategoryRail groups={groups} activeId={activeGroup?.id ?? activeGroupId} onSelect={setActiveGroupId} />
      </div>

      {activeGroup ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-light tracking-[-0.03em] text-white">{activeGroup.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/48">{activeGroup.description}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/42">
              {activeGroup.entries.length} providers
            </span>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {activeGroup.entries.map((provider) => {
              const disabled = provider.status === 'not-configured' || provider.status === 'coming-soon' || provider.status === 'error'
              return (
                <article
                  key={provider.id}
                  className="rounded-[20px] border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-medium text-white">{provider.displayName}</h4>
                        {provider.versionLabel ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/46">
                            {provider.versionLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/32">
                        {provider.category} · {provider.providerType}
                      </div>
                    </div>
                    <ProviderStatusBadge status={provider.status} />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/56">{provider.description}</p>

                  {provider.aliases?.length ? (
                    <div className="mt-3 text-xs leading-6 text-white/42">
                      <span className="text-white/30">aliases：</span>
                      {joinList(provider.aliases)}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 text-xs leading-6 text-white/48 sm:grid-cols-2">
                    <div>
                      <span className="text-white/30">inputs：</span>
                      {joinList(provider.supportedInputs)}
                    </div>
                    <div>
                      <span className="text-white/30">outputs：</span>
                      {joinList(provider.supportedOutputs)}
                    </div>
                    <div>
                      <span className="text-white/30">recommendedFor：</span>
                      {joinList(provider.recommendedFor)}
                    </div>
                    <div>
                      <span className="text-white/30">useCases：</span>
                      {joinList(provider.useCases)}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2 text-xs leading-6 text-white/48">
                    <span className="text-white/30">setupHint：</span>
                    {provider.setupHint}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setFeedback(getFeedback(provider))}
                      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs transition ${
                        disabled
                          ? 'cursor-not-allowed border-white/8 bg-white/[0.025] text-white/34'
                          : 'border-white/10 bg-white/[0.05] text-white/78 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {getProviderTestLabel(provider)}
                    </button>

                    <code className="max-w-full truncate text-[10px] text-white/34">
                      {provider.sourcePath}
                    </code>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}
    </section>
  )
}
