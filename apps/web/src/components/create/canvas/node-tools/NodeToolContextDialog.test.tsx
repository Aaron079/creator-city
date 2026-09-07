import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as React from 'react'
import { NodeToolContextDialog } from './NodeToolContextDialog'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

type ElementProps = {
  children?: React.ReactNode
  onClick?: () => void
}

function asChildren(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node)
}

function textContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!React.isValidElement(node)) return ''
  if (typeof node.type === 'function') {
    return textContent((node.type as (props: unknown) => React.ReactNode)(node.props))
  }
  return asChildren((node.props as ElementProps).children).map(textContent).join('')
}

function buttons(node: React.ReactNode): Array<{ props: ElementProps }> {
  if (!React.isValidElement(node)) return []
  if (typeof node.type === 'function') {
    return buttons((node.type as (props: unknown) => React.ReactNode)(node.props))
  }
  const props = node.props as ElementProps
  const own = node.type === 'button' ? [{ props }] : []
  return [...own, ...asChildren(props.children).flatMap(buttons)]
}

const baseProps = {
  nodeKind: 'image' as const,
  nodeTitle: 'Frame',
  hasMediaResult: true,
  mediaUrl: 'https://example.test/frame.png',
  reframeMode: 'original' as const,
  caps: {},
  onToolAction() {},
  onDownload() {},
  onFullscreen() {},
  onReframeChange() {},
  onOpenAssets() {},
  onClose() {},
}

test('shows one explicit generation action without duplicating node categories', () => {
  const opened: string[] = []
  const tree = NodeToolContextDialog({
    ...baseProps,
    category: 'task',
    onOpenGenerationDialog: () => opened.push('generation'),
  })
  const visible = textContent(tree)

  assert.match(visible, /打开生成任务/)
  assert.doesNotMatch(visible, /推荐下一步/)
  buttons(tree)[0]?.props.onClick?.()
  assert.deepEqual(opened, ['generation'])
})

test('shows result-aware tool actions without another category navigation', () => {
  const tree = NodeToolContextDialog({
    ...baseProps,
    category: 'tools',
    onOpenGenerationDialog() {},
  })
  const visible = textContent(tree)

  assert.match(visible, /调整任务参数/)
  assert.match(visible, /创建参考图节点/)
  assert.doesNotMatch(visible, /推荐下一步/)
})
