import { decodeJwtPayload } from '@/lib/credits/jwt-decode'

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
}

export function getInternalSecret(): string | null {
  return process.env.INTERNAL_API_SECRET ?? null
}

export function getUserIdFromToken(token: string): string | null {
  return decodeJwtPayload(token)?.sub ?? null
}

export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}
