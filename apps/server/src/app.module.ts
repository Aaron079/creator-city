import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'

// ─── Config ──────────────────────────────────────────────────────────────────
import { appConfig, databaseConfig, redisConfig, jwtConfig } from './config'

// ─── Feature Modules (v2) ────────────────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { LandsModule } from './modules/lands/lands.module'
import { BuildingsModule } from './modules/buildings/buildings.module'
import { AgentsModule } from './modules/agents/agents.module'
import { AgentRuntimeModule } from './modules/agent-runtime/agent-runtime.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { CollaborationModule } from './modules/collaboration/collaboration.module'
import { CanvasModule } from './modules/canvas/canvas.module'
import { AssetModule } from './modules/asset/asset.module'
import { CommunitiesModule } from './modules/communities/communities.module'
import { ShowcasesModule } from './modules/showcases/showcases.module'
import { EconomyModule } from './modules/economy/economy.module'
import { ProvidersModule } from './modules/providers/providers.module'
import { RouterModule } from './modules/router/router.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { RealtimeModule } from './modules/realtime/realtime.module'

// Legacy modules (kept for backward compat, not loaded into main module)
// import { CityModule } from './modules/city/city.module'
// import { GatewayModule } from './modules/gateway/gateway.module'

@Module({
  imports: [
    // ─── Infrastructure ────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
    }),

    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1_000,  limit: 20  },
      { name: 'medium', ttl: 10_000, limit: 100 },
      { name: 'long',   ttl: 60_000, limit: 300 },
    ]),

    PrismaModule,

    // ─── Feature modules ───────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    LandsModule,
    BuildingsModule,
    AgentsModule,
    AgentRuntimeModule,
    ProjectsModule,
    CollaborationModule,
    CanvasModule,
    AssetModule,
    CommunitiesModule,
    ShowcasesModule,
    EconomyModule,
    ProvidersModule,
    RouterModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
