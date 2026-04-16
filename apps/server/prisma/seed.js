"use strict";
/**
 * Prisma seed script
 * Run: pnpm --filter server prisma:seed
 *        (mapped to: ts-node prisma/seed.ts)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding Creator City...');
    // ─── Admin user ─────────────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('admin12345', 12);
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
    });
    console.log(`  ✓ Admin user: ${admin.email}`);
    // ─── Demo creator ────────────────────────────────────────────────────────────
    const creatorHash = await bcrypt.hash('creator123', 12);
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
    });
    console.log(`  ✓ Demo creator: ${creator.email}`);
    // ─── City bases ──────────────────────────────────────────────────────────────
    for (const user of [admin, creator]) {
        const existing = await prisma.cityBase.findUnique({ where: { ownerId: user.id } });
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
            });
            console.log(`  ✓ Base created for ${user.username}`);
        }
    }
    // ─── Demo agents ─────────────────────────────────────────────────────────────
    const aliceBase = await prisma.cityBase.findUnique({ where: { ownerId: creator.id } });
    if (aliceBase) {
        const existingAgents = await prisma.agent.count({ where: { ownerId: creator.id } });
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
            });
            console.log('  ✓ Demo agents created');
        }
    }
    // ─── Public chat channel ─────────────────────────────────────────────────────
    await prisma.chatChannel.upsert({
        where: { id: 'general' },
        update: {},
        create: { id: 'general', name: 'General', type: 'PUBLIC' },
    });
    console.log('  ✓ General chat channel ready');
    console.log('\n✅ Seed complete.');
}
main()
    .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map