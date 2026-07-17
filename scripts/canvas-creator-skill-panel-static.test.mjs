import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const panelUrl = new URL(
  '../apps/web/src/components/create/canvas/skills/CreatorSkillRunPanel.tsx',
  import.meta.url,
)
const segmentationUrl = new URL(
  '../apps/web/src/components/create/canvas/skills/ScriptSegmentationPanel.tsx',
  import.meta.url,
)

const panel = readFileSync(panelUrl, 'utf8')
const segmentation = readFileSync(segmentationUrl, 'utf8')

describe('Creator Skill review panel static boundary', () => {
  test('generic shell exposes the required review contract and stable controls', () => {
    assert.match(panel, /manifest:\s*CreatorSkillManifest/)
    assert.match(panel, /result:\s*CreatorSkillRunResult/)
    assert.match(panel, /canApply:\s*boolean/)
    assert.match(panel, /applyLabel:\s*string/)
    assert.match(panel, /onRerun:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /onApply:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /onClose:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /children:\s*React\.ReactNode/)

    for (const testId of [
      'creator-skill-panel',
      'creator-skill-status',
      'creator-skill-rerun',
      'creator-skill-apply',
      'creator-skill-close',
    ]) {
      assert.match(panel, new RegExp(`data-testid=["']${testId}["']`))
    }
  })

  test('generic shell renders manifest identity and every result review channel', () => {
    assert.match(panel, /manifest\.name/)
    assert.match(panel, /manifest\.version/)
    assert.match(panel, /result\.status/)
    assert.match(panel, /result\.warnings\.map/)
    assert.match(panel, /result\.blockers\.map/)
    assert.match(panel, /result\.evidence\.map/)
    assert.match(panel, /evidence\.excerpt/)
  })

  test('generic apply control reflects the canApply disabled state', () => {
    const applyControl = panel
      .match(/<button\b[^>]*>/gs)
      ?.find((tag) => /data-testid=["']creator-skill-apply["']/.test(tag))

    assert.ok(applyControl, 'generic apply control should exist')
    assert.match(applyControl, /disabled=\{!canApply\}/)
  })

  test('segmentation runs locally from a fresh source snapshot on open and rerun', () => {
    assert.match(segmentation, /import\s+\{[^}]*runCreatorSkill[^}]*\}\s+from\s+['"]@\/lib\/skills['"]/s)
    assert.match(
      segmentation,
      /export function runScriptSegmentationReview\(\s*sourceNode:\s*CreatorSkillSourceNode/,
    )
    assert.match(
      segmentation,
      /runCreatorSkill\(\s*['"]script-segmentation['"]\s*,\s*\{\s*sourceNodes:\s*\[[^\]]+\]/s,
    )
    assert.doesNotMatch(segmentation, /sourceNodes:\s*\[sourceNode\]/)
    assert.ok(
      segmentation.match(/runScriptSegmentationReview\(sourceNode\)/g)?.length >= 2,
      'the component should create a review batch on open and on explicit rerun',
    )
  })

  test('segmentation narrows the Artifact and keeps review state local and unapproved', () => {
    assert.match(segmentation, /artifactType\s*!==\s*['"]scene-breakdown['"]/)
    assert.match(segmentation, /artifactVersion\s*!==\s*1/)
    assert.match(segmentation, /approved:\s*false/)
    assert.match(segmentation, /field:\s*['"]heading['"]\s*\|\s*['"]sourceText['"]/)
    assert.match(segmentation, /data-testid=["']script-segmentation-scene-list["']/)
    assert.match(segmentation, /data-testid=["']script-segmentation-scene-checkbox["']/)
    assert.match(segmentation, /scene\.lineStart/)
    assert.match(segmentation, /scene\.lineEnd/)
    assert.match(segmentation, /evidence\.excerpt/)
  })

  test('apply is approval-gated and materializes only exact-batch create plans', () => {
    assert.match(segmentation, /result\.status\s*!==\s*['"]blocked['"]/)
    assert.match(segmentation, /approvedCount\s*>\s*0/)
    assert.match(segmentation, /canApply=\{canApply\}/)
    assert.match(segmentation, /planScriptSceneMaterialization\(\{/)
    assert.match(
      segmentation,
      /approvalContext:\s*\{\s*runFingerprint:\s*result\.runFingerprint,\s*sourceArtifactId:\s*artifact\.artifactId,?\s*\}/s,
    )
    assert.match(segmentation, /approvedScenes/)
    assert.match(segmentation, /existingNodes/)
    assert.match(segmentation, /planned\.duplicates/)
    assert.match(segmentation, /data-testid=["']script-segmentation-duplicates["']/)
    assert.match(segmentation, /onApply\(planned\.create\)/)
    assert.doesNotMatch(segmentation, /onApply\(planned\)/)
  })

  test('review panels remain independent of remote generation and legacy skills', () => {
    const source = `${panel}\n${segmentation}`
    assert.doesNotMatch(source, /fetch\s*\(/)
    assert.doesNotMatch(source, /\/api\/generate\//i)
    assert.doesNotMatch(source, /\bProvider\b/)
    assert.doesNotMatch(source, /billing|credits|wallet|payment|recharge|checkout/i)
    assert.doesNotMatch(source, /@\/lib\/ai\/skills|apps\/web\/src\/lib\/ai\/skills/)
  })
})
