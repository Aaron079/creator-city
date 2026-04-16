import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatReputation(rep: number): string {
  if (rep >= 1_000_000) return `${(rep / 1_000_000).toFixed(1)}M`
  if (rep >= 1_000) return `${(rep / 1_000).toFixed(1)}K`
  return rep.toString()
}

export function formatCredits(credits: number): string {
  return new Intl.NumberFormat('en-US').format(credits)
}

export function getAgentRoleColor(role: string): string {
  const colors: Record<string, string> = {
    SCRIPTWRITER: 'text-sky-400',
    DIRECTOR: 'text-city-gold',
    CINEMATOGRAPHER: 'text-emerald-400',
    EDITOR: 'text-purple-400',
    COMPOSER: 'text-pink-400',
    VFX_ARTIST: 'text-cyan-400',
    PRODUCER: 'text-orange-400',
    MARKETER: 'text-rose-400',
    RESEARCHER: 'text-indigo-400',
  }
  return colors[role] ?? 'text-gray-400'
}

export function getAgentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    IDLE: 'text-emerald-400',
    WORKING: 'text-city-gold',
    RESTING: 'text-gray-400',
    UPGRADING: 'text-purple-400',
    UNAVAILABLE: 'text-rose-400',
  }
  return colors[status] ?? 'text-gray-400'
}

export function getProjectStatusBadge(status: string): string {
  const classes: Record<string, string> = {
    DRAFT: 'bg-gray-500/20 text-gray-400',
    PRE_PRODUCTION: 'bg-sky-500/20 text-sky-400',
    IN_PRODUCTION: 'bg-city-gold/20 text-yellow-400',
    POST_PRODUCTION: 'bg-purple-500/20 text-purple-400',
    COMPLETED: 'bg-emerald-500/20 text-emerald-400',
    PUBLISHED: 'bg-city-accent/20 text-city-accent-glow',
    ARCHIVED: 'bg-gray-500/10 text-gray-500',
  }
  return classes[status] ?? 'bg-gray-500/20 text-gray-400'
}
