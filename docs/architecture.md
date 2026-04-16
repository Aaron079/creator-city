# Creator City — Architecture

## Overview

Creator City is a multiplayer AI creative platform built as a **monorepo** with three main packages.

```
creator-city/
├── apps/
│   ├── web/        Next.js 14 App Router frontend
│   └── server/     NestJS backend API + WebSocket gateway
└── packages/
    └── shared/     Shared TypeScript types
```

---

## Frontend (apps/web)

- **Framework**: Next.js 14 App Router
- **State**: Zustand stores (auth, city, project, agent)
- **Styling**: Tailwind CSS with custom city design tokens
- **Animation**: Framer Motion
- **3D**: Three.js / React Three Fiber (reserved — city world scene)
- **Real-time**: Socket.io-client → `/city` namespace

### Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/login` | Login |
| `/auth/register` | Registration |
| `/dashboard` | Main hub |
| `/city` | Live city map |
| `/projects` | Project management |
| `/agents` | AI agent roster |

### Stores

- `auth.store` — JWT token + user, persisted in localStorage
- `city.store` — Base, buildings, city map data
- `project.store` — User's projects
- `agent.store` — AI agent list + tasks

---

## Backend (apps/server)

- **Framework**: NestJS
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis (rate limiting, session cache)
- **Auth**: JWT + Passport (local + JWT strategies)
- **WebSocket**: Socket.io via NestJS `@WebSocketGateway`

### Module Map

```
AppModule
├── AuthModule      → /api/v1/auth
├── UserModule      → /api/v1/users
├── CityModule      → /api/v1/city
├── ProjectModule   → /api/v1/projects
├── AgentModule     → /api/v1/agents
├── AssetModule     → /api/v1/assets
├── ChatModule      → /api/v1/chat
├── GatewayModule   → ws://.../city  (Socket.io)
└── PrismaModule    (global)
```

### API Conventions

- All routes prefixed `/api/v1`
- JWT Bearer auth via `Authorization: Bearer <token>`
- Validation via `class-validator` + `ValidationPipe`
- Swagger UI at `/api/docs` (dev only)

---

## Shared (packages/shared)

Pure TypeScript types, no runtime dependencies.

| File | Contents |
|------|----------|
| `user.types.ts` | User, UserProfile, AuthTokenPayload |
| `city.types.ts` | CityBase, Building, WorldPosition |
| `agent.types.ts` | Agent, AgentTask, AgentSkill |
| `project.types.ts` | Project, ProductionPhase, PhaseTask |
| `asset.types.ts` | Asset, AssetMetadata, AssetVersion |
| `socket.types.ts` | ServerToClientEvents, ClientToServerEvents |

---

## Data Flow

```
Browser ──HTTP──► NestJS API ──► Prisma ──► PostgreSQL
       ──WS────► CityGateway ──► broadcast to rooms
```

---

## Roadmap (next phases)

1. **Phase 2**: 3D City World (Three.js scene, real-time positions)
2. **Phase 3**: AI agent real execution (OpenAI/Anthropic integration)
3. **Phase 4**: Marketplace (asset trading, project funding)
4. **Phase 5**: Mobile app
