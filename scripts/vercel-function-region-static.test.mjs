import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Vercel functions run beside the Tokyo Supabase database', async () => {
  const configUrl = new URL('../apps/web/vercel.json', import.meta.url)
  const config = JSON.parse(await readFile(configUrl, 'utf8'))

  assert.deepEqual(config.regions, ['hnd1'])
})
