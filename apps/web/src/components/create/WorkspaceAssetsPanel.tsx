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
  const totalAssets = shotCount + storyboardFrameCount + versionCount + audioCueCount

  return (
    <div className="mx-5 mt-3 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="canvas-assets-shell">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/34">Assets</div>
        <div className="mt-2 text-2xl font-light tracking-[-0.03em] text-white">资源汇总层</div>
        <p className="mt-3 max-w-2xl text-sm leading-[1.75] text-white/56">
          上传或生成素材后，会在这里汇总。当前先保留轻量概览，不把主画布变成后台资源系统。
        </p>

        <div className="mt-6 canvas-assets-empty">
          <div className="canvas-assets-empty-title">
            {totalAssets > 0 ? '当前已有素材概览' : '上传或生成素材后，会在这里汇总'}
          </div>
          <div className="canvas-assets-empty-copy">
            {totalAssets > 0
              ? '你已经有部分镜头、分镜、版本或音频线索，可以在这里快速确认资源覆盖情况。'
              : '现在先保持轻量空状态，等你真正生成内容后再把素材集中起来。'}
          </div>
        </div>
      </div>

      <div className="canvas-assets-shell">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/34">Snapshot</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: '镜头', value: shotCount },
            { label: '分镜帧', value: storyboardFrameCount },
            { label: '版本', value: versionCount },
            { label: '音频线索', value: audioCueCount },
          ].map((item) => (
            <div key={item.label} className="canvas-assets-card">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/34">{item.label}</div>
              <div className="mt-2 text-2xl font-light tracking-[-0.03em] text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
