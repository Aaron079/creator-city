// ─── Config barrel ───────────────────────────────────────────────────────────
// All registerAs config factories. Import from here in AppModule.

export { appConfig } from './app.config'
export { databaseConfig } from './database.config'
export { redisConfig } from './redis.config'
export { jwtConfig } from './jwt.config'

// Type helpers — use with ConfigService.get<AppConfig>('app')
export type AppConfig = ReturnType<typeof import('./app.config').appConfig>
export type DatabaseConfig = ReturnType<typeof import('./database.config').databaseConfig>
export type RedisConfig = ReturnType<typeof import('./redis.config').redisConfig>
export type JwtConfig = ReturnType<typeof import('./jwt.config').jwtConfig>
