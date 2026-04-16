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
import { RealtimeService } from './realtime.service'
import type { AuthTokenPayload } from '@creator-city/shared'

// ─── Typed socket ────────────────────────────────────────────────────────────

interface SocketData {
  userId: string
  username: string
}

type AppSocket = Socket & { data: SocketData }

// ─── Event payloads ──────────────────────────────────────────────────────────

interface JoinProjectPayload   { projectId: string }
interface LeaveProjectPayload  { projectId: string }
interface CanvasUpdatePayload  { projectId: string; patch: Record<string, unknown> }
interface TaskUpdatePayload    { projectId: string; taskId: string; changes: Record<string, unknown> }
interface AgentStatusPayload   { agentId: string; status: string; taskId?: string }
interface ReviewUpdatePayload  { projectId: string; reviewId: string; action: 'created' | 'updated' }
interface CursorPayload        { projectId: string; x: number; y: number; tool?: string }

// ─── Gateway ─────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(RealtimeGateway.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit() {
    this.logger.log('Realtime Gateway initialised (/realtime)')
  }

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: AppSocket) {
    try {
      const token =
        (client.handshake.auth['token'] as string) ||
        (client.handshake.headers['authorization'] as string)?.replace('Bearer ', '')

      if (!token) { client.disconnect(); return }

      const payload = this.jwtService.verify<AuthTokenPayload>(token)
      client.data = { userId: payload.sub, username: payload.username }

      this.realtimeService.registerConnection(client.id, {
        userId: payload.sub,
        username: payload.username,
      })

      // Personal room for direct messages
      client.join(`user:${payload.sub}`)

      this.logger.log(`Connected: ${payload.username} (${client.id})`)

      client.emit('connected', {
        userId: payload.sub,
        username: payload.username,
        connectedUsers: this.realtimeService.getConnectedCount(),
        timestamp: new Date().toISOString(),
      })
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: AppSocket) {
    const user = this.realtimeService.getUserBySocket(client.id)
    if (user?.projectId) {
      this.server.to(`project:${user.projectId}`).emit('projectPresence', {
        projectId: user.projectId,
        presence: this.realtimeService.getProjectPresence(user.projectId),
        event: 'left',
        userId: user.userId,
      })
    }
    this.realtimeService.removeConnection(client.id)
    this.logger.log(`Disconnected: ${client.data?.username ?? client.id}`)
  }

  // ─── Project room management ──────────────────────────────────────────────

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: JoinProjectPayload,
  ) {
    client.join(`project:${data.projectId}`)
    this.realtimeService.joinProject(client.id, data.projectId)

    const presence = this.realtimeService.getProjectPresence(data.projectId)

    // Notify everyone in the project room
    this.server.to(`project:${data.projectId}`).emit('projectPresence', {
      projectId: data.projectId,
      presence,
      event: 'joined',
      userId: client.data.userId,
    })

    return { joined: true, projectId: data.projectId, presence }
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: LeaveProjectPayload,
  ) {
    client.leave(`project:${data.projectId}`)
    this.realtimeService.leaveProject(client.id, data.projectId)

    this.server.to(`project:${data.projectId}`).emit('projectPresence', {
      projectId: data.projectId,
      presence: this.realtimeService.getProjectPresence(data.projectId),
      event: 'left',
      userId: client.data.userId,
    })

    return { left: true, projectId: data.projectId }
  }

  @SubscribeMessage('projectPresence')
  handleGetPresence(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { projectId: string },
  ) {
    return {
      projectId: data.projectId,
      presence: this.realtimeService.getProjectPresence(data.projectId),
    }
  }

  // ─── Canvas collaboration ─────────────────────────────────────────────────

  @SubscribeMessage('canvasUpdated')
  handleCanvasUpdate(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: CanvasUpdatePayload,
  ) {
    // Broadcast to all OTHER clients in the project room
    client.to(`project:${data.projectId}`).emit('canvasUpdated', {
      projectId: data.projectId,
      patch: data.patch,
      editorId: client.data.userId,
      timestamp: new Date().toISOString(),
    })
  }

  @SubscribeMessage('cursorMoved')
  handleCursor(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: CursorPayload,
  ) {
    client.to(`project:${data.projectId}`).emit('cursorMoved', {
      userId: client.data.userId,
      username: client.data.username,
      x: data.x,
      y: data.y,
      tool: data.tool,
    })
  }

  // ─── Task updates ─────────────────────────────────────────────────────────

  @SubscribeMessage('taskUpdated')
  handleTaskUpdate(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: TaskUpdatePayload,
  ) {
    client.to(`project:${data.projectId}`).emit('taskUpdated', {
      projectId: data.projectId,
      taskId: data.taskId,
      changes: data.changes,
      updatedBy: client.data.userId,
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Agent status ─────────────────────────────────────────────────────────

  @SubscribeMessage('agentStatusUpdate')
  handleAgentStatus(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: AgentStatusPayload,
  ) {
    // Broadcast to the agent owner's personal room
    this.server.to(`user:${client.data.userId}`).emit('agentStatusUpdate', {
      agentId: data.agentId,
      status: data.status,
      taskId: data.taskId,
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Review updates ───────────────────────────────────────────────────────

  @SubscribeMessage('reviewUpdated')
  handleReviewUpdate(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: ReviewUpdatePayload,
  ) {
    client.to(`project:${data.projectId}`).emit('reviewUpdated', {
      projectId: data.projectId,
      reviewId: data.reviewId,
      action: data.action,
      updatedBy: client.data.userId,
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Server-side emit helpers (called by services) ────────────────────────

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data)
  }

  emitToProject(projectId: string, event: string, data: unknown) {
    this.server.to(`project:${projectId}`).emit(event, data)
  }

  broadcastAgentCompleted(params: { userId: string; agentId: string; taskId: string; result: unknown }) {
    this.emitToUser(params.userId, 'agentStatusUpdate', {
      agentId: params.agentId,
      status: 'IDLE',
      taskId: params.taskId,
      result: params.result,
      timestamp: new Date().toISOString(),
    })
  }
}
