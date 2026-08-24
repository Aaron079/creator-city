import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = new URL(
  '../apps/server/prisma/migrations/20260821000000_normalize_fresh_database_bootstrap/migration.sql',
  import.meta.url,
)

test('forward normalization migration is present and additive', () => {
  assert.equal(existsSync(migrationPath), true)
  const sql = readFileSync(migrationPath, 'utf8')

  for (const name of [
    'CanvasWorkflow',
    'CanvasNode',
    'CanvasEdge',
    'CanvasComment',
    'DeliveryShare',
    'DeliveryItem',
    'DeliveryComment',
    'ProviderAccount',
    'ProviderPricingRule',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${name}"`))
  }

  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|TYPE|INDEX|SCHEMA|DATABASE)\b/i)
  assert.doesNotMatch(sql, /\b(TRUNCATE|DELETE\s+FROM|INSERT\s+INTO)\b/i)
  assert.doesNotMatch(sql, /project-canvas-setup\.sql|canvas-comments-setup\.sql/)
})
