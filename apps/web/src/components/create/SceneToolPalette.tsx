'use client'

import type { SceneEditMark, SceneEditTool } from '@/lib/scenes'
import { SCENE_EDIT_TOOL_OPTIONS, getSceneEditToolOption, summarizeSceneEdits } from '@/lib/scenes'

interface SceneToolPaletteProps {
  activeTool: SceneEditTool
  sceneEdits: SceneEditMark[]
  selectedEditId?: string
  copied?: boolean
  onToolChange: (tool: SceneEditTool) => void
  onSelectEdit: (editId: string) => void
  onLabelChange?: (editId: string, label: string) => void
  onInstructionChange: (editId: string, instruction: string) => void
  onDeleteEdit: (editId: string) => void
  onClearEdits: () => void
  onCopyInstructions: () => void
  onSaveLayer: () => void
}

export function SceneToolPalette({
  activeTool,
  sceneEdits,
  selectedEditId,
  copied = false,
  onToolChange,
  onSelectEdit,
  onLabelChange,
  onInstructionChange,
  onDeleteEdit,
  onClearEdits,
  onCopyInstructions,
  onSaveLayer,
}: SceneToolPaletteProps) {
  const activeOption = getSceneEditToolOption(activeTool)

  return (
    <aside
      className="scene-tool-palette"
      data-no-node-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className="scene-tool-palette-head">
        <p>Scene Tools</p>
        <strong>场景工具层</strong>
        <span>{sceneEdits.length} 个标记</span>
      </div>

      <div className="scene-tool-grid" role="toolbar" aria-label="场景可视化工具">
        {SCENE_EDIT_TOOL_OPTIONS.map((option) => (
          <button
            key={option.tool}
            type="button"
            className={activeTool === option.tool ? 'is-active' : ''}
            onClick={() => onToolChange(option.tool)}
            title={option.instruction}
          >
            <span aria-hidden="true">{option.icon}</span>
            <small>{option.label}</small>
            <em>{option.instruction}</em>
          </button>
        ))}
      </div>

      <div className="scene-tool-current">
        <span>当前工具：{activeOption.label}</span>
        <p>{activeOption.instruction}</p>
      </div>

      <div className="scene-tool-actions">
        <button type="button" onClick={onCopyInstructions} disabled={!sceneEdits.length}>
          {copied ? '已复制' : '复制场景编辑指令'}
        </button>
        <button type="button" onClick={onSaveLayer} disabled={!sceneEdits.length}>
          保存编辑层
        </button>
        <button type="button" onClick={onClearEdits} disabled={!sceneEdits.length}>
          清空
        </button>
      </div>

      <div className="scene-tool-list">
        {sceneEdits.length ? (
          sceneEdits.map((edit, index) => {
            const option = getSceneEditToolOption(edit.tool)
            const selected = selectedEditId === edit.id
            return (
              <article key={edit.id} className={selected ? 'is-selected' : ''}>
                <button type="button" className="scene-tool-list-title" onClick={() => onSelectEdit(edit.id)}>
                  <span aria-hidden="true">{option.icon}</span>
                  <strong>{index + 1}. {edit.label}</strong>
                  <small>{Math.round(edit.x * 100)}% / {Math.round(edit.y * 100)}%</small>
                </button>
                {selected ? (
                  <div className="scene-tool-mark-editor">
                    <label>
                      <span className="mt-2 block text-xs font-semibold text-white/50">标签</span>
                      <input
                        value={edit.label}
                        onChange={(event) => onLabelChange?.(edit.id, event.target.value)}
                        placeholder={option.label}
                        className="mt-1 h-8 w-full rounded-md border border-white/15 bg-white/[0.06] px-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-cyan-200/50"
                      />
                    </label>
                    <label>
                      <span className="mt-2 block text-xs font-semibold text-white/50">修改指令</span>
                      <textarea
                        value={edit.instruction}
                        onChange={(event) => onInstructionChange(edit.id, event.target.value)}
                        rows={3}
                        placeholder={option.instruction}
                        className="mt-1"
                      />
                    </label>
                  </div>
                ) : (
                  <p>{edit.instruction}</p>
                )}
                <button type="button" className="scene-tool-delete" onClick={() => onDeleteEdit(edit.id)}>
                  删除
                </button>
              </article>
            )
          })
        ) : (
          <div className="scene-tool-empty">
            <strong>还没有场景编辑标记</strong>
            <p>选择右侧工具后，在图片上点击或拖拽，标记天气、光线、人物、建筑或遮罩等导演意图。</p>
          </div>
        )}
      </div>

      <pre className="scene-tool-copy-preview">{summarizeSceneEdits(sceneEdits)}</pre>
    </aside>
  )
}
