import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'

export interface CreateUserInput {
  username: string
  displayName: string
  email: string
  password: string
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
      omit: { passwordHash: true } as never,
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { profile: true },
    })
    if (!user) throw new NotFoundException(`User @${username} not found`)
    const { passwordHash: _, ...safe } = user
    return safe
  }

  async create(input: CreateUserInput) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
    })
    if (existing) {
      throw new ConflictException(
        existing.email === input.email ? 'Email already in use' : 'Username already taken',
      )
    }

    const passwordHash = await bcrypt.hash(input.password, 12)

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        passwordHash,
        profile: { create: { skills: [] } },
      },
    })

    // Provision starter land + wallet
    await this.prisma.land.create({
      data: {
        ownerId: user.id,
        name: `${input.displayName}'s Base`,
        positionX: Math.random() * 800 - 400,
        positionY: Math.random() * 800 - 400,
        buildings: {
          create: [
            { type: 'STUDIO', name: 'Starter Studio', currentLevel: 1 },
            { type: 'OFFICE', name: 'Operations',     currentLevel: 1 },
          ],
        },
      },
    })

    await this.prisma.economyWallet.create({
      data: { userId: user.id, balance: 1000, totalEarned: 1000 },
    })

    const { passwordHash: __, ...safe } = user
    return safe
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string
      bio?: string
      avatarUrl?: string
      bannerUrl?: string
      skills?: string[]
      portfolioUrl?: string
      twitterUrl?: string
      instagramUrl?: string
      websiteUrl?: string
      timezone?: string
    },
  ) {
    const { displayName, ...profileData } = data

    await this.prisma.$transaction([
      ...(displayName
        ? [this.prisma.user.update({ where: { id: userId }, data: { displayName } })]
        : []),
      this.prisma.userProfile.upsert({
        where: { userId },
        update: { ...profileData, updatedAt: new Date() },
        create: { userId, skills: [], ...profileData },
      }),
    ])

    return this.findById(userId)
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: { select: { balance: true, totalEarned: true } },
        land: { select: { id: true, name: true, reputation: true, tier: true } },
        _count: { select: { agents: true, ownedProjects: true, projectMemberships: true } },
      },
    })
    if (!user) throw new NotFoundException()
    const { passwordHash: _, ...safe } = user
    return safe
  }

  async getLeaderboard(limit = 20) {
    return this.prisma.user.findMany({
      take: limit,
      orderBy: { reputation: 'desc' },
      select: {
        id: true, username: true, displayName: true,
        reputation: true, level: true, role: true,
        profile: { select: { avatarUrl: true } },
      },
    })
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) return { followed: false, reason: 'cannot follow yourself' }
    await this.prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    })
    return { followed: true, followingId }
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.userFollow.deleteMany({ where: { followerId, followingId } })
    return { unfollowed: true, followingId }
  }
}
