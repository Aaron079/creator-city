const REQUIRED_ENV_KEYS = [
  'VOLCENGINE_ARK_API_KEY',
  'VOLCENGINE_SEEDREAM_MODEL',
  'VOLCENGINE_SEEDANCE_MODEL',
  'ALIYUN_OSS_ACCESS_KEY_ID',
  'ALIYUN_OSS_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_ENDPOINT',
  'CREATOR_EXECUTOR_SHARED_SECRET',
] as const

export type EnvKey = (typeof REQUIRED_ENV_KEYS)[number]

export function hasEnv(key: string): boolean {
  return Boolean(process.env[key]?.trim())
}

export function getEnvPresence(): Record<EnvKey, boolean> {
  return Object.fromEntries(
    REQUIRED_ENV_KEYS.map((key) => [key, hasEnv(key)]),
  ) as Record<EnvKey, boolean>
}

export function getMissingEnv(): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !hasEnv(key))
}

export function getSharedSecret(): string {
  return process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
}
