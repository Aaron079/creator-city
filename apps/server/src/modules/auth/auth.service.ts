import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'
import type { AuthTokenPayload } from '@creator-city/shared'

type LoginUser = { id: string; username: string; role: string }

function toLoginUser(user: unknown): LoginUser {
  const candidate = user as { id: string; username: string; role: string }
  return {
    id: candidate.id,
    username: candidate.username,
    role: candidate.role,
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) throw new UnauthorizedException('Invalid credentials')

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) throw new UnauthorizedException('Invalid credentials')

    if (user.status === 'BANNED') throw new UnauthorizedException('Account is banned')

    const { passwordHash: _, ...safe } = user
    return safe
  }

  async login(user: { id: string; username: string; role: string }) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as AuthTokenPayload['role'],
    }
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    }
  }

  async register(input: { username: string; displayName: string; email: string; password: string }) {
    const user = await this.usersService.create(input)
    return this.login(toLoginUser(user))
  }

  async refreshToken(userId: string) {
    const user = await this.usersService.findById(userId)
    return this.login(toLoginUser(user))
  }
}
