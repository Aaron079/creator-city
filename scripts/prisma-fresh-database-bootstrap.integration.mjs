import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const schema = readFileSync(`${root}/apps/server/prisma/schema.prisma`, 'utf8')
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1])
const enums = [...schema.matchAll(/^enum\s+(\w+)/gm)].map((match) => match[1])
const containerName = `creator-city-prisma-bootstrap-${process.pid}`
const databaseName = 'creator_city_bootstrap'
const postgresPassword = 'creator_city_disposable_test'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
  return result.stdout
}

function values(names) {
  return names.map((name) => `('${name.replaceAll("'", "''")}')`).join(', ')
}

function queryPostgres(sql) {
  return run('docker', [
    'exec',
    '-e',
    `PGPASSWORD=${postgresPassword}`,
    containerName,
    'psql',
    '-U',
    'postgres',
    '-d',
    databaseName,
    '-At',
    '-c',
    sql,
  ]).trim()
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', databaseName]).status === 0) {
      return
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  throw new Error('disposable PostgreSQL did not become ready')
}

function missingTables() {
  return queryPostgres(`
    WITH expected(name) AS (VALUES ${values(models)})
    SELECT string_agg(expected.name, ',')
    FROM expected
    LEFT JOIN information_schema.tables actual
      ON actual.table_schema = 'public'
      AND actual.table_name = expected.name
    WHERE actual.table_name IS NULL
  `)
}

function missingEnums() {
  return queryPostgres(`
    WITH expected(name) AS (VALUES ${values(enums)})
    SELECT string_agg(expected.name, ',')
    FROM expected
    LEFT JOIN pg_type actual
      ON actual.typname = expected.name
    LEFT JOIN pg_namespace namespace
      ON namespace.oid = actual.typnamespace
      AND namespace.nspname = 'public'
    WHERE namespace.oid IS NULL
  `)
}

try {
  run('docker', [
    'run',
    '-d',
    '--rm',
    '--name',
    containerName,
    '-e',
    `POSTGRES_PASSWORD=${postgresPassword}`,
    '-e',
    `POSTGRES_DB=${databaseName}`,
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  ])
  waitForPostgres()

  const port = run('docker', ['port', containerName, '5432/tcp']).trim().match(/:(\d+)$/)?.[1]
  assert.ok(port, 'Docker must publish a localhost PostgreSQL port')

  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:${postgresPassword}@127.0.0.1:${port}/${databaseName}?schema=public`,
  }
  const prismaArgs = ['--filter', 'server', 'exec', 'prisma']

  run('pnpm', [...prismaArgs, 'migrate', 'deploy', '--schema=prisma/schema.prisma'], { env })
  run('pnpm', [...prismaArgs, 'migrate', 'status', '--schema=prisma/schema.prisma'], { env })

  assert.equal(missingTables(), '', 'all Prisma model tables must exist after migrate deploy')
  assert.equal(missingEnums(), '', 'all Prisma enum types must exist after migrate deploy')

  const secondDeploy = run('pnpm', [...prismaArgs, 'migrate', 'deploy', '--schema=prisma/schema.prisma'], { env })
  assert.match(secondDeploy, /No pending migrations/i)
} finally {
  spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })
}
