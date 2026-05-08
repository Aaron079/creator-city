'use client'

import {
  imageEditLayerIcon,
  imageEditLayerLabel,
  type ImageEditLayer,
  type ImageEditLayerMark,
} from '@/lib/scenes'

interface ImageEditLayersPanelProps {
  layers: ImageEditLayer[]
  selectedLayerId?: string
  selectedMarkId?: string
  onSelectLayer: (layerId: string, markId?: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<ImageEditLayer>) => void
  onDeleteLayer: (layerId: string) => void
  onUpdateMark: (layerId: string, markId: string, patch: Partial<ImageEditLayerMark>) => void
}

function numberParam(layer: ImageEditLayer, key: string, fallback: number) {
  const value = layer.params?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringParam(layer: ImageEditLayer, key: string, fallback: string) {
  const value = layer.params?.[key]
  return typeof value === 'string' && value ? value : fallback
}

function RangeControl({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="image-edit-control">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{value}</small>
    </label>
  )
}

export function ImageEditLayersPanel({
  layers,
  selectedLayerId,
  selectedMarkId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onUpdateMark,
}: ImageEditLayersPanelProps) {
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers.find((layer) => layer.type !== 'base') ?? null
  const selectedMark = selectedLayer?.marks?.find((mark) => mark.id === selectedMarkId) ?? selectedLayer?.marks?.[0] ?? null

  const patchParams = (layer: ImageEditLayer, patch: Record<string, unknown>) => {
    onUpdateLayer(layer.id, { params: { ...(layer.params ?? {}), ...patch } })
  }

  return (
    <aside className="image-edit-layers-panel" data-no-node-drag="true" onWheel={(event) => event.stopPropagation()}>
      <header>
        <p>Layers</p>
        <strong>图层 / 参数</strong>
        <span>{layers.length} 个图层</span>
      </header>

      <div className="image-edit-layer-list">
        {layers.map((layer) => (
          <article key={layer.id} className={selectedLayerId === layer.id ? 'is-selected' : ''}>
            <button type="button" className="image-edit-layer-row" onClick={() => onSelectLayer(layer.id, layer.marks?.[0]?.id)}>
              <span>{imageEditLayerIcon(layer.type)}</span>
              <b>{layer.name}</b>
              <small>{imageEditLayerLabel(layer.type)}</small>
            </button>
            <div className="image-edit-layer-actions">
              <button type="button" onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}>
                {layer.visible ? '隐藏' : '显示'}
              </button>
              <label>
                <span>透明度</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.opacity ?? 1}
                  onChange={(event) => onUpdateLayer(layer.id, { opacity: Number(event.target.value) })}
                />
              </label>
              {layer.type !== 'base' ? <button type="button" onClick={() => onDeleteLayer(layer.id)}>删除</button> : null}
            </div>
          </article>
        ))}
      </div>

      {selectedLayer ? (
        <section className="image-edit-selected-panel">
          <h4>当前选中</h4>
          <label className="image-edit-text-field">
            <span>图层名称</span>
            <input value={selectedLayer.name} onChange={(event) => onUpdateLayer(selectedLayer.id, { name: event.target.value })} />
          </label>
          <label className="image-edit-text-field">
            <span>图层指令</span>
            <textarea
              rows={3}
              value={selectedLayer.instruction ?? ''}
              onChange={(event) => onUpdateLayer(selectedLayer.id, { instruction: event.target.value })}
            />
          </label>

          {selectedLayer.type === 'color-adjustment' ? (
            <>
              <RangeControl label="亮度" value={numberParam(selectedLayer, 'brightness', 104)} min={60} max={150} onChange={(value) => patchParams(selectedLayer, { brightness: value })} />
              <RangeControl label="对比" value={numberParam(selectedLayer, 'contrast', 112)} min={60} max={160} onChange={(value) => patchParams(selectedLayer, { contrast: value })} />
              <RangeControl label="饱和" value={numberParam(selectedLayer, 'saturation', 112)} min={0} max={200} onChange={(value) => patchParams(selectedLayer, { saturation: value })} />
              <RangeControl label="暖色" value={numberParam(selectedLayer, 'warmth', 8)} min={-40} max={40} onChange={(value) => patchParams(selectedLayer, { warmth: value })} />
            </>
          ) : null}

          {selectedLayer.type === 'weather-overlay' ? (
            <>
              <label className="image-edit-text-field">
                <span>天气类型</span>
                <select value={stringParam(selectedLayer, 'weatherType', 'rain')} onChange={(event) => patchParams(selectedLayer, { weatherType: event.target.value })}>
                  <option value="rain">雨</option>
                  <option value="snow">雪</option>
                  <option value="fog-rain">雨雾</option>
                </select>
              </label>
              <RangeControl label="强度" value={numberParam(selectedLayer, 'intensity', 62)} min={0} max={100} onChange={(value) => patchParams(selectedLayer, { intensity: value })} />
              <RangeControl label="方向" value={numberParam(selectedLayer, 'direction', 18)} min={-45} max={45} onChange={(value) => patchParams(selectedLayer, { direction: value })} />
            </>
          ) : null}

          {selectedLayer.type === 'light-overlay' ? (
            <>
              <label className="image-edit-text-field">
                <span>光色</span>
                <input type="color" value={stringParam(selectedLayer, 'color', '#ffd28a')} onChange={(event) => patchParams(selectedLayer, { color: event.target.value })} />
              </label>
              <RangeControl label="强度" value={numberParam(selectedLayer, 'intensity', 68)} min={0} max={100} onChange={(value) => patchParams(selectedLayer, { intensity: value })} />
              <RangeControl label="半径" value={numberParam(selectedLayer, 'radius', 36)} min={12} max={90} onChange={(value) => patchParams(selectedLayer, { radius: value })} />
            </>
          ) : null}

          {selectedLayer.type === 'fog-overlay' ? (
            <>
              <label className="image-edit-text-field">
                <span>雾色</span>
                <input type="color" value={stringParam(selectedLayer, 'color', '#d7e7ff')} onChange={(event) => patchParams(selectedLayer, { color: event.target.value })} />
              </label>
              <RangeControl label="密度" value={numberParam(selectedLayer, 'density', 42)} min={0} max={100} onChange={(value) => patchParams(selectedLayer, { density: value })} />
            </>
          ) : null}

          {selectedMark ? (
            <div className="image-edit-mark-panel">
              <h5>当前标记</h5>
              <label className="image-edit-text-field">
                <span>标记标签</span>
                <input value={selectedMark.label ?? ''} onChange={(event) => onUpdateMark(selectedLayer.id, selectedMark.id, { label: event.target.value })} />
              </label>
              <label className="image-edit-text-field">
                <span>标记指令</span>
                <textarea
                  rows={3}
                  value={selectedMark.instruction ?? ''}
                  onChange={(event) => onUpdateMark(selectedLayer.id, selectedMark.id, { instruction: event.target.value })}
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="image-edit-empty">请选择工具并在图片上添加图层。</div>
      )}
    </aside>
  )
}
