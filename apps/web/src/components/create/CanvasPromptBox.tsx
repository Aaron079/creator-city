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
    <div className="canvas-prompt-box">
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="canvas-prompt-input"
      />

      <div className="canvas-pill-row">
        {models.map((item) => {
          const active = item === model
          return (
            <button
              key={item}
              type="button"
              onClick={() => onModelChange(item)}
              className={`canvas-pill-button ${active ? 'is-model-active' : ''}`}
            >
              {item}
            </button>
          )
        })}
      </div>

      {ratios && ratios.length > 0 && ratio && onRatioChange ? (
        <div className="canvas-pill-row">
          {ratios.map((item) => {
            const active = item === ratio
            return (
              <button
                key={item}
                type="button"
                onClick={() => onRatioChange(item)}
                className={`canvas-pill-button ${active ? 'is-ratio-active' : ''}`}
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
