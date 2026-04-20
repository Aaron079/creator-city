import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Review {
  id:          string
  jobId:       string
  authorId:    string   // creator being reviewed
  reviewerId:  string   // publisher doing the review
  rating:      number   // 1–5
  comment?:    string
  createdAt:   string
}

interface ReviewState {
  reviews:      Review[]
  submitReview: (draft: Omit<Review, 'id' | 'createdAt'>) => Review | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_REVIEWS: Review[] = [
  {
    id: 'rev-seed-1', jobId: 'job-ext-001',
    authorId: 'user-neondirector', reviewerId: 'user-demo-ext-1',
    rating: 5,
    comment: '镜头感极强，赛博朋克风格把握得非常准确，按时交付，完成度超预期！',
    createdAt: new Date(Date.now() - 15 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-2', jobId: 'job-ext-002',
    authorId: 'user-neondirector', reviewerId: 'user-demo-ext-2',
    rating: 5,
    comment: '分镜设计非常专业，光影处理和情绪节奏都很出色，合作体验五星。',
    createdAt: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-3', jobId: 'job-ext-003',
    authorId: 'user-neondirector', reviewerId: 'user-demo-ext-3',
    rating: 4,
    comment: '整体质量很高，沟通效率也不错，下次还会合作。',
    createdAt: new Date(Date.now() - 45 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-4', jobId: 'job-ext-004',
    authorId: 'user-visionarc', reviewerId: 'user-demo-ext-4',
    rating: 5,
    comment: '动画分镜方案超出期待，史诗感拉满，团队内部一致好评！',
    createdAt: new Date(Date.now() - 20 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-5', jobId: 'job-ext-005',
    authorId: 'user-visionarc', reviewerId: 'user-demo-ext-5',
    rating: 5,
    comment: '叙事结构扎实，视觉语言成熟，是目前合作过最好的导演之一。',
    createdAt: new Date(Date.now() - 60 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-6', jobId: 'job-ext-006',
    authorId: 'user-cinemaforge', reviewerId: 'user-demo-ext-6',
    rating: 5,
    comment: '预告片节奏感绝了，剪辑卡点精准，客户看完立刻过审！',
    createdAt: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-7', jobId: 'job-ext-007',
    authorId: 'user-cinemaforge', reviewerId: 'user-demo-ext-7',
    rating: 4,
    comment: '动作场面设计很专业，大场面调度能力强，期待下次合作。',
    createdAt: new Date(Date.now() - 25 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-8', jobId: 'job-ext-008',
    authorId: 'user-brandforge', reviewerId: 'user-demo-ext-8',
    rating: 5,
    comment: '品牌调性把握精准，交付物完整规范，是值得长期合作的创作者。',
    createdAt: new Date(Date.now() - 35 * 24 * 3600_000).toISOString(),
  },
  {
    id: 'rev-seed-9', jobId: 'job-ext-009',
    authorId: 'user-synthwave', reviewerId: 'user-demo-ext-9',
    rating: 5,
    comment: 'MV 方案情绪感极强，音画节奏完全对上了，非常满意！',
    createdAt: new Date(Date.now() - 50 * 24 * 3600_000).toISOString(),
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: SEED_REVIEWS,

      submitReview: (draft) => {
        // One review per job only
        const existing = get().reviews
        if (existing.some((r) => r.jobId === draft.jobId)) return null

        const review: Review = {
          id:        `rev-${uid()}`,
          jobId:     draft.jobId,
          authorId:  draft.authorId,
          reviewerId: draft.reviewerId,
          rating:    draft.rating,
          comment:   draft.comment,
          createdAt: new Date().toISOString(),
        }

        set((s) => ({ reviews: [review, ...s.reviews] }))

        // Recalculate + push to profile store
        const allForAuthor = [...existing, review].filter((r) => r.authorId === draft.authorId)
        const avg = allForAuthor.reduce((acc, r) => acc + r.rating, 0) / allForAuthor.length
        // Lazy import to avoid circular dependency at module load time
        import('@/store/profile.store').then(({ useProfileStore }) => {
          useProfileStore.getState().updateRating(draft.authorId, avg, allForAuthor.length)
        })

        return review
      },
    }),
    { name: 'creator-city-reviews' },
  ),
)

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectReviewsFor  = (authorId: string)  => (s: ReviewState) =>
  s.reviews.filter((r) => r.authorId === authorId)

export const selectReviewForJob = (jobId: string) => (s: ReviewState) =>
  s.reviews.find((r) => r.jobId === jobId)
