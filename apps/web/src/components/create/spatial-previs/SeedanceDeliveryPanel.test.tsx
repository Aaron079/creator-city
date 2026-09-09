import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeSpatialPrevis } from '@/lib/spatial-previs/normalize'
import { resolveSeedanceCapability } from '@/lib/seedance-previs/capabilities'
import { buildSeedanceTakePackage } from '@/lib/seedance-previs/package'
import {
  canSubmitSeedanceDelivery,
  createSeedanceDeliveryPayload,
  SeedanceDeliveryPanel,
} from './SeedanceDeliveryPanel'

const capability = resolveSeedanceCapability({
  model: 'seedance-2.5',
  entryPoint: 'ark',
  entitlement: 'standard',
})

const package180 = buildSeedanceTakePackage({
  previs: normalizeSpatialPrevis({
    projectId: 'project-180',
    durationSec: 180,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }),
  capability,
  deliveryMode: 'direct',
})

const longTakeCapability = resolveSeedanceCapability({
  model: 'seedance-2.5',
  entryPoint: 'ark',
  entitlement: 'long-take-beta',
})

const longTakePackage = buildSeedanceTakePackage({
  previs: normalizeSpatialPrevis({
    projectId: 'project-long-take',
    durationSec: 180,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  }),
  capability: longTakeCapability,
  deliveryMode: 'continuity-chain',
})

test('requires acknowledgement only for the selected chain, not as a silent fallback', () => {
  const html = renderToStaticMarkup(
    <SeedanceDeliveryPanel capability={capability} package={package180} onSubmit={() => {}} />,
  )

  assert.match(html, /seedance-2.5/)
  assert.match(html, /standard/)
  assert.match(html, /直出能力.*30 秒/)
  assert.match(html, /预计连续组接.*6 段/)
  assert.match(html, /type="checkbox"/)
  assert.match(html, /继续直接生成/)
  assert.match(html, /确认使用 30 秒连续组接/)
})

test("shows entitled direct long-take capacity separately from the user's chain request", () => {
  const html = renderToStaticMarkup(
    <SeedanceDeliveryPanel capability={longTakeCapability} package={longTakePackage} onSubmit={() => {}} />,
  )

  assert.match(html, /直出能力.*180 秒/)
  assert.match(html, /用户请求.*30 秒连续组接/)
  assert.match(html, /建议方式.*直接生成/)
})

test('preserves requested and confirmed delivery choices in submitted payloads', () => {
  const selection = {
    requestedMode: 'direct' as const,
    confirmedMode: 'continuity-chain' as const,
    acknowledgedFindingIds: ['continuity-chain-recommended'],
  }

  const payload = createSeedanceDeliveryPayload(selection)

  assert.deepEqual(payload, selection)
  assert.notEqual(payload.acknowledgedFindingIds, selection.acknowledgedFindingIds)
  assert.ok(Object.isFrozen(payload))
  assert.ok(Object.isFrozen(payload.acknowledgedFindingIds))
  assert.throws(() => (payload.acknowledgedFindingIds as string[]).push('mutate'), TypeError)
  assert.deepEqual(selection, {
    requestedMode: 'direct',
    confirmedMode: 'continuity-chain',
    acknowledgedFindingIds: ['continuity-chain-recommended'],
  })
})

test('allows direct submission without acknowledgement but requires it for a selected chain', () => {
  assert.equal(canSubmitSeedanceDelivery('direct', false), true)
  assert.equal(canSubmitSeedanceDelivery('continuity-chain', false), false)
  assert.equal(canSubmitSeedanceDelivery('continuity-chain', true), true)
})
