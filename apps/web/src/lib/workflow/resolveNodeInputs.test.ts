/**
 * Unit tests for resolveNodeInputs.ts
 * Run with: node --import tsx/esm --test src/lib/workflow/resolveNodeInputs.test.ts
 *
 * Verifies pure workflow resolution logic — no React / DOM dependencies.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { resolveImageInputForVideoNode, type WorkflowNode, type WorkflowEdge } from './resolveNodeInputs'

function imageNode(id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return { id, kind: 'image', ...overrides }
}

function videoNode(id: string): WorkflowNode {
  return { id, kind: 'video' }
}

function edge(fromNodeId: string, toNodeId: string): WorkflowEdge {
  return { fromNodeId, toNodeId }
}

describe('resolveImageInputForVideoNode', () => {
  it('no upstream image → text-to-video', () => {
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [videoNode('v1'), imageNode('i1')],
      edges: [],
    })
    assert.equal(result.mode, 'text-to-video')
    assert.equal(result.reason, 'no_upstream_image')
    assert.equal(result.imageUrl, undefined)
  })

  it('upstream image with stableUrl → image-to-video', () => {
    const src = imageNode('i1', {
      metadataJson: { stableUrl: 'https://oss.example.com/img.jpg' },
    })
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [src, videoNode('v1')],
      edges: [edge('i1', 'v1')],
    })
    assert.equal(result.mode, 'image-to-video')
    assert.equal(result.imageUrl, 'https://oss.example.com/img.jpg')
    assert.equal(result.sourceImageNodeId, 'i1')
  })

  it('upstream image with resultImageUrl → image-to-video', () => {
    const src = imageNode('i1', { resultImageUrl: 'https://cdn.example.com/photo.png' })
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [src, videoNode('v1')],
      edges: [edge('i1', 'v1')],
    })
    assert.equal(result.mode, 'image-to-video')
    assert.equal(result.imageUrl, 'https://cdn.example.com/photo.png')
  })

  it('upstream image with resolvedUrl → image-to-video (stableUrl takes priority)', () => {
    const src = imageNode('i1', {
      metadataJson: {
        stableUrl: 'https://oss.example.com/stable.jpg',
        resolvedUrl: 'https://oss.example.com/resolved.jpg',
      },
    })
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [src, videoNode('v1')],
      edges: [edge('i1', 'v1')],
    })
    assert.equal(result.mode, 'image-to-video')
    assert.equal(result.imageUrl, 'https://oss.example.com/stable.jpg')
  })

  it('upstream image exists but no url → text-to-video + reason', () => {
    const src = imageNode('i1') // no URL fields
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [src, videoNode('v1')],
      edges: [edge('i1', 'v1')],
    })
    assert.equal(result.mode, 'text-to-video')
    assert.equal(result.reason, 'upstream_image_missing_url')
    assert.equal(result.sourceImageNodeId, 'i1')
  })

  it('multiple upstream images → picks first connected', () => {
    const i1 = imageNode('i1', { metadataJson: { stableUrl: 'https://oss.example.com/a.jpg' } })
    const i2 = imageNode('i2', { metadataJson: { stableUrl: 'https://oss.example.com/b.jpg' } })
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [i1, i2, videoNode('v1')],
      edges: [edge('i1', 'v1'), edge('i2', 'v1')],
    })
    assert.equal(result.mode, 'image-to-video')
    assert.equal(result.sourceImageNodeId, 'i1')
  })

  it('non-image upstream node is ignored', () => {
    const textNode: WorkflowNode = { id: 't1', kind: 'text', metadataJson: { stableUrl: 'https://ignored.com/x.jpg' } }
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [textNode, videoNode('v1')],
      edges: [edge('t1', 'v1')],
    })
    assert.equal(result.mode, 'text-to-video')
    assert.equal(result.reason, 'no_upstream_image')
  })

  it('non-https url is rejected', () => {
    const src = imageNode('i1', { resultImageUrl: 'data:image/png;base64,abc' })
    const result = resolveImageInputForVideoNode({
      videoNode: videoNode('v1'),
      allNodes: [src, videoNode('v1')],
      edges: [edge('i1', 'v1')],
    })
    assert.equal(result.mode, 'text-to-video')
    assert.equal(result.reason, 'upstream_image_missing_url')
  })
})
