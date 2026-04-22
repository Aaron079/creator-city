import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'pending' | 'accepted' | 'rejected'

export type Quote = {
  id:           string
  jobId:        string
  senderId:     string
  price:        number
  deliveryDays: number
  description:  string
  status:       QuoteStatus
  createdAt:    number
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface ChatState {
  quotes: Quote[]
  addQuote:          (draft: Omit<Quote, 'id' | 'createdAt'>) => Quote
  updateQuoteStatus: (quoteId: string, status: 'accepted' | 'rejected') => void
  getJobQuotes:      (jobId: string) => Quote[]
}

function uid() {
  return `quote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Seed quotes ──────────────────────────────────────────────────────────────

const SEED_QUOTES: Quote[] = [
  {
    id:           'quote-seed-1',
    jobId:        'job-seed-3',
    senderId:     'user-cinemaforge',
    price:        2200,
    deliveryDays: 3,
    description:  '3 条 15 秒主图视频，清爽自然光风格，每条包含 2–3 个分镜，完整剪辑交付。',
    status:       'pending',
    createdAt:    Date.now() - 17 * 3600_000,
  },
  {
    id:           'quote-seed-2',
    jobId:        'job-seed-4',
    senderId:     'user-neondirector',
    price:        3200,
    deliveryDays: 7,
    description:  '云南旅行 Vlog 完整剪辑方案，非线性叙事结构，配乐参考 + 分镜脚本全套交付。',
    status:       'accepted',
    createdAt:    Date.now() - 42 * 3600_000,
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      quotes: SEED_QUOTES,

      addQuote: (draft) => {
        const q: Quote = { ...draft, id: uid(), createdAt: Date.now() }
        set((s) => ({ quotes: [...s.quotes, q] }))
        return q
      },

      updateQuoteStatus: (quoteId, status) => {
        set((s) => ({
          quotes: s.quotes.map((q) =>
            q.id === quoteId ? { ...q, status } : q
          ),
        }))
      },

      getJobQuotes: (jobId) => get().quotes.filter((q) => q.jobId === jobId),
    }),
    { name: 'cc:chat-v1' },
  ),
)
