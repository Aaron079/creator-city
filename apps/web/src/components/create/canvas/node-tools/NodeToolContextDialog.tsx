'use client'

import type { CSSProperties } from 'react'
import type { ReframeMode, NodeContextCategory } from '@/components/create/AssetAgentToolbar'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { NodeToolCenter } from './NodeToolCenter'

const REFRAME_OPTIONS: Array<{ label: string; value: ReframeMode }> = [
  { label: '原始', value: 'original' },
  { label: '远景', value: 'wide' },
  { label: '中景', value: 'medium' },
  { label: '近景', value: 'close' },
  { label: '特写', value: 'extreme-close' },
]

export interface NodeToolContextDialogProps {
  category: NodeContextCategory
  nodeKind: VisualCanvasNodeKind
  nodeTitle: string
  hasMediaResult: boolean
  mediaUrl: string
  nodeId?: string
  assetId?: string
  reframeMode: ReframeMode
  caps: { removeBackground?: boolean; upscale?: boolean }
  onOpenGenerationDialog(): void
  onToolAction(actionId: string): void
  onDownload?(): void
  onFullscreen?(): void
  onReframeChange(mode: ReframeMode): void
  onOpenABCompare?(): void
  onOpenAssets(): void
  onClose(): void
  style?: CSSProperties
}

function TaskContextBody({ onOpenGenerationDialog }: Pick<NodeToolContextDialogProps, 'onOpenGenerationDialog'>) {
  return (
    <div className="node-tool-context-dialog-body node-tool-context-dialog-task">
      <div>
        <p className="node-tool-context-dialog-eyebrow">生成任务</p>
        <p className="node-tool-context-dialog-copy">仅在确认后打开生成设置，不会自动请求 Provider 或扣费。</p>
      </div>
      <button type="button" className="node-tool-context-dialog-primary" onClick={onOpenGenerationDialog}>
        打开生成任务
      </button>
    </div>
  )
}

function AssetContextBody({
  hasMediaResult,
  reframeMode,
  onDownload,
  onFullscreen,
  onReframeChange,
  onOpenABCompare,
  onOpenAssets,
}: Pick<
  NodeToolContextDialogProps,
  'hasMediaResult' | 'reframeMode' | 'onDownload' | 'onFullscreen' | 'onReframeChange' | 'onOpenABCompare' | 'onOpenAssets'
>) {
  return (
    <div className="node-tool-context-dialog-body node-tool-context-dialog-assets">
      <div className="node-tool-context-dialog-actions">
        <button type="button" disabled={!hasMediaResult} onClick={onDownload}>下载素材</button>
        <button type="button" disabled={!hasMediaResult} onClick={onFullscreen}>全屏预览</button>
        <button type="button" disabled={!hasMediaResult || !onOpenABCompare} onClick={onOpenABCompare}>版本对比</button>
        <button type="button" onClick={onOpenAssets}>打开资产库</button>
      </div>
      <div className="node-tool-context-dialog-reframe" aria-label="重构图">
        <span>重构图</span>
        {REFRAME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={reframeMode === option.value ? 'is-active' : ''}
            disabled={!hasMediaResult}
            onClick={() => onReframeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!hasMediaResult ? <p className="node-tool-context-dialog-blocked">请先获得节点素材后再使用资产操作。</p> : null}
    </div>
  )
}

export function NodeToolContextDialog({
  category,
  nodeKind,
  nodeTitle,
  hasMediaResult,
  mediaUrl: _mediaUrl,
  nodeId: _nodeId,
  assetId: _assetId,
  reframeMode,
  caps,
  onOpenGenerationDialog,
  onToolAction,
  onDownload,
  onFullscreen,
  onReframeChange,
  onOpenABCompare,
  onOpenAssets,
  onClose,
  style,
}: NodeToolContextDialogProps) {
  const sectionTitle = category === 'task' ? '任务' : category === 'tools' ? '工具' : '资产'

  return (
    <section className="canvas-node-context-dialog" data-no-node-drag="true" aria-label={`${nodeTitle || '节点'}${sectionTitle}`} style={style}>
      {category === 'task' ? <TaskContextBody onOpenGenerationDialog={onOpenGenerationDialog} /> : null}
      {category === 'tools' ? (
        <NodeToolCenter
          nodeKind={nodeKind}
          hasMediaResult={hasMediaResult}
          caps={caps}
          presentation="context-dialog"
          onAction={onToolAction}
        />
      ) : null}
      {category === 'assets' ? (
        <AssetContextBody
          hasMediaResult={hasMediaResult}
          reframeMode={reframeMode}
          onDownload={onDownload}
          onFullscreen={onFullscreen}
          onReframeChange={onReframeChange}
          onOpenABCompare={onOpenABCompare}
          onOpenAssets={onOpenAssets}
        />
      ) : null}
      <button type="button" className="node-tool-context-dialog-close" onClick={onClose} aria-label="关闭节点操作">关闭</button>
    </section>
  )
}
