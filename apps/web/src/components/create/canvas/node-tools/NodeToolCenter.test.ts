import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import * as React from 'react'
import { NodeToolCenter } from './NodeToolCenter'

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
  const props = node.props as ElementProps
  return asChildren(props.children).map(textContent).join('')
}

function buttons(node: React.ReactNode): Array<{ props: ElementProps }> {
  if (!React.isValidElement(node)) return []
  const props = node.props as ElementProps
  const own = node.type === 'button' ? [{ props }] : []
  return [...own, ...asChildren(props.children).flatMap(buttons)]
}

describe('NodeToolCenter recommendations', () => {
  test('shows a recommended text workflow without hiding the full category list', () => {
    const tree = NodeToolCenter({
      nodeKind: 'text',
      hasMediaResult: false,
      caps: {},
      onAction() {},
    })
    const visible = textContent(tree)

    assert.match(visible, /推荐下一步/)
    assert.match(visible, /分镜导演/)
    assert.match(visible, /剧本分场/)
    assert.match(visible, /叙事节拍分析/)
  })

  test('recommends a visual tool and preserves compatible image editing tools', () => {
    const tree = NodeToolCenter({
      nodeKind: 'image',
      hasMediaResult: true,
      caps: {},
      onAction() {},
    })
    const visible = textContent(tree)

    assert.match(visible, /推荐下一步/)
    assert.match(visible, /摄影机控制/)
    assert.match(visible, /画面标注/)
    assert.match(visible, /分镜参考提取/)
    assert.doesNotMatch(visible, /主体抠图/)
  })

  test('uses the existing action callback for the recommended tool', () => {
    const actions: string[] = []
    const tree = NodeToolCenter({
      nodeKind: 'image',
      hasMediaResult: true,
      caps: {},
      onAction(actionId) { actions.push(actionId) },
    })
    const recommended = buttons(tree)[0]

    assert.ok(recommended)
    recommended.props.onClick?.()
    assert.deepEqual(actions, ['camera-control'])
  })
})
