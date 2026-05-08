'use client'

import { useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import { ImageEditCanvas, type ImageEditTool } from './ImageEditCanvas'
import { ImageEditLayersPanel } from './ImageEditLayersPanel'
import {
  SCENE_EDIT_TASK_OPTIONS,
  createSceneEditTask,
  formatSceneEditTasksForPrompt,
  imageEditLayersToSceneEditTasks,
  sceneEditTasksToSceneEdits,
  sceneEditsToSceneEditTasks,
  type ImageEditLayer,
  type SceneEditMark,
  type SceneEditTask,
  type SceneEditTaskType,
} from '@/lib/scenes'

interface ImageEditStudioProps {
  node: CanvasNode
  imageUrl: string
  sceneEditTasks: SceneEditTask[]
  sceneEdits?: SceneEditMark[]
  imageEditLayers?: ImageEditLayer[]
  onSaveTasks: (tasks: SceneEditTask[], sceneEdits: SceneEditMark[], prompt: string) => void
  onSendPromptToImageNode?: (nodeId: string, prompt: string) => void
  onClose?: () => void
}

const TOOL_OPTIONS: Array<{ tool: ImageEditTool; label: string; icon: string; description: string }> = [
  { tool: 'select', label: '选择区域', icon: '⬚', description: '选择或调整已有场景修改区域。' },
  ...SCENE_EDIT_TASK_OPTIONS.map((option) => ({
    tool: option.type,
    label: option.label,
    icon: option.icon,
    description: option.instruction,
  })),
]

function initialTasks(input: {
  sceneEditTasks: SceneEditTask[]
  sceneEdits?: SceneEditMark[]
  imageEditLayers?: ImageEditLayer[]
}) {
  if (input.sceneEditTasks.length) return input.sceneEditTasks
  const fromSceneEdits = sceneEditsToSceneEditTasks(input.sceneEdits ?? [])
  if (fromSceneEdits.length) return fromSceneEdits
  return imageEditLayersToSceneEditTasks(input.imageEditLayers ?? [])
}

export function ImageEditStudio({
  node,
  imageUrl,
  sceneEditTasks,
  sceneEdits = [],
  imageEditLayers = [],
  onSaveTasks,
  onSendPromptToImageNode,
  onClose,
}: ImageEditStudioProps) {
  const [tasks, setTasks] = useState<SceneEditTask[]>(() => initialTasks({ sceneEditTasks, sceneEdits, imageEditLayers }))
  const [activeTool, setActiveTool] = useState<ImageEditTool>('select')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  const derivedSceneEdits = useMemo(() => sceneEditTasksToSceneEdits(tasks), [tasks])

  const updateTask = (taskId: string, patch: Partial<SceneEditTask>) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, ...patch, id: task.id, createdAt: task.createdAt } : task
    )))
  }

  const deleteTask = (taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId))
    if (selectedTaskId === taskId) setSelectedTaskId('')
  }

  const commitCanvasAction = (input: { type: SceneEditTaskType; x: number; y: number; width: number; height: number }) => {
    const task = createSceneEditTask(input)
    setTasks((current) => [...current, task])
    setSelectedTaskId(task.id)
    setActiveTool('select')
  }

  const moveTask = (taskId: string, x: number, y: number) => {
    updateTask(taskId, { x, y })
  }

  const generatePrompt = () => {
    const nextPrompt = formatSceneEditTasksForPrompt(tasks)
    setPrompt(nextPrompt)
    return nextPrompt
  }

  const saveTasks = () => {
    const nextPrompt = prompt || generatePrompt()
    onSaveTasks(tasks, derivedSceneEdits, nextPrompt)
  }

  const copyPrompt = async () => {
    const nextPrompt = prompt || generatePrompt()
    try {
      await navigator.clipboard?.writeText(nextPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const sendPrompt = () => {
    const nextPrompt = prompt || generatePrompt()
    onSaveTasks(tasks, derivedSceneEdits, nextPrompt)
    onSendPromptToImageNode?.(node.id, nextPrompt)
  }

  const clearTasks = () => {
    if (!window.confirm('确定清空所有场景修改任务？')) return
    setTasks([])
    setSelectedTaskId('')
    setPrompt('')
  }

  return (
    <div className="image-edit-studio" data-no-node-drag="true" onWheel={(event) => event.stopPropagation()}>
      <aside className="image-edit-toolbar">
        {TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.tool}
            type="button"
            className={activeTool === tool.tool ? 'is-active' : ''}
            onClick={() => setActiveTool(tool.tool)}
            title={tool.description}
          >
            <span>{tool.icon}</span>
            <small>{tool.label}</small>
          </button>
        ))}
      </aside>

      <main className="image-edit-main">
        <header className="image-edit-main-head">
          <div>
            <p>Scene Edit Plugin</p>
            <h3>{node.title}</h3>
          </div>
          {onClose ? <button type="button" onClick={onClose}>关闭</button> : null}
        </header>
        <ImageEditCanvas
          imageUrl={imageUrl}
          imageAlt={node.title}
          tasks={tasks}
          activeTool={activeTool}
          selectedTaskId={selectedTaskId}
          onCanvasCommit={commitCanvasAction}
          onSelectTask={setSelectedTaskId}
          onMoveTask={moveTask}
        />
        <footer className="image-edit-footer">
          <button type="button" onClick={saveTasks}>保存场景修改任务</button>
          <button type="button" onClick={copyPrompt} disabled={!tasks.length}>{copied ? '已复制' : '复制场景修改 Prompt'}</button>
          <button type="button" onClick={sendPrompt} disabled={!tasks.length}>发送到当前 Image Prompt</button>
          <button type="button" disabled title="下一轮支持创建新版 Image 节点">创建新版 Image 节点</button>
          <button type="button" onClick={clearTasks} disabled={!tasks.length}>清空任务</button>
        </footer>
        {prompt ? <pre className="image-edit-prompt-preview">{prompt}</pre> : null}
      </main>

      <ImageEditLayersPanel
        tasks={tasks}
        activeTool={activeTool}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
      />
    </div>
  )
}
