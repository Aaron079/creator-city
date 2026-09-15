import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let roleFails = true
let writeFails = false
let aborted = false
let released = 0
const statements: string[] = []
const client = {
  async query(sql: string) {
    statements.push(sql)
    if (sql.startsWith('ROLLBACK')) { aborted = false; return { rows: [], rowCount: 0 } }
    if (aborted) throw Object.assign(new Error('current transaction is aborted'), { code: '25P02' })
    if (sql.startsWith('SET LOCAL') && roleFails) { aborted = true; throw new Error('role does not exist') }
    if (sql === 'UPDATE test' && writeFails) { aborted = true; throw new Error('write rejected') }
    return { rows: [], rowCount: sql === 'UPDATE test' ? 1 : 0 }
  },
  release() { released++ },
}
loader._load = function (id, ...args) {
  if (id === 'pg') return { Pool: class {
    on() {}
    async connect() { return client }
  } }
  return originalLoad.call(this, id, ...args)
}
let writeQuery: typeof import('../src/db').writeQuery
try { writeQuery = require('../src/db').writeQuery } finally { loader._load = originalLoad }

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
  roleFails = true
  writeFails = aborted = false
  released = 0
  statements.length = 0
})

test('a failed legacy role switch restores the transaction before writing as the connected role', async () => {
  assert.equal(await writeQuery('UPDATE test'), 1)
  assert.ok(statements.indexOf('ROLLBACK TO SAVEPOINT role_switch') < statements.indexOf('UPDATE test'))
  assert.equal(statements.at(-1), 'COMMIT')
  assert.equal(released, 1)
})

test('a permitted legacy role switch still commits normally', async () => {
  roleFails = false
  assert.equal(await writeQuery('UPDATE test'), 1)
  assert.equal(statements.at(-1), 'COMMIT')
  assert.equal(released, 1)
})

test('write failures roll back and release, never retry the write', async () => {
  writeFails = true
  await assert.rejects(writeQuery('UPDATE test'), /write rejected/)
  assert.equal(statements.filter(sql => sql === 'UPDATE test').length, 1)
  assert.equal(statements.at(-1), 'ROLLBACK')
  assert.equal(released, 1)
})
