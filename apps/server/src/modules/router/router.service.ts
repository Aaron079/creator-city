import { Injectable } from '@nestjs/common'

export interface RouteEntry {
  method: string
  path: string
  module: string
  description: string
  auth: boolean
}

@Injectable()
export class RouterService {
  getRouteManifest(): RouteEntry[] {
    return [
      // Auth
      { method: 'POST', path: '/auth/register', module: 'auth', description: 'Register new user', auth: false },
      { method: 'POST', path: '/auth/login', module: 'auth', description: 'Login', auth: false },
      { method: 'GET',  path: '/auth/me', module: 'auth', description: 'Get current user', auth: true },
      // Users
      { method: 'GET',  path: '/users/me', module: 'users', description: 'Get my full profile', auth: true },
      { method: 'PATCH',path: '/users/me/profile', module: 'users', description: 'Update my profile', auth: true },
      // Lands
      { method: 'GET',  path: '/lands/me', module: 'lands', description: 'Get my land', auth: true },
      { method: 'GET',  path: '/lands/map', module: 'lands', description: 'City map', auth: false },
      // Buildings
      { method: 'GET',  path: '/buildings/me', module: 'buildings', description: 'My buildings', auth: true },
      { method: 'POST', path: '/buildings/:id/upgrade', module: 'buildings', description: 'Upgrade building', auth: true },
      // Agents
      { method: 'GET',  path: '/agents/me', module: 'agents', description: 'My agents', auth: true },
      { method: 'GET',  path: '/agents/:id', module: 'agents', description: 'Agent detail', auth: true },
      { method: 'PATCH',path: '/agents/:id/profile', module: 'agents', description: 'Update agent profile', auth: true },
      // Agent Runtime
      { method: 'POST', path: '/agent-runtime/run', module: 'agent-runtime', description: 'Run agent task', auth: true },
      // Projects
      { method: 'POST', path: '/projects', module: 'projects', description: 'Create project', auth: true },
      { method: 'GET',  path: '/projects/my', module: 'projects', description: 'My projects', auth: true },
      { method: 'GET',  path: '/projects/:id', module: 'projects', description: 'Project detail', auth: false },
      { method: 'POST', path: '/projects/:id/invite', module: 'projects', description: 'Invite member', auth: true },
      { method: 'GET',  path: '/projects/:id/members', module: 'projects', description: 'Project members', auth: true },
      { method: 'POST', path: '/projects/:id/tasks', module: 'projects', description: 'Create task', auth: true },
      { method: 'POST', path: '/projects/:id/reviews', module: 'projects', description: 'Review project', auth: true },
      // Assets
      { method: 'GET',  path: '/assets/my', module: 'assets', description: 'My assets', auth: true },
      { method: 'POST', path: '/assets', module: 'assets', description: 'Register asset', auth: true },
      // Canvas
      { method: 'GET',  path: '/canvas/:projectId', module: 'canvas', description: 'Get canvas', auth: true },
      { method: 'PATCH',path: '/canvas/:projectId', module: 'canvas', description: 'Update canvas', auth: true },
      // Communities
      { method: 'GET',  path: '/communities', module: 'communities', description: 'List communities', auth: false },
      { method: 'GET',  path: '/communities/:id/posts', module: 'communities', description: 'Community posts', auth: false },
      { method: 'POST', path: '/communities/:id/posts', module: 'communities', description: 'Create post', auth: true },
      // Showcases
      { method: 'GET',  path: '/showcases', module: 'showcases', description: 'List showcases', auth: false },
      { method: 'POST', path: '/showcases', module: 'showcases', description: 'Publish showcase', auth: true },
      // Economy
      { method: 'GET',  path: '/economy/wallet', module: 'economy', description: 'My wallet', auth: true },
      { method: 'GET',  path: '/economy/transactions', module: 'economy', description: 'Transaction history', auth: true },
      // Notifications
      { method: 'GET',  path: '/notifications', module: 'notifications', description: 'My notifications', auth: true },
      { method: 'PATCH',path: '/notifications/read-all', module: 'notifications', description: 'Mark all read', auth: true },
      // Collaboration
      { method: 'GET',  path: '/collaboration/invitations/received', module: 'collaboration', description: 'Received invitations', auth: true },
      // Providers
      { method: 'GET',  path: '/providers/default', module: 'providers', description: 'Active AI provider', auth: false },
    ]
  }
}
