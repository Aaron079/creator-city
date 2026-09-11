import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, '..', 'VisualCanvasWorkspace.tsx'), 'utf8')
const promptBoxSource = readFileSync(resolve(testDirectory, '..', 'CanvasPromptBox.tsx'), 'utf8')
const panelSource = readFileSync(resolve(testDirectory, '..', 'spatial-previs', 'SpatialPrevisDirectorPanel.tsx'), 'utf8')
const frameSource = readFileSync(resolve(testDirectory, '..', '..', 'canvas', 'tools', 'DirectorToolPanelFrame.tsx'), 'utf8')

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
    /className="fixed inset-0 z-\[3000\] flex items-end justify-center bg-black\/25 sm:items-center"/,
  )
  assert.match(mountSource, /data-spatial-previs-overlay="true"/)
  assert.match(mountSource, /data-no-node-drag="true"/)
  assert.match(mountSource, /onWheel=\{\(event\) => event\.stopPropagation\(\)\}/)
  assert.doesNotMatch(mountSource, /onWheelCapture/)
  assert.match(mountSource, /initialState=\{spatialPrevis\}/)
  assert.match(mountSource, /onSave=\{handleSaveSpatialPrevis\}/)
  assert.match(mountSource, /onReload=\{handleReloadSpatialPrevis\}/)
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

test('lets the spatial R3F canvas receive wheel events while preserving non-spatial frame isolation', () => {
  assert.match(frameSource, /allowNestedWheel\?: boolean/)
  assert.match(frameSource, /allowNestedWheel = false/)
  assert.match(frameSource, /onWheelCapture=\{allowNestedWheel \? undefined : \(e\) => e\.stopPropagation\(\)\}/)
  assert.match(panelSource, /<DirectorToolPanelFrame[\s\S]*?allowNestedWheel/)
})

test('locks spatial editor mutations during pending save and exposes explicit conflict recovery', () => {
  assert.match(panelSource, /const isBusy = isSaving \|\| isReloading/)
  assert.match(panelSource, /aria-busy=\{isBusy\}/)
  assert.match(panelSource, /if \(!canMutateSpatialPrevisEditor\(isBusy\)\) return/)
  assert.match(panelSource, /disabled=\{isBusy\}/)
  assert.match(panelSource, /保存冲突/)
  assert.match(panelSource, /重新加载预演/)
})

test('releases an incomplete canvas initialization after effect cleanup', () => {
  const initializationSource = sourceBetween(workspaceSource, 'useEffect(() => {\n    let cancelled = false', '  }, [applyCanvasSnapshot')

  assert.match(initializationSource, /let initializationCompleted = false/)
  assert.equal((initializationSource.match(/initializationCompleted = true/g) ?? []).length, 2)
  assert.match(initializationSource, /if \(!initializationCompleted && initStartedRef\.current === initKey\) initStartedRef\.current = ''/)
})

test('enables the internal spatial test control in the real workspace without changing the delivery actions', () => {
  const mountSource = sourceBetween(workspaceSource, "{isSpatialPrevisOpen && saveStatus !== 'opening'", '{isContinuityCheckerOpen')

  assert.match(workspaceSource, /useEffect\(\(\) => \{\s*spatialPrevisOpenRef\.current = isSpatialPrevisOpen[\s\S]*?spatialPrevisPollAbortRef\.current\?\.abort\(\)[\s\S]*?\}, \[isSpatialPrevisOpen\]\)/)
  assert.match(mountSource, /onRunSpatialPrevisTest=\{handleRunSpatialPrevisTest\}/)
  assert.match(mountSource, /onCreateDeliveryNode=\{handleCreateSpatialPrevisDeliveryNode\}/)
  assert.match(mountSource, /onDownloadDeliveryPackage=\{handleDownloadSpatialPrevisDeliveryPackage\}/)
  assert.match(mountSource, /onSaveDeliveryPackageToAssets=\{handleSaveSpatialPrevisDeliveryPackageToAssets\}/)
})
