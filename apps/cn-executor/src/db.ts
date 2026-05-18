import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set in cn-executor environment')
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    })
    pool.on('error', (err: Error) => {
      console.error('[cn-executor][db] pool error:', err.message)
    })
  }
  return pool
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[],
): Promise<T[]> {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, values)
    return result.rows as T[]
  } finally {
    client.release()
  }
}
