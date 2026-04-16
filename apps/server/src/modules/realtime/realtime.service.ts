import { Injectable } from '@nestjs/common'

export interface PresenceUser {
  userId: string
  username: string
  connectedAt: Date
  projectId?: string
}

@Injectable()
export class RealtimeService {
  /** socketId → PresenceUser */
  private readonly connected = new Map<string, PresenceUser>()
  /** projectId → Set<socketId> */
  private readonly projectRooms = new Map<string, Set<string>>()

  registerConnection(socketId: string, user: Omit<PresenceUser, 'connectedAt'>) {
    this.connected.set(socketId, { ...user, connectedAt: new Date() })
  }

  removeConnection(socketId: string) {
    const user = this.connected.get(socketId)
    if (user?.projectId) {
      this.projectRooms.get(user.projectId)?.delete(socketId)
    }
    this.connected.delete(socketId)
  }

  joinProject(socketId: string, projectId: string) {
    const user = this.connected.get(socketId)
    if (user) {
      user.projectId = projectId
    }
    if (!this.projectRooms.has(projectId)) {
      this.projectRooms.set(projectId, new Set())
    }
    this.projectRooms.get(projectId)!.add(socketId)
  }

  leaveProject(socketId: string, projectId: string) {
    this.projectRooms.get(projectId)?.delete(socketId)
    const user = this.connected.get(socketId)
    if (user?.projectId === projectId) user.projectId = undefined
  }

  getProjectPresence(projectId: string): PresenceUser[] {
    const socketIds = this.projectRooms.get(projectId) ?? new Set()
    return [...socketIds]
      .map((sid) => this.connected.get(sid))
      .filter((u): u is PresenceUser => !!u)
  }

  getConnectedCount(): number {
    return this.connected.size
  }

  getUserBySocket(socketId: string): PresenceUser | undefined {
    return this.connected.get(socketId)
  }
}
