import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  availableNodeTools,
  recommendNodeTool,
} from './nodeToolRecommendation'
import { NODE_TOOL_REGISTRY } from './nodeToolRegistry'

describe('node tool recommendations', () => {
  test('recommends Storyboard Director for a text node', () => {
    const recommendation = recommendNodeTool({
      nodeKind: 'text',
      hasMediaResult: false,
      caps: {},
    })

    assert.equal(recommendation?.openActionId, 'storyboard-director')
  })

  test('recommends compatible camera control for a visual node', () => {
    const recommendation = recommendNodeTool({
      nodeKind: 'image',
      hasMediaResult: true,
      caps: {},
    })

    assert.equal(recommendation?.openActionId, 'camera-control')
  })

  test('never recommends an unavailable capability-gated tool', () => {
    const input = {
      nodeKind: 'image' as const,
      hasMediaResult: true,
      caps: {},
    }
    const recommendation = recommendNodeTool(input)
    const available = availableNodeTools(input)

    assert.notEqual(recommendation?.openActionId, 'remove-background')
    assert.equal(available.some((tool) => tool.openActionId === 'remove-background'), false)
  })

  test('keeps image editing unavailable until an image has media', () => {
    const available = availableNodeTools({
      nodeKind: 'image',
      hasMediaResult: false,
      caps: {},
    })

    assert.equal(available.some((tool) => tool.openActionId === 'draw-annotation'), false)
    assert.equal(available.some((tool) => tool.openActionId === 'storyboard-reference-extractor'), false)
  })

  test('offers freeform reference extraction instead of the fixed-grid split entry', () => {
    assert.equal(NODE_TOOL_REGISTRY.some((tool) => tool.id === 'storyboard-reference-extractor'), true)
    assert.equal(NODE_TOOL_REGISTRY.some((tool) => tool.id === 'storyboard-grid-split'), false)

    const available = availableNodeTools({
      nodeKind: 'image',
      hasMediaResult: true,
      caps: {},
    })
    assert.equal(available.some((tool) => tool.openActionId === 'storyboard-reference-extractor'), true)
  })

  test('offers keyframe extraction from the standard tools menu for a video with media', () => {
    const available = availableNodeTools({
      nodeKind: 'video',
      hasMediaResult: true,
      caps: {},
    })

    assert.equal(available.some((tool) => tool.openActionId === 'keyframe-extractor'), true)
  })
})
