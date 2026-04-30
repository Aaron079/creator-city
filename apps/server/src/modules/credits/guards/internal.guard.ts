import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = this.config.get<string>('INTERNAL_API_SECRET')
    if (!secret) throw new ForbiddenException('Internal API not configured')
    const provided = request.headers['x-internal-secret']
    if (provided !== secret) throw new ForbiddenException('Invalid internal secret')
    return true
  }
}
