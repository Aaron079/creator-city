import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveSeedanceCapability } from './capabilities'
import { adviseSeedanceDelivery } from './advisory'

test('recommends a chain for 180 seconds without long-take access but keeps direct generation selectable', () => {
  const advice = adviseSeedanceDelivery({
    requestedDurationSec: 180,
    capability: resolveSeedanceCapability({
      model: 'seedance-2.5',
      entryPoint: 'ark',
      entitlement: 'standard',
    }),
    coverageFindings: [],
  })

  assert.equal(advice.recommendedMode, 'continuity-chain')
  assert.deepEqual(advice.findings, [{
    id: 'continuity-chain-recommended',
    code: 'CONTINUITY_CHAIN_RECOMMENDED',
    severity: 'advisory',
    blocking: false,
    message: 'The requested 180-second take exceeds the active direct delivery duration.',
    remedy: 'Confirm the 30-second continuity chain, or continue with direct generation.',
  }])
  assert.ok(advice.findings.every((finding) => finding.blocking === false))
})
