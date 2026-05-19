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

// Executes a write query (INSERT/UPDATE/DELETE) inside a transaction that attempts to
// bypass Supabase RLS by setting role=postgres. If the bypass SET fails (e.g. insufficient
// privilege), falls back to a plain query. Returns the number of affected rows.
//
// Supabase RLS silently filters rows for direct pg connections where auth.uid() is NULL,
// causing UPDATEs to succeed (no error) but affect 0 rows. Setting role=postgres runs as
// superuser which bypasses all RLS policies.
export async function writeQuery(
  text: string,
  values?: unknown[],
): Promise<number> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    try {
      // Attempt RLS bypass — works when connecting as postgres/superuser.
      // SET LOCAL is scoped to this transaction only (safe with pgBouncer).
      await client.query("SET LOCAL role = 'postgres'")
    } catch (bypassErr) {
      console.warn('[cn-executor][db] role bypass failed, running query without RLS bypass', {
        error: bypassErr instanceof Error ? bypassErr.message : String(bypassErr),
      })
    }
    const result = await client.query(text, values)
    await client.query('COMMIT')
    return result.rowCount ?? 0
  } catch (err) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    throw err
  } finally {
    client.release()
  }
}
