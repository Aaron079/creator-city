'use client'

import type { DeliveryAsset, DeliveryPackage } from '@/store/delivery-package.store'
import { DELIVERY_ASSET_SECTIONS, groupDeliveryAssets } from '@/lib/delivery/aggregate'

interface DeliveryTabProps {
  projectTitle: string
  currentStage: string
  deliveryPackage: DeliveryPackage | null
  canSubmit: boolean
  onCreatePackage: () => void
  onToggleAssetIncluded: (assetId: string) => void
  onPreviewAsset: (asset: DeliveryAsset) => void
  onViewVersion: (asset: DeliveryAsset) => void
  onViewApproval: (asset: DeliveryAsset) => void
  onExportSummary: () => void
  onExportManifest: () => void
  onExportProjectData: () => void
  onSubmitPackage: () => void
}

const STATUS_META: Record<DeliveryPackage['status'], { label: string; color: string }> = {
  draft: { label: '草稿', color: '#94a3b8' },
  ready: { label: '就绪', color: '#22c55e' },
  submitted: { label: '已提交', color: '#60a5fa' },
  approved: { label: '已批准', color: '#34d399' },
  'needs-revision': { label: '需修改', color: '#f59e0b' },
}

export function DeliveryTab(props: DeliveryTabProps) {
  const groupedAssets = props.deliveryPackage ? groupDeliveryAssets(props.deliveryPackage.assets) : DELIVERY_ASSET_SECTIONS.map((section) => ({ ...section, assets: [] }))
  const statusMeta = props.deliveryPackage ? STATUS_META[props.deliveryPackage.status] : STATUS_META.draft
  const riskIssues = props.deliveryPackage?.riskSummary?.issues ?? []
  const includedCount = props.deliveryPackage?.assets.filter((asset) => asset.included).length ?? 0

  if (!props.deliveryPackage) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Delivery Package</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{props.projectTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            交付包是商业交付依据。你来决定纳入哪些资产，AI 只负责提示缺失项和风险，不会自动替你提交。
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={props.onCreatePackage}
              className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
            >
              创建交付包
            </button>
            <span className="text-xs text-white/45">创建后会自动从当前工作区聚合分镜、镜头、剪辑、声音、确认与版本信息。</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Delivery Package</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{props.projectTitle}</h2>
              <p className="mt-2 text-sm text-white/60">当前阶段 {props.currentStage} · 已纳入 {includedCount} 项交付资产</p>
            </div>
            <div className="rounded-2xl border border-white/10 px-4 py-3">
              <p className="text-[11px] text-white/45">交付包状态</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</p>
              <p className="mt-1 text-[11px] text-white/45">{props.canSubmit ? '当前可提交客户确认' : '需要先纳入至少一项资产'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">交付清单</h3>
              <p className="mt-1 text-sm text-white/55">按交付类型整理当前可纳入资产。你可以逐项加入或移出，不会自动提交。</p>
            </div>
          </div>
          <div className="mt-5 space-y-5">
            {groupedAssets.map((section) => (
              <div key={section.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">{section.label}</h4>
                  <span className="text-xs text-white/45">{section.assets.length} 项</span>
                </div>
                {section.assets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/40">
                    当前还没有可用的 {section.label} 资产。
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {section.assets.map((asset) => (
                      <article key={asset.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-white">{asset.title}</h5>
                            <p className="mt-1 text-xs text-white/45">{asset.type}</p>
                            {asset.description ? <p className="mt-2 text-sm text-white/65">{asset.description}</p> : null}
                          </div>
                          <span
                            className="rounded-full px-2 py-1 text-[10px] font-semibold"
                            style={{
                              background: asset.included ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.06)',
                              color: asset.included ? '#c7d2fe' : 'rgba(255,255,255,0.55)',
                            }}
                          >
                            {asset.included ? '已纳入' : '未纳入'}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs text-white/55 sm:grid-cols-3">
                          <div className="rounded-xl border border-white/8 px-3 py-2">确认：{asset.approvalStatus}</div>
                          <div className="rounded-xl border border-white/8 px-3 py-2">授权：{asset.licenseStatus}</div>
                          <div className="rounded-xl border border-white/8 px-3 py-2">风险：{asset.riskLevel}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button onClick={() => props.onPreviewAsset(asset)} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80">
                            预览
                          </button>
                          <button onClick={() => props.onToggleAssetIncluded(asset.id)} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80">
                            {asset.included ? '移出' : '加入'}
                          </button>
                          <button
                            onClick={() => props.onViewVersion(asset)}
                            disabled={asset.type !== 'version-record'}
                            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 disabled:cursor-not-allowed disabled:text-white/25"
                          >
                            查看版本
                          </button>
                          <button
                            onClick={() => props.onViewApproval(asset)}
                            disabled={asset.type !== 'approval-record'}
                            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 disabled:cursor-not-allowed disabled:text-white/25"
                          >
                            查看确认
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">风险摘要</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/65">未确认项：{props.deliveryPackage.riskSummary?.hasUnapprovedItems ? '是' : '否'}</div>
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/65">Stale 确认：{props.deliveryPackage.riskSummary?.hasStaleApprovals ? '是' : '否'}</div>
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/65">未知授权：{props.deliveryPackage.riskSummary?.hasUnknownLicenses ? '是' : '否'}</div>
              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/65">阻塞项：{props.deliveryPackage.riskSummary?.hasBlockers ? '是' : '否'}</div>
            </div>
            <div className="mt-4 space-y-2">
              {riskIssues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/45">
                  当前没有检测到 Delivery 风险项。
                </div>
              ) : riskIssues.map((issue) => (
                <div key={issue.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/70">
                  <span className="mr-2 text-xs uppercase tracking-[0.18em] text-white/35">{issue.severity}</span>
                  {issue.message}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">导出与提交</h3>
            <p className="mt-2 text-sm text-white/55">导出只会生成前端 Blob 文件；提交客户确认也只会更新本地 mock 状态，不会自动完成订单或分账。</p>
            <div className="mt-5 grid gap-3">
              <button onClick={props.onExportSummary} className="rounded-2xl border border-white/10 px-4 py-3 text-left text-sm text-white/85">
                导出 delivery-summary.txt
              </button>
              <button onClick={props.onExportManifest} className="rounded-2xl border border-white/10 px-4 py-3 text-left text-sm text-white/85">
                导出 manifest.json
              </button>
              <button onClick={props.onExportProjectData} className="rounded-2xl border border-white/10 px-4 py-3 text-left text-sm text-white/85">
                导出 project-data.json
              </button>
              <button
                onClick={props.onSubmitPackage}
                disabled={!props.canSubmit}
                className="rounded-2xl bg-indigo-500 px-4 py-3 text-left text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
              >
                提交客户确认
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
