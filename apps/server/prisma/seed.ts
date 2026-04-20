/**
 * Prisma seed script
 * Run: pnpm --filter server prisma:seed
 *        (mapped to: ts-node prisma/seed.ts)
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Creator City...')

  // ─── Admin user ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin12345', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@creator.city' },
    update: {},
    create: {
      username: 'admin',
      displayName: 'City Admin',
      email: 'admin@creator.city',
      passwordHash: adminHash,
      role: 'ADMIN',
      reputation: 9999,
      level: 99,
    },
  })
  console.log(`  ✓ Admin user: ${admin.email}`)

  // ─── Demo creator ────────────────────────────────────────────────────────────
  const creatorHash = await bcrypt.hash('creator123', 12)
  const creator = await prisma.user.upsert({
    where: { email: 'alice@creator.city' },
    update: {},
    create: {
      username: 'alice_creator',
      displayName: 'Alice Chen',
      email: 'alice@creator.city',
      passwordHash: creatorHash,
      role: 'CREATOR',
      reputation: 1250,
      level: 5,
    },
  })
  await prisma.userProfile.upsert({
    where: { userId: creator.id },
    update: {
      bio: 'Indie filmmaker and AI enthusiast.',
      skills: ['screenwriting', 'directing', 'post-production'],
    },
    create: {
      userId: creator.id,
      bio: 'Indie filmmaker and AI enthusiast.',
      skills: ['screenwriting', 'directing', 'post-production'],
    },
  })
  console.log(`  ✓ Demo creator: ${creator.email}`)

  // ─── Lands ───────────────────────────────────────────────────────────────────
  for (const user of [admin, creator]) {
    const existing = await prisma.land.findUnique({ where: { ownerId: user.id } })
    if (!existing) {
      await prisma.land.create({
        data: {
          ownerId: user.id,
          name: `${user.displayName}'s Base`,
          positionX: Math.random() * 400 - 200,
          positionY: Math.random() * 400 - 200,
          reputation: user.reputation,
          buildings: {
            create: [
              { type: 'STUDIO', currentLevel: 1, name: 'Main Studio', positionX: 0, positionY: 0 },
              { type: 'OFFICE', currentLevel: 1, name: 'Operations', positionX: 2, positionY: 0 },
            ],
          },
        },
      })
      console.log(`  ✓ Land created for ${user.username}`)
    }
  }

  // ─── Demo agents ─────────────────────────────────────────────────────────────
  const aliceLand = await prisma.land.findUnique({ where: { ownerId: creator.id } })
  if (aliceLand) {
    const existingAgents = await prisma.agent.count({ where: { ownerId: creator.id } })
    if (existingAgents === 0) {
      const quill = await prisma.agent.create({
        data: {
          ownerId: creator.id,
          landId: aliceLand.id,
          name: 'Quill',
          role: 'SCRIPTWRITER',
          tier: 'ADVANCED',
          status: 'IDLE',
          level: 3,
          experience: 2400,
        },
      })

      await prisma.agentProfile.upsert({
        where: { agentId: quill.id },
        update: {
          specialties: ['screenwriting', 'story-structure'],
          traits: { creativity: 92, efficiency: 71, collaboration: 80, ambition: 75 },
        },
        create: {
          agentId: quill.id,
          specialties: ['screenwriting', 'story-structure'],
          traits: { creativity: 92, efficiency: 71, collaboration: 80, ambition: 75 },
        },
      })

      const lens = await prisma.agent.create({
        data: {
          ownerId: creator.id,
          landId: aliceLand.id,
          name: 'Lens',
          role: 'CINEMATOGRAPHER',
          tier: 'BASIC',
          status: 'IDLE',
          level: 1,
          experience: 200,
        },
      })

      await prisma.agentProfile.upsert({
        where: { agentId: lens.id },
        update: {
          specialties: ['cinematography', 'shot-design'],
          traits: { creativity: 78, efficiency: 85, collaboration: 70, ambition: 60 },
        },
        create: {
          agentId: lens.id,
          specialties: ['cinematography', 'shot-design'],
          traits: { creativity: 78, efficiency: 85, collaboration: 70, ambition: 60 },
        },
      })

      console.log('  ✓ Demo agents created')
    }
  }

  // Current schema has no chat-channel model, so seed stops at users, land, buildings, and agents.
  console.log('  • Chat seed skipped: current schema has no chat channel model')

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
