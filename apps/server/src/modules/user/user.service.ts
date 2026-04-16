import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RegisterDto } from '../auth/dto/register.dto'

type CreateUserInput = RegisterDto & { passwordHash: string }

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        reputation: true,
        level: true,
        credits: true,
        bio: true,
        skills: true,
        createdAt: true,
        updatedAt: true,
      },
    })
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
        avatarUrl: true,
        role: true,
        reputation: true,
        level: true,
        bio: true,
        skills: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException(`User @${username} not found`)
    return user
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
      },
    })

    // Auto-create city base for new user
    await this.prisma.cityBase.create({
      data: {
        ownerId: user.id,
        name: `${user.displayName}'s Base`,
        buildings: {
          create: [
            { type: 'STUDIO', level: 1, name: 'Starter Studio', positionX: 0, positionY: 0 },
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
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        role: true,
        bio: true,
        skills: true,
        updatedAt: true,
      },
    })
    return user
  }

  async getLeaderboard(limit = 20) {
    return this.prisma.user.findMany({
      take: limit,
      orderBy: { reputation: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        reputation: true,
        level: true,
        role: true,
      },
    })
  }
}
