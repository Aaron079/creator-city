import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { jsonError, jsonOk, jsonUnauthorized } from '../response'
import { query } from '../db'

type JobDebugRow = {
  id: string
  userId: string
  status: string
  providerId: string
  prompt: string
  input: unknown
  output: unknown
  error: unknown
  errorMessage: string | null
  updatedAt: string
  createdAt: string
  completedAt: string | null
}

function recommendAction(status: string, ageSeconds: number): string {
  if (status === 'SUCCEEDED') return 'Job completed. Check output.resultImageUrl for the image URL.'
  if (status === 'FAILED') return 'Job failed. Check output.errorCode and output.upstreamMessage for details from the provider.'
  if (status === 'CANCELED') return 'Job was canceled.'
  if (status === 'PROCESSING' && ageSeconds > 300) {
    return 'Job stuck in PROCESSING >5 min. cn-executor likely crashed or FC froze after Vercel timeout. Check Aliyun FC invocation logs for this time window.'
  }
  if (status === 'PROCESSING' && ageSeconds > 60) {
    return 'Job in PROCESSING >1 min. cn-executor is still running (Seedream + OSS can take up to 2 min). Wait or check FC logs if no result in 5 min.'
  }
  if (status === 'QUEUED' && ageSeconds > 120) {
    return 'Job stuck in QUEUED >2 min — cn-executor never started processing. Check: (1) CREATOR_EXECUTOR_SHARED_SECRET matches, (2) cn-executor received the POST /api/jobs/run-image request, (3) DATABASE_URL is set in Aliyun FC env.'
  }
  if (status === 'QUEUED') {
    return 'Job queued. cn-executor should pick it up within seconds if the Vercel request succeeded.'
  }
  return 'Unknown status. Check Aliyun FC logs.'
}

export async function handleJobDebug(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  const urlStr = req.url ?? '/'
  const questionIdx = urlStr.indexOf('?')
  const qs = questionIdx >= 0 ? urlStr.slice(questionIdx + 1) : ''
  const params = new URLSearchParams(qs)
  const generationJobId = params.get('generationJobId')?.trim() ?? ''

  if (!generationJobId) {
    jsonError(res, { errorCode: 'invalid_request', message: 'generationJobId query parameter is required.' }, 400)
    return
  }

  // Also check DB connectivity directly
  let dbOk = false
  let dbError: string | null = null
  let job: JobDebugRow | null = null

  try {
    const rows = await query<JobDebugRow>(
      `SELECT id, "userId", status, "providerId", prompt,
              input, output, error, "errorMessage",
              "updatedAt", "createdAt", "completedAt"
       FROM "GenerationJob" WHERE id = $1 LIMIT 1`,
      [generationJobId],
    )
    dbOk = true
    job = rows[0] ?? null
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
    console.error('[cn-executor][jobDebug] DB query failed', { generationJobId, dbError })
  }

  if (!dbOk) {
    jsonOk(res, {
      ok: false,
      generationJobId,
      dbOk: false,
      dbError,
      jobStatus: null,
      message: 'Database query failed — check DATABASE_URL and DB connectivity from Aliyun FC.',
      recommendedNextAction: 'Verify DATABASE_URL is set correctly in Aliyun FC function environment variables. Test DB connectivity from the FC function network.',
    })
    return
  }

  if (!job) {
    jsonOk(res, {
      ok: false,
      generationJobId,
      dbOk: true,
      jobStatus: null,
      message: 'Job not found in database.',
      recommendedNextAction: 'Verify generationJobId is correct and was created by the same DB.',
    })
    return
  }

  const updatedAt = new Date(job.updatedAt)
  const createdAt = new Date(job.createdAt)
  const ageMs = Date.now() - updatedAt.getTime()
  const ageSeconds = Math.floor(ageMs / 1000)
  const totalAgeMs = Date.now() - createdAt.getTime()
  const totalAgeSeconds = Math.floor(totalAgeMs / 1000)

  console.log('[cn-executor][jobDebug] job debug query', {
    generationJobId,
    status: job.status,
    ageSeconds,
    totalAgeSeconds,
  })

  jsonOk(res, {
    ok: true,
    generationJobId,
    dbOk: true,
    jobStatus: job.status,
    providerId: job.providerId,
    input: job.input,
    output: job.output,
    error: job.error,
    errorMessage: job.errorMessage,
    updatedAt: updatedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    ageSeconds,
    totalAgeSeconds,
    recommendedNextAction: recommendAction(job.status, ageSeconds),
  })
}
