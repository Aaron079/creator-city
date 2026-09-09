import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateRegistry, verifyRegistry } from './verify-confirmed-experience-locks.mjs'

const registryPath = 'docs/CONFIRMED_EXPERIENCE_LOCKS.json'
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const verifierPath = fileURLToPath(new URL('./verify-confirmed-experience-locks.mjs', import.meta.url))

const expectedLocks = [
  ['node-editor-anchor', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['prompt-editor-fixed-regions', ['apps/web/src/components/create/CanvasPromptBox.tsx', 'apps/web/src/components/create/canvas.module.css'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['node-editor-coupled-drag', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['four-edge-resize-without-handles', ['apps/web/src/components/create/CanvasNodeCard.tsx', 'apps/web/src/components/create/CanvasPromptBox.tsx', 'apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasResizeGeometry.ts', 'apps/web/src/components/create/canvas.module.css'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx', 'apps/web/src/components/create/canvas/secondaryClickSequence.test.ts']],
  ['node-context-menu-actions', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/CanvasNodeCard.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
  ['canvas-context-menu-actions', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
  ['safari-canvas-context-menu-capture', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/CanvasNodeCard.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
]

function fixtureRegistry() {
  return {
    version: 1,
    locks: [{
      id: 'fixture-lock',
      title: 'Fixture lock',
      owners: ['apps/web/owner.ts'],
      checks: ['apps/web/check.test.ts'],
    }],
  }
}

const temporaryRoots = []

function createFixture(registry = fixtureRegistry()) {
  const root = mkdtempSync(join(tmpdir(), 'confirmed-experience-locks-'))
  temporaryRoots.push(root)
  for (const lock of registry.locks ?? []) {
    for (const path of [...(lock.owners ?? []), ...(lock.checks ?? [])]) {
      if (typeof path === 'string' && path.startsWith('apps/web/')) {
        const filePath = join(root, path)
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, '')
      }
    }
  }
  const filePath = join(root, registryPath)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(registry))
  return root
}

afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true })
})

describe('confirmed experience lock verifier', () => {
  test('enforces confirmed experience checks in repository policy and scripts', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    const agentLoopCheck = readFileSync(new URL('./agent-loop-check.mjs', import.meta.url), 'utf8')
    const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')

    assert.equal(packageJson.scripts['experience:check'], 'node scripts/verify-confirmed-experience-locks.mjs')
    assert.match(packageJson.scripts['agent:check'], /node scripts\/agent-loop-check\.mjs/)
    assert.match(packageJson.scripts['agent:check'], /node scripts\/verify-confirmed-experience-locks\.mjs/)
    assert.match(agentLoopCheck, /\{ key: 'CONFIRMED_EXPERIENCE_LOCKS', path: 'docs\/CONFIRMED_EXPERIENCE_LOCKS\.json' \}/)
    assert.match(agentLoopCheck, /canvas work requires `pnpm experience:check` plus lock-listed focused checks before completion\./)

    for (const token of [
      '## Confirmed Experience Locks',
      'Before changing canvas code, read `docs/CONFIRMED_EXPERIENCE_LOCKS.json`.',
      'Existing approved canvas experience is additive-only.',
      'Do not move, restyle, remove, or weaken a registered lock without a founder-approved exception.',
      'Every canvas task and delivery must state either `Confirmed experience impact: none` or name exact lock plus founder approval record.',
      'Run `pnpm experience:check` with listed focused checks before describing canvas work complete.',
    ]) {
      assert.ok(agents.includes(token), `AGENTS.md is missing policy token: ${token}`)
    }
  })

  test('matches the committed registry contract and verifies its repository files', () => {
    const registry = JSON.parse(readFileSync(new URL(`../${registryPath}`, import.meta.url), 'utf8'))

    assert.equal(registry.policy, 'Founder-approved canvas experience is additive-only unless a documented exception is approved.')
    assert.deepEqual(registry.declaration, {
      unaffected: 'Confirmed experience impact: none',
      exception: 'Confirmed experience exception: <lock id>\nFounder approval: <approval record or task link>',
    })
    assert.deepEqual(
      registry.locks.map(({ id, owners, checks }) => [id, owners, checks]),
      expectedLocks,
    )
    assert.deepEqual(verifyRegistry({ root: repositoryRoot, registryPath }), [])
  })

  test('reports a missing lock id', () => {
    const registry = fixtureRegistry()
    registry.locks[0].id = ''

    assert.deepEqual(validateRegistry(registry), ['Lock is missing id.'])
  })

  test('reports a duplicate lock id', () => {
    const registry = fixtureRegistry()
    registry.locks.push({ ...registry.locks[0] })

    assert.deepEqual(validateRegistry(registry), ['Duplicate lock id: fixture-lock'])
  })

  test('reports missing owner and check files', () => {
    const root = createFixture()
    rmSync(join(root, 'apps/web/owner.ts'))
    rmSync(join(root, 'apps/web/check.test.ts'))

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'fixture-lock: missing owner file: apps/web/owner.ts',
      'fixture-lock: missing check file: apps/web/check.test.ts',
    ])
  })

  test('rejects paths that escape the repository root', () => {
    const registry = fixtureRegistry()
    registry.locks[0].owners = ['../outside.ts']
    const root = createFixture(registry)

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'fixture-lock: path escapes repository root: ../outside.ts',
    ])
  })

  test('rejects backslash separators and Windows absolute paths', () => {
    const registry = fixtureRegistry()
    registry.locks[0].owners = ['..\\outside.ts']
    registry.locks[0].checks = ['C:\\escape.ts']
    const root = createFixture(registry)

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'fixture-lock: path escapes repository root: ..\\outside.ts',
      'fixture-lock: path escapes repository root: C:\\escape.ts',
    ])
  })

  test('rejects absolute paths even when they are inside the repository root', () => {
    const root = createFixture()
    const absoluteOwnerPath = join(root, 'apps/web/owner.ts')
    const registry = fixtureRegistry()
    registry.locks[0].owners = [absoluteOwnerPath]
    writeFileSync(join(root, registryPath), JSON.stringify(registry))

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      `fixture-lock: path escapes repository root: ${absoluteOwnerPath}`,
    ])
  })

  test('rejects directories referenced as owner and check files', () => {
    const root = createFixture()
    const registry = fixtureRegistry()
    registry.locks[0].owners = ['apps/web/owner-directory']
    registry.locks[0].checks = ['apps/web/check-directory']
    mkdirSync(join(root, registry.locks[0].owners[0]))
    mkdirSync(join(root, registry.locks[0].checks[0]))
    writeFileSync(join(root, registryPath), JSON.stringify(registry))

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'fixture-lock: missing owner file: apps/web/owner-directory',
      'fixture-lock: missing check file: apps/web/check-directory',
    ])
  })

  test('rejects owner and check symlinks that resolve outside the fixture root', () => {
    const root = createFixture()
    const outsideRoot = mkdtempSync(join(tmpdir(), 'confirmed-experience-locks-outside-'))
    temporaryRoots.push(outsideRoot)
    const outsideFile = join(outsideRoot, 'outside.ts')
    writeFileSync(outsideFile, '')
    const registry = fixtureRegistry()
    registry.locks[0].owners = ['apps/web/external-owner.ts']
    registry.locks[0].checks = ['apps/web/external-check.ts']
    symlinkSync(outsideFile, join(root, registry.locks[0].owners[0]))
    symlinkSync(outsideFile, join(root, registry.locks[0].checks[0]))
    writeFileSync(join(root, registryPath), JSON.stringify(registry))

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'fixture-lock: missing owner file: apps/web/external-owner.ts',
      'fixture-lock: missing check file: apps/web/external-check.ts',
    ])
  })

  for (const option of ['--root', '--registry']) {
    test(`prints a normal error when ${option} has no value`, () => {
      const result = spawnSync(process.execPath, [verifierPath, option], { encoding: 'utf8' })

      assert.equal(result.status, 1)
      assert.equal(result.stdout, '')
      assert.equal(result.stderr, `[ERROR] Missing value for ${option}.\n`)
    })
  }
})
