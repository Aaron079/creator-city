'use client'

import {
  SCENE_EDIT_TASK_OPTIONS,
  getSceneEditTaskOption,
  type SceneEditTask,
  type SceneEditTaskType,
} from '@/lib/scenes'

interface ImageEditLayersPanelProps {
  tasks: SceneEditTask[]
  activeTool: SceneEditTaskType | 'select'
  selectedTaskId?: string
  onSelectTask: (taskId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<SceneEditTask>) => void
  onDeleteTask: (taskId: string) => void
}

function compact(value: string, limit = 42) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

export function ImageEditLayersPanel({
  tasks,
  activeTool,
  selectedTaskId,
  onSelectTask,
  onUpdateTask,
  onDeleteTask,
}: ImageEditLayersPanelProps) {
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null
  const activeLabel = activeTool === 'select' ? '选择区域' : getSceneEditTaskOption(activeTool).label

  return (
    <aside className="image-edit-layers-panel" data-no-node-drag="true" onWheel={(event) => event.stopPropagation()}>
      <header>
        <p>Scene Edit Plugin</p>
        <strong>场景修改任务</strong>
        <span>当前工具：{activeLabel} · {tasks.length} 个任务</span>
      </header>

      <div className="image-edit-layer-list">
        {tasks.length ? (
          tasks.map((task, index) => {
            const option = getSceneEditTaskOption(task.type)
            return (
              <article key={task.id} className={selectedTaskId === task.id ? 'is-selected' : ''}>
                <button type="button" className="image-edit-layer-row" onClick={() => onSelectTask(task.id)}>
                  <span>{option.icon}</span>
                  <b>{index + 1}. {task.label}</b>
                  <small>{compact(task.instruction)}</small>
                </button>
                <div className="image-edit-layer-actions">
                  <button type="button" onClick={() => onDeleteTask(task.id)}>删除</button>
                  <small>x {Math.round(task.x * 100)}% / y {Math.round(task.y * 100)}%</small>
                </div>
              </article>
            )
          })
        ) : (
          <div className="image-edit-empty">选择场景工具后，在图片上拖拽框选要修改、保留或移除的区域。</div>
        )}
      </div>

      {selectedTask ? (
        <section className="image-edit-selected-panel">
          <h4>当前任务</h4>
          <label className="image-edit-text-field">
            <span>任务类型</span>
            <select value={selectedTask.type} onChange={(event) => onUpdateTask(selectedTask.id, { type: event.target.value as SceneEditTaskType })}>
              {SCENE_EDIT_TASK_OPTIONS.map((option) => (
                <option key={option.type} value={option.type}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="image-edit-text-field">
            <span>标签</span>
            <input value={selectedTask.label} onChange={(event) => onUpdateTask(selectedTask.id, { label: event.target.value })} />
          </label>
          <label className="image-edit-text-field">
            <span>修改指令</span>
            <textarea rows={4} value={selectedTask.instruction} onChange={(event) => onUpdateTask(selectedTask.id, { instruction: event.target.value })} />
          </label>
          <label className="image-edit-text-field">
            <span>保留要求</span>
            <textarea rows={3} value={selectedTask.preserveInstruction ?? ''} onChange={(event) => onUpdateTask(selectedTask.id, { preserveInstruction: event.target.value })} placeholder="例如：保留霓虹灯、湿润街道和主体透视。" />
          </label>
          <label className="image-edit-text-field">
            <span>禁止项</span>
            <textarea rows={3} value={selectedTask.negativeInstruction ?? ''} onChange={(event) => onUpdateTask(selectedTask.id, { negativeInstruction: event.target.value })} placeholder="例如：不要变成乡村，不要卡通化，不要改变主体。" />
          </label>
        </section>
      ) : null}
    </aside>
  )
}
