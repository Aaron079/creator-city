'use client'

interface WorkspaceAssetsPanelProps {
  shotCount: number
  storyboardFrameCount: number
  versionCount: number
  audioCueCount: number
}

export function WorkspaceAssetsPanel({
  shotCount,
  storyboardFrameCount,
  versionCount,
  audioCueCount,
}: WorkspaceAssetsPanelProps) {
  return (
    <div className="mx-5 mt-3 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-3xl">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/34">Assets</div>
        <div className="mt-2 text-2xl font-light tracking-[-0.03em] text-white">资源占位工作区</div>
        <p className="mt-3 max-w-2xl text-sm leading-[1.75] text-white/56">
          这里先聚合当前项目里的镜头、分镜帧、版本和音频素材数量，作为轻量资源层。它不替代真正的资产系统，但能让你在节点画布之外快速确认当前有哪些内容已经进入项目。
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '镜头', value: shotCount },
            { label: '分镜帧', value: storyboardFrameCount },
            { label: '版本', value: versionCount },
            { label: '声音线索', value: audioCueCount },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 backdrop-blur-2xl">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/34">{item.label}</div>
              <div className="mt-2 text-2xl font-light tracking-[-0.03em] text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-3xl">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/34">Asset Guidance</div>
        <div className="mt-3 space-y-3 text-sm leading-[1.75] text-white/58">
          <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
            节点画布适合处理阶段推进；Assets 适合确认已有镜头、分镜、音频与版本是否齐全。
          </div>
          <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
            第一版只做资源占位汇总，不新增真实上传后端，也不重写交付或版本系统。
          </div>
          <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-white/72">
            如果你现在想继续推进内容，建议先回到 Canvas 节点；如果要整理输出，再切去 Delivery。
          </div>
        </div>
      </div>
    </div>
  )
}
