import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  name: process.env['APP_NAME'] ?? 'Creator City',
  env: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['SERVER_PORT'] ?? '4000', 10),
  host: process.env['SERVER_HOST'] ?? 'localhost',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  isDev: (process.env['NODE_ENV'] ?? 'development') === 'development',
  isProd: process.env['NODE_ENV'] === 'production',
}))
