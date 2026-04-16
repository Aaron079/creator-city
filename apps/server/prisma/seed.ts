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
      bio: 'Indie filmmaker and AI enthusiast.',
      skills: ['screenwriting', 'directing', 'post-production'],
    },
  })
  console.log(`  ✓ Demo creator: ${creator.email}`)

  // ─── City bases ──────────────────────────────────────────────────────────────
  for (const user of [admin, creator]) {
    const existing = await prisma.cityBase.findUnique({ where: { ownerId: user.id } })
    if (!existing) {
      await prisma.cityBase.create({
        data: {
          ownerId: user.id,
          name: `${user.displayName}'s Base`,
          positionX: Math.random() * 400 - 200,
          positionY: Math.random() * 400 - 200,
          reputation: user.reputation,
          buildings: {
            create: [
              { type: 'STUDIO', level: 1, name: 'Main Studio', positionX: 0, positionY: 0 },
              { type: 'OFFICE', level: 1, name: 'Operations', positionX: 2, positionY: 0 },
            ],
          },
        },
      })
      console.log(`  ✓ Base created for ${user.username}`)
    }
  }

  // ─── Demo agents ─────────────────────────────────────────────────────────────
  const aliceBase = await prisma.cityBase.findUnique({ where: { ownerId: creator.id } })
  if (aliceBase) {
    const existingAgents = await prisma.agent.count({ where: { ownerId: creator.id } })
    if (existingAgents === 0) {
      await prisma.agent.createMany({
        data: [
          {
            ownerId: creator.id,
            baseId: aliceBase.id,
            name: 'Quill',
            role: 'SCRIPTWRITER',
            tier: 'ADVANCED',
            status: 'IDLE',
            level: 3,
            experience: 2400,
            personality: { creativity: 92, efficiency: 71, collaboration: 80, ambition: 75 },
          },
          {
            ownerId: creator.id,
            baseId: aliceBase.id,
            name: 'Lens',
            role: 'CINEMATOGRAPHER',
            tier: 'BASIC',
            status: 'IDLE',
            level: 1,
            experience: 200,
            personality: { creativity: 78, efficiency: 85, collaboration: 70, ambition: 60 },
          },
        ],
      })
      console.log('  ✓ Demo agents created')
    }
  }

  // ─── Public chat channel ─────────────────────────────────────────────────────
  await prisma.chatChannel.upsert({
    where: { id: 'general' },
    update: {},
    create: { id: 'general', name: 'General', type: 'PUBLIC' },
  })
  console.log('  ✓ General chat channel ready')

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
