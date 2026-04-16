# Creator City

> A multiplayer online AI creative city — build your base, hire AI agents, produce films, collaborate with creators worldwide.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 · React · TypeScript · Tailwind CSS · Zustand · Framer Motion · Three.js |
| Backend | NestJS · TypeScript · Prisma · PostgreSQL · Redis · Socket.io |
| Shared | TypeScript types (user, city, agent, project, asset, socket) |
| Tooling | pnpm workspaces · ESLint · Prettier |

---

## Project Structure

```
creator-city/
├── apps/
│   ├── web/                 # Next.js frontend (port 3000)
│   │   └── src/
│   │       ├── app/         # App Router pages
│   │       ├── components/  # UI components
│   │       ├── store/       # Zustand stores
│   │       └── lib/         # API client, socket, utils
│   └── server/              # NestJS backend (port 4000)
│       ├── src/
│       │   ├── modules/     # auth, user, city, project, agent, asset, chat, gateway
│       │   └── prisma/      # PrismaService + PrismaModule
│       └── prisma/
│           └── schema.prisma
├── packages/
│   └── shared/              # Shared TypeScript types
│       └── src/types/
├── docs/
│   └── architecture.md
├── .env.example
└── pnpm-workspace.yaml
```

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### Quick setup with Docker

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=creator_city -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

---

## Getting Started

### 1. Install dependencies

```bash
cd creator-city
pnpm install
```

### 2. Configure environment

```bash
# Root
cp .env.example .env

# Server
cp apps/server/.env.example apps/server/.env

# Web
cp apps/web/src/.env.local.example apps/web/.env.local
```

Edit `apps/server/.env` with your database URL and JWT secret.

### 3. Setup database

```bash
cd apps/server
pnpm prisma generate
pnpm prisma db push      # or: pnpm prisma migrate dev
```

### 4. Build shared package

```bash
pnpm --filter @creator-city/shared build
```

### 5. Run development servers

```bash
# From root — runs web + server in parallel
pnpm dev

# Or individually:
pnpm dev:web     # http://localhost:3000
pnpm dev:server  # http://localhost:4000
```

---

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health` | Health check |
| `POST /api/v1/auth/register` | Register |
| `POST /api/v1/auth/login` | Login |
| `GET /api/v1/auth/me` | Current user |
| `GET /api/v1/city/map` | City map |
| `GET /api/v1/city/my-base` | My base |
| `POST /api/v1/city/my-base/buildings` | Add building |
| `GET /api/v1/projects/my` | My projects |
| `POST /api/v1/projects` | Create project |
| `GET /api/v1/projects/discover` | Public projects |
| `GET /api/v1/agents` | My agents |
| `POST /api/v1/agents/hire` | Hire agent |
| `POST /api/v1/agents/:id/tasks` | Assign task |
| `GET /api/v1/assets/my` | My assets |
| `GET /api/v1/chat/channels` | Chat channels |

**Swagger UI** (dev): http://localhost:4000/api/docs

---

## WebSocket

Connect to `ws://localhost:4000/city` with:

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:4000/city', {
  auth: { token: '<JWT>' }
})

socket.on('agent:task-completed', ({ agentId, output }) => { ... })
socket.on('project:updated', ({ projectId, changes }) => { ... })
socket.on('chat:message', (msg) => { ... })
```

---

## Scripts

```bash
pnpm dev              # Run all apps in parallel
pnpm build            # Build everything
pnpm lint             # Lint all packages
pnpm type-check       # Type-check all packages
pnpm clean            # Remove all build artifacts
```

---

## Next Steps

See [docs/architecture.md](docs/architecture.md) for full architecture details and roadmap.

**Phase 2 priorities:**
- 3D city world scene (Three.js / R3F)
- Real AI agent execution via OpenAI/Anthropic
- Asset upload pipeline (S3)
- Notification system (complete)
