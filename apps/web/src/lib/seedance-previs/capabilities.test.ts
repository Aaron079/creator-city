import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveSeedanceCapability } from './capabilities'

test('exposes 180 seconds only for an entitled Seedance 2.5 long-take profile', () => {
  const standardProfile = resolveSeedanceCapability({
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
  })
  assert.equal(standardProfile.maxSingleDurationSec, 30)
  assert.equal(standardProfile.maxContinuousDurationSec, 30)
  assert.equal(
    resolveSeedanceCapability({
      model: 'seedance-2.5',
      entryPoint: 'ark',
      entitlement: 'long-take-beta',
    }).maxContinuousDurationSec,
    180,
  )
  assert.equal(
    resolveSeedanceCapability({
      model: 'seedance-2.0',
      entryPoint: 'ark',
      entitlement: 'long-take-beta',
    }).maxContinuousDurationSec,
    30,
  )
})
