import { registerAs } from '@nestjs/config'

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env['JWT_SECRET'] ?? 'dev-secret-CHANGE-IN-PRODUCTION',
  expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
}))
