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
let readFails = false
let poolOptions: Record<string, unknown>
const releases: unknown[] = []
const statements: string[] = []
const client = {
  async query(sql: string) {
    statements.push(sql)
    if (sql === 'SELECT timeout' && readFails) throw new Error('Query read timeout')
    if (sql.startsWith('ROLLBACK')) { aborted = false; return { rows: [], rowCount: 0 } }
    if (aborted) throw Object.assign(new Error('current transaction is aborted'), { code: '25P02' })
    if (sql.startsWith('SET LOCAL') && roleFails) { aborted = true; throw new Error('role does not exist') }
    if (sql === 'UPDATE test' && writeFails) { aborted = true; throw new Error('write rejected') }
    return { rows: [], rowCount: sql === 'UPDATE test' ? 1 : 0 }
  },
  release(error?: unknown) { released++; releases.push(error) },
}
loader._load = function (id, ...args) {
  if (id === 'pg') return { Pool: class {
    constructor(options: Record<string, unknown>) { poolOptions = options }
    on() {}
    async connect() { return client }
  } }
  return originalLoad.call(this, id, ...args)
}
let writeQuery: typeof import('../src/db').writeQuery
let query: typeof import('../src/db').query
try { ({ writeQuery, query } = require('../src/db')) } finally { loader._load = originalLoad }

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
  roleFails = true
  writeFails = aborted = false
  released = 0
  readFails = false
  releases.length = 0
  statements.length = 0
})

test('executor queries have a finite timeout instead of waiting indefinitely on a frozen socket', async () => {
  await query('SELECT 1')
  assert.equal(poolOptions.query_timeout, 15_000)
})

test('a timed-out connection is removed from the pool before another job can borrow it', async () => {
  readFails = true
  await assert.rejects(query('SELECT timeout'), /Query read timeout/)
  assert.equal(released, 1)
  assert.equal(releases[0], true)
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
  assert.equal(releases[0], true)
})
