import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@creator-city/shared'

type CitySocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: CitySocket | null = null

export function getSocket(): CitySocket {
  if (socket?.connected) return socket

  const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:4000'

  const storedRaw = typeof window !== 'undefined'
    ? localStorage.getItem('creator-city-auth')
    : null
  const stored = storedRaw ? (JSON.parse(storedRaw) as { state?: { token?: string } }) : null
  const token = stored?.state?.token

  socket = io(`${WS_URL}/city`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }) as CitySocket

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
