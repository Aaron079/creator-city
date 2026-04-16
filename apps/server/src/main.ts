import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  const configService = app.get(ConfigService)
  const port = configService.get<number>('SERVER_PORT', 4000)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development')

  // ─── Global Pipes ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ─── CORS ─────────────────────────────────────────────────────────
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  })

  // ─── WebSocket Adapter ────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app))

  // ─── API Prefix ───────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1')

  // ─── Swagger (dev only) ───────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Creator City API')
      .setDescription('The Creator City platform API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document)
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`)
  }

  await app.listen(port)
  logger.log(`Server running on http://localhost:${port} [${nodeEnv}]`)
}

bootstrap()
