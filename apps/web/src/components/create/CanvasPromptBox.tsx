'use client'

interface CanvasPromptBoxProps {
  prompt: string
  onPromptChange: (value: string) => void
  model: string
  models: string[]
  onModelChange: (value: string) => void
  ratio?: string
  ratios?: string[]
  onRatioChange?: (value: string) => void
  placeholder: string
}

export function CanvasPromptBox({
  prompt,
  onPromptChange,
  model,
  models,
  onModelChange,
  ratio,
  ratios,
  onRatioChange,
  placeholder,
}: CanvasPromptBoxProps) {
  return (
    <div className="space-y-3">
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-[22px] border border-white/8 bg-black/30 px-3.5 py-3 text-[12px] leading-[1.65] text-white/88 outline-none placeholder:text-white/28"
      />

      <div className="flex flex-wrap items-center gap-2">
        {models.map((item) => {
          const active = item === model
          return (
            <button
              key={item}
              type="button"
              onClick={() => onModelChange(item)}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium transition"
              style={{
                background: active ? 'rgba(138,43,226,0.16)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(138,43,226,0.35)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#f5ecff' : 'rgba(255,255,255,0.56)',
                backdropFilter: 'blur(18px)',
              }}
            >
              {item}
            </button>
          )
        })}
      </div>

      {ratios && ratios.length > 0 && ratio && onRatioChange ? (
        <div className="flex flex-wrap items-center gap-2">
          {ratios.map((item) => {
            const active = item === ratio
            return (
              <button
                key={item}
                type="button"
                onClick={() => onRatioChange(item)}
                className="rounded-full px-2.5 py-1 text-[10px] font-medium transition"
                style={{
                  background: active ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,255,255,0.28)' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#d9ffff' : 'rgba(255,255,255,0.52)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                {item}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
