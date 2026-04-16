import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'
import type { AuthTokenPayload, ServerToClientEvents, ClientToServerEvents } from '@creator-city/shared'

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { userId?: string; username?: string }
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/city',
})
export class CityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: TypedServer

  private readonly logger = new Logger(CityGateway.name)
  private readonly connectedUsers = new Map<string, string>() // socketId → userId

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized')
  }

  async handleConnection(client: TypedSocket) {
    try {
      const token =
        client.handshake.auth['token'] as string ||
        (client.handshake.headers['authorization'] as string)?.replace('Bearer ', '')

      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwtService.verify<AuthTokenPayload>(token)
      client.data.userId = payload.sub
      client.data.username = payload.username
      this.connectedUsers.set(client.id, payload.sub)

      client.join(`user:${payload.sub}`)
      this.logger.log(`Client connected: ${payload.username} (${client.id})`)

      this.server.to(`user:${payload.sub}`).emit('notification:new', {
        id: 'welcome',
        userId: payload.sub,
        type: 'SYSTEM',
        title: 'Connected',
        body: 'Welcome to Creator City!',
        isRead: false,
        createdAt: new Date(),
      })
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: TypedSocket) {
    const userId = this.connectedUsers.get(client.id)
    if (userId) {
      this.connectedUsers.delete(client.id)
      this.server.emit('city:player-left', { userId })
      this.logger.log(`Client disconnected: ${client.id}`)
    }
  }

  @SubscribeMessage('city:move')
  handleMove(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { position: unknown },
  ) {
    if (!client.data.userId) return
    // Broadcast position update to others in same zone
    client.broadcast.emit('city:player-entered', {
      userId: client.data.userId,
      position: data.position,
    })
  }

  @SubscribeMessage('project:join')
  handleProjectJoin(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    client.join(`project:${data.projectId}`)
  }

  @SubscribeMessage('project:leave')
  handleProjectLeave(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    client.leave(`project:${data.projectId}`)
  }

  // ─── Emit helpers (called by other services) ──────────────────────

  emitToUser(userId: string, event: keyof ServerToClientEvents, data: unknown) {
    this.server.to(`user:${userId}`).emit(event as string, data)
  }

  emitToProject(projectId: string, event: keyof ServerToClientEvents, data: unknown) {
    this.server.to(`project:${projectId}`).emit(event as string, data)
  }
}
