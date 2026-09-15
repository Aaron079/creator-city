import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }

function fixture(run: (load: (url: string) => { datasourceUrl: string }) => void) {
  const originalLoad = loader._load
  const originalEnv = { ...process.env }
  const globals = globalThis as unknown as { prisma?: unknown }
  const originalClient = globals.prisma
  delete globals.prisma
  loader._load = function (id, ...args) {
    if (id === '@prisma/client') return { PrismaClient: class {
      datasourceUrl: string
      constructor(options: { datasourceUrl: string }) { this.datasourceUrl = options.datasourceUrl }
    } }
    return originalLoad.call(this, id, ...args)
  }
  try {
    Object.assign(process.env, { NODE_ENV: 'production' })
    run((url) => {
      process.env.DATABASE_URL = url
      delete require.cache[require.resolve('./db')]
      return require('./db').db
    })
  } finally {
    loader._load = originalLoad
    process.env = originalEnv
    if (originalClient === undefined) delete globals.prisma
    else globals.prisma = originalClient
    delete require.cache[require.resolve('./db')]
  }
}

test('Neon uses prepared statements and a bounded pool suited to concurrent serverless requests', () => fixture((load) => {
  const url = new URL(load('postgresql://user:secret@ep-example-pooler.c-3.ap-southeast-1.aws.neon.tech/db').datasourceUrl)
  assert.notEqual(url.searchParams.get('pgbouncer'), 'true')
  assert.equal(url.searchParams.get('connection_limit'), '5')
  assert.equal(url.searchParams.get('pool_timeout'), '20')
  assert.equal(url.searchParams.get('connect_timeout'), '10')
  assert.equal(url.searchParams.get('socket_timeout'), '15')
  assert.equal(url.searchParams.get('max_idle_connection_lifetime'), '60')
  assert.equal(url.searchParams.get('sslmode'), 'require')
}))

test('explicit connection settings are preserved', () => fixture((load) => {
  const url = new URL(load('postgresql://user:secret@ep-example.neon.tech/db?pgbouncer=true&connection_limit=3&pool_timeout=12&connect_timeout=8&socket_timeout=30&max_idle_connection_lifetime=90&sslmode=verify-full').datasourceUrl)
  assert.equal(url.searchParams.get('pgbouncer'), 'true')
  assert.equal(url.searchParams.get('connection_limit'), '3')
  assert.equal(url.searchParams.get('pool_timeout'), '12')
  assert.equal(url.searchParams.get('connect_timeout'), '8')
  assert.equal(url.searchParams.get('socket_timeout'), '30')
  assert.equal(url.searchParams.get('max_idle_connection_lifetime'), '90')
  assert.equal(url.searchParams.get('sslmode'), 'verify-full')
}))

test('other databases retain their existing pool compatibility settings', () => fixture((load) => {
  const url = new URL(load('postgresql://user:secret@aws-0.pooler.supabase.com/db').datasourceUrl)
  assert.equal(url.searchParams.get('pgbouncer'), 'true')
  assert.equal(url.searchParams.get('connection_limit'), '2')
  assert.equal(url.searchParams.get('pool_timeout'), '6')
}))

test('production module reloads share one Prisma pool', () => fixture((load) => {
  const url = 'postgresql://user:secret@ep-example.neon.tech/db'
  assert.equal(load(url), load(url))
}))
