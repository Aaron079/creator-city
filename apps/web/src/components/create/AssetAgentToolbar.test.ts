import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as React from 'react'
import { AssetAgentToolbar } from './AssetAgentToolbar'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

type ElementProps = {
  children?: React.ReactNode
  onClick?: (event: { preventDefault(): void; stopPropagation(): void }) => void
}

function asChildren(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node)
}

function textContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!React.isValidElement(node)) return ''
  return asChildren((node.props as ElementProps).children).map(textContent).join('')
}

function buttons(node: React.ReactNode): Array<{ props: ElementProps }> {
  if (!React.isValidElement(node)) return []
  const props = node.props as ElementProps
  const own = node.type === 'button' ? [{ props }] : []
  return [...own, ...asChildren(props.children).flatMap(buttons)]
}

test('reports a selected category and owns no nested tool or asset menu', () => {
  const categories: string[] = []
  const tree = AssetAgentToolbar({
    nodeKind: 'image',
    nodeTitle: 'Frame',
    activeCategory: 'tools',
    onCategoryChange: (category) => categories.push(category),
  })
  const visible = textContent(tree)

  assert.match(visible, /任务/)
  assert.match(visible, /工具/)
  assert.match(visible, /资产/)
  assert.doesNotMatch(visible, /推荐下一步/)
  assert.doesNotMatch(visible, /下载图片/)

  buttons(tree)[0]?.props.onClick?.({ preventDefault() {}, stopPropagation() {} })
  assert.deepEqual(categories, ['task'])
})
