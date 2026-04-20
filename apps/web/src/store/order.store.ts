import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SplitResult } from '@/lib/payment/split'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus  = 'pending' | 'paid' | 'in_progress' | 'completed' | 'settled'
export type PaymentStatus = 'unpaid' | 'paid'

export type Order = {
  id:            string
  chatId:        string
  quoteId:       string
  price:         number
  status:        OrderStatus
  paymentStatus: PaymentStatus
  createdAt:     number
  split?:        SplitResult
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_ORDERS: Order[] = [
  {
    id:            'order-seed-1',
    chatId:        'job-seed-4',
    quoteId:       'quote-seed-2',
    price:         3200,
    status:        'in_progress',
    paymentStatus: 'paid',
    createdAt:     Date.now() - 41 * 3600_000,
  },
  {
    id:            'order-seed-2',
    chatId:        'job-seed-3',
    quoteId:       'quote-seed-1',
    price:         2200,
    status:        'pending',
    paymentStatus: 'unpaid',
    createdAt:     Date.now() - 16 * 3600_000,
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

interface OrderState {
  orders:            Order[]
  createOrder:       (chatId: string, quoteId: string, price: number) => Order
  payOrder:          (orderId: string) => void
  startWork:         (orderId: string) => void
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
  completeAndSplit:  (orderId: string, split: SplitResult) => void
  markSettled:       (orderId: string) => void
  getOrdersForChat:  (chatId: string) => Order[]
}

function uid() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: SEED_ORDERS,

      createOrder: (chatId, quoteId, price) => {
        const existing = get().orders.find((o) => o.quoteId === quoteId)
        if (existing) return existing
        const o: Order = {
          id:            uid(),
          chatId,
          quoteId,
          price,
          status:        'pending',
          paymentStatus: 'unpaid',
          createdAt:     Date.now(),
        }
        set((s) => ({ orders: [...s.orders, o] }))
        return o
      },

      payOrder: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: 'paid', status: 'paid' }
              : o
          ),
        }))
      },

      startWork: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.status === 'paid'
              ? { ...o, status: 'in_progress' }
              : o
          ),
        }))
      },

      updateOrderStatus: (orderId, status) => {
        set((s) => ({
          orders: s.orders.map((o) => o.id === orderId ? { ...o, status } : o),
        }))
      },

      completeAndSplit: (orderId, split) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'completed', split }
              : o
          ),
        }))
      },

      markSettled: (orderId) => {
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.status === 'completed'
              ? { ...o, status: 'settled' }
              : o
          ),
        }))
      },

      getOrdersForChat: (chatId) => get().orders.filter((o) => o.chatId === chatId),
    }),
    { name: 'cc:orders-v3' },
  ),
)

// ─── Display helpers ──────────────────────────────────────────────────────────

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: '待支付', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)'  },
  paid:        { label: '已支付', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)'   },
  in_progress: { label: '制作中', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)'  },
  completed:   { label: '已完成', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  },
  settled:     { label: '已结算', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)'  },
}

export const STATUS_STEP: Record<OrderStatus, number> = {
  pending: 0, paid: 1, in_progress: 2, completed: 3, settled: 4,
}
