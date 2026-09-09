import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, '..', 'VisualCanvasWorkspace.tsx'), 'utf8')
const promptBoxSource = readFileSync(resolve(testDirectory, '..', 'CanvasPromptBox.tsx'), 'utf8')
const panelSource = readFileSync(resolve(testDirectory, '..', 'spatial-previs', 'SpatialPrevisDirectorPanel.tsx'), 'utf8')

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  assert.ok(start >= 0, `missing start marker: ${startMarker}`)
  const end = source.indexOf(endMarker, start)
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`)
  return source.slice(start, end)
}

test('opens spatial previs through the modal coordinator with a non-persisted first-use default', () => {
  assert.match(workspaceSource, /import \{ normalizeSpatialPrevis \} from '@\/lib\/spatial-previs\/normalize'/)
  assert.match(workspaceSource, /const \[spatialPrevis, setSpatialPrevis\] = useState<SpatialPrevisState \| null>\(null\)/)
  assert.match(workspaceSource, /const \[isSpatialPrevisOpen, setIsSpatialPrevisOpen\] = useState\(false\)/)

  const resetSource = sourceBetween(workspaceSource, 'const resetCanvasModalStates = useCallback', 'const closeCanvasPanel')
  assert.match(resetSource, /setIsSpatialPrevisOpen\(false\)/)

  const openSource = sourceBetween(workspaceSource, "case 'spatial-previs':", "case 'generation':")
  assert.match(openSource, /setSpatialPrevis\(\(current\) => current \?\? normalizeSpatialPrevis\(\{ projectId \}\)\)/)
  assert.match(openSource, /setIsSpatialPrevisOpen\(true\)/)
  assert.doesNotMatch(openSource, /handleSaveSpatialPrevis|fetch\(/)

  assert.match(
    workspaceSource,
    /\/\/ Confirmed experience impact: none[\s\S]*?\{isSpatialPrevisOpen && saveStatus !== 'opening' && spatialPrevis \? \(\s*<div[\s\S]*?<SpatialPrevisDirectorPanel/,
  )
  const mountSource = sourceBetween(workspaceSource, "{isSpatialPrevisOpen && saveStatus !== 'opening'", '{isContinuityCheckerOpen')
  assert.match(
    mountSource,
    /className="fixed inset-0 z-\[2601\] flex items-end justify-center bg-black\/25 sm:items-center"/,
  )
  assert.match(mountSource, /data-no-node-drag="true"/)
  assert.match(mountSource, /initialState=\{spatialPrevis\}/)
  assert.match(mountSource, /onSave=\{handleSaveSpatialPrevis\}/)
  assert.match(mountSource, /onClose=\{\(\) => closeCanvasPanel\(\)\}/)
})

test('keeps the spatial previs surface out of CanvasPromptBox', () => {
  assert.doesNotMatch(promptBoxSource, /spatial-previs|SpatialPrevis|空间预演/)
})

test('only reports spatial previs save feedback after a successful save', () => {
  assert.match(panelSource, /const \[saveSuccess, setSaveSuccess\] = useState<string \| null>\(null\)/)

  const handleSaveSource = sourceBetween(panelSource, 'const handleSave = async () => {', '\n\n  return (')
  assert.match(handleSaveSource, /setSaveSuccess\(null\)/)
  assert.match(handleSaveSource, /if \(result === 'success'\) setSaveSuccess\('预演已保存'\)/)
  assert.match(handleSaveSource, /if \(result === 'failed'\) setSaveError\('保存预演失败。'\)/)
  assert.match(panelSource, /\{saveSuccess \? <p role="status"[^>]*>\{saveSuccess\}<\/p> : null\}/)
})
