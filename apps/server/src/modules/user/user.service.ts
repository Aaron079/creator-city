import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RegisterDto } from '../auth/dto/register.dto'

type CreateUserInput = RegisterDto & { passwordHash: string }

type UserProfileSelect = {
  avatarUrl: string | null
  bio: string | null
  skills: string[]
}

type UserWithProfile = {
  id: string
  username: string
  displayName: string
  email?: string
  role: string
  status?: string
  reputation: number
  level: number
  createdAt?: Date
  updatedAt?: Date
  profile: UserProfileSelect | null
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private mapUser<T extends UserWithProfile>(user: T) {
    return {
      ...user,
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      skills: user.profile?.skills ?? [],
    }
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        reputation: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            avatarUrl: true,
            bio: true,
            skills: true,
          },
        },
      },
    })
    return user ? this.mapUser(user) : null
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        reputation: true,
        level: true,
        createdAt: true,
        profile: {
          select: {
            avatarUrl: true,
            bio: true,
            skills: true,
          },
        },
      },
    })
    if (!user) throw new NotFoundException(`User @${username} not found`)
    return this.mapUser(user)
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

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        passwordHash: input.passwordHash,
        profile: {
          create: {
            skills: [],
          },
        },
      },
    })

    // Auto-create land for new user
    await this.prisma.land.create({
      data: {
        ownerId: user.id,
        name: `${user.displayName}'s Base`,
        buildings: {
          create: [
            { type: 'STUDIO', currentLevel: 1, name: 'Starter Studio', positionX: 0, positionY: 0 },
          ],
        },
      },
    })

    const { passwordHash: _, ...result } = user
    return result
  }

  async updateProfile(id: string, data: { displayName?: string; bio?: string; skills?: string[]; avatarUrl?: string }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName && { displayName: data.displayName }),
        profile: {
          upsert: {
            update: {
              ...(data.bio !== undefined && { bio: data.bio }),
              ...(data.skills !== undefined && { skills: data.skills }),
              ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
            },
            create: {
              bio: data.bio,
              skills: data.skills ?? [],
              avatarUrl: data.avatarUrl,
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        updatedAt: true,
        reputation: true,
        level: true,
        profile: {
          select: {
            avatarUrl: true,
            bio: true,
            skills: true,
          },
        },
      },
    })
    return this.mapUser(user)
  }

  async getLeaderboard(limit = 20) {
    const users = await this.prisma.user.findMany({
      take: limit,
      orderBy: { reputation: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        reputation: true,
        level: true,
        role: true,
        profile: {
          select: {
            avatarUrl: true,
            bio: true,
            skills: true,
          },
        },
      },
    })

    return users.map((user) => this.mapUser(user))
  }
}
