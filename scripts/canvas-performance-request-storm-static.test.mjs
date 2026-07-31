import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const workspacePath = new URL('apps/web/src/components/create/VisualCanvasWorkspace.tsx', root)
const cardPath = new URL('apps/web/src/components/create/CanvasNodeCard.tsx', root)
const layerPath = new URL('apps/web/src/components/create/canvas/CanvasNodeLayer.tsx', root)

const workspace = readFileSync(workspacePath, 'utf8')
const card = readFileSync(cardPath, 'utf8')
const cardAvailabilityProps = [
  'canOpenPromptInspector',
  'canOpenMediaDiagnostics',
  'canCreateStableCopy',
  'canRecoverMedia',
  'canRegenerateFromPrompt',
  'canOpenSkillPanel',
  'canOpenCreativeAssets',
  'canOpenAssetIntelligence',
  'canAddToStoryboard',
  'canContinueWorkflow',
  'canCreateDerivedVideo',
  'canOpenGenerationDialog',
]

test('canvas node layer memoizes planner state through a card props factory', () => {
  assert.ok(existsSync(layerPath), 'CanvasNodeLayer integration is absent')
  const layer = readFileSync(layerPath, 'utf8')

  assert.match(layer, /memo\(/)
  assert.match(layer, /canvasNodeLayerPropsEqual/)
  assert.match(layer, /createCardProps/)
  assert.match(layer, /generationHealth/)
  assert.match(layer, /previous\.createCardProps === next\.createCardProps/)
  assert.match(layer, /previous\.cardPropsFactoryRef === next\.cardPropsFactoryRef/)
  assert.match(layer, /cardPropsFactoryRef\.current\(props\)/)
  for (const availability of cardAvailabilityProps) {
    assert.match(layer, new RegExp(availability))
  }
  assert.doesNotMatch(layer, /initialCardProps\.on/)
})

test('workspace renders nodes through a stable ref-backed layer factory', () => {
  assert.match(workspace, /nodeCardPropsFactoryRef/)
  assert.match(workspace, /<CanvasNodeLayer/)
  assert.match(workspace, /cardPropsFactoryRef=\{nodeCardPropsFactoryRef\}/)
  const layerStart = workspace.indexOf('<CanvasNodeLayer')
  const layerEnd = workspace.indexOf('/>', layerStart)
  assert.notEqual(layerStart, -1)
  assert.notEqual(layerEnd, -1)
  const layerInvocation = workspace.slice(layerStart, layerEnd)
  for (const availability of cardAvailabilityProps) {
    assert.match(layerInvocation, new RegExp(`\\b${availability}(?:=|\\s)`))
  }
})

test('canvas card exposes its existing props API to the rendering layer', () => {
  assert.match(card, /export interface CanvasNodeCardProps/)
})

test('workspace indexes nodes before rendering edges without linear endpoint scans', () => {
  assert.match(workspace, /buildCanvasNodeIndex\(nodes\)/)
  assert.match(workspace, /resolveCanvasEdgeNodes\(nodeById, edge\)/)

  const edgeSurfaceStart = workspace.indexOf('{edges.length > 0 ?')
  assert.notEqual(edgeSurfaceStart, -1)
  const edgeSurface = workspace.slice(edgeSurfaceStart, edgeSurfaceStart + 2600)
  assert.doesNotMatch(edgeSurface, /nodes\.find\(/)
})

test('canvas save and media request storm safeguards stay in place', () => {
  assert.match(workspace, /Autosave is local-only/)
  assert.match(workspace, /Cloud sync only happens when user clicks "保存到云端"/)
  assert.match(card, /Click-to-load overlay/)
  assert.match(card, /preload="metadata"/)
  assert.match(card, /loading="lazy"/)
})
