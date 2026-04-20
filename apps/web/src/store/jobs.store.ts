import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ShotExportData } from '@/lib/export'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus      = 'open' | 'in_progress' | 'done'
export type DeliveryStatus = 'pending' | 'submitted' | 'approved'
export type OfferStatus    = 'pending' | 'accepted' | 'rejected'

export interface Offer {
  id:        string
  creatorId: string
  price:     number
  message?:  string
  status:    OfferStatus
  createdAt: string
}

export interface Delivery {
  type:         'project' | 'export'
  status:       DeliveryStatus
  submittedAt?: string
  approvedAt?:  string
  shotCount?:   number
  /** Extracted ShotExportData[] — only platform-generated data allowed */
  data?:        ShotExportData[]
}

export interface Message {
  id:        string
  senderId:  string
  content:   string
  createdAt: number   // unix ms
}

export interface Job {
  id:           string
  title:        string
  description:  string
  budgetRange:  string
  status:       JobStatus
  creatorId?:   string   // who accepted
  publisherId?: string   // who posted
  cityId?:      string   // optional city binding
  offers?:      Offer[]
  messages?:    Message[]
  delivery?:    Delivery
  createdAt:    string
}

interface JobsState {
  jobs: Job[]
  publishJob:      (draft: Pick<Job, 'title' | 'description' | 'budgetRange'> & { publisherId?: string; cityId?: string }) => Job
  acceptJob:       (jobId: string, creatorId: string) => void
  submitOffer:     (jobId: string, draft: Pick<Offer, 'creatorId' | 'price' | 'message'>) => void
  acceptOffer:     (jobId: string, offerId: string) => void
  sendMessage:     (jobId: string, senderId: string, content: string) => void
  submitDelivery:  (jobId: string, data: ShotExportData[]) => void
  approveDelivery: (jobId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_JOBS: Job[] = [
  {
    id:          'job-seed-1',
    title:       '品牌形象短片（30s）',
    description: '需要一支展现我们运动品牌「活力感」的 30 秒广告短片，风格偏商业电影感，面向 18-35 岁年轻人。',
    budgetRange: '¥5,000 – ¥8,000',
    status:      'open',
    publisherId: 'user-demo-1',
    offers: [
      {
        id:        'offer-seed-1',
        creatorId: 'user-neondirector',
        price:     6000,
        message:   '擅长商业电影感运镜，有多个运动品牌合作案例，可在 7 天内交付完整分镜方案。',
        status:    'pending',
        createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
      {
        id:        'offer-seed-2',
        creatorId: 'user-cinemaforge',
        price:     7500,
        message:   '专注高密度剪辑与大场面调度，品牌广告经验丰富，交付质量有保证。',
        status:    'pending',
        createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
      },
    ],
    createdAt:   new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    id:          'job-seed-2',
    title:       '产品开箱 MV 脚本',
    description: '新款耳机发布需要一支「沉浸感」MV，希望融合城市夜景和音乐节元素，时长 90 秒左右。',
    budgetRange: '¥3,000 – ¥5,000',
    status:      'open',
    publisherId: 'user-demo-2',
    offers: [
      {
        id:        'offer-seed-3',
        creatorId: 'user-synthwave',
        price:     4200,
        message:   'Lo-fi 音画一体化是我的专长，城市夜景 MV 做过很多，音乐节元素可以完美融合。',
        status:    'pending',
        createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
      },
    ],
    createdAt:   new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
  {
    id:          'job-seed-3',
    title:       '电商主图视频 × 3',
    description: '食品品牌需要 3 条 15 秒主图视频，要求干净、食欲感强，可快速交付。',
    budgetRange: '¥1,500 – ¥2,500',
    status:      'in_progress',
    publisherId: 'user-demo-3',
    creatorId:   'user-cinemaforge',
    messages: [
      { id: 'msg-s3-1', senderId: 'user-demo-3',      content: '你好，我们的产品主要是轻食沙拉，希望画面清爽、有食欲感，背景建议用白色或浅木纹。', createdAt: Date.now() - 20 * 3600_000 },
      { id: 'msg-s3-2', senderId: 'user-cinemaforge', content: '收到！我会用自然光 + 浅景深处理，颜色走清新路线，3 条视频风格统一。预计明天给你初版分镜。', createdAt: Date.now() - 19 * 3600_000 },
      { id: 'msg-s3-3', senderId: 'user-demo-3',      content: '好的，期待！记得产品要有特写镜头。', createdAt: Date.now() - 18 * 3600_000 },
    ],
    delivery:    { type: 'project', status: 'pending' },
    createdAt:   new Date(Date.now() - 24 * 3600_000).toISOString(),
  },
  {
    id:          'job-seed-4',
    title:       '旅行 Vlog 剪辑方案',
    description: '云南旅行 Vlog，需要完整剪辑方案与分镜脚本，素材约 2 小时，成片 8 分钟。',
    budgetRange: '¥2,000 – ¥3,500',
    status:      'in_progress',
    publisherId: 'user-demo-4',
    creatorId:   'user-neondirector',
    messages: [
      { id: 'msg-s4-1', senderId: 'user-demo-4',      content: '素材我已经整理好了，主要是大理和丽江两段，各约 1 小时。成片希望叙事感强一些，不要纯流水账。', createdAt: Date.now() - 46 * 3600_000 },
      { id: 'msg-s4-2', senderId: 'user-neondirector', content: '明白！我会用非线性结构来剪，以「寻找自己」为主线贯穿两个城市，情绪弧线会更完整。', createdAt: Date.now() - 45 * 3600_000 },
      { id: 'msg-s4-3', senderId: 'user-demo-4',      content: '这个方向很好！配乐有推荐吗？', createdAt: Date.now() - 44 * 3600_000 },
      { id: 'msg-s4-4', senderId: 'user-neondirector', content: '我在分镜里附上了配乐参考，Lo-fi + 轻器乐为主，可以先看看方案再决定。', createdAt: Date.now() - 43 * 3600_000 },
      { id: 'msg-s4-5', senderId: 'user-demo-4',      content: '刚看了你提交的方案，镜头语言很流畅，开场大理那段特别喜欢！', createdAt: Date.now() - 3 * 3600_000 },
    ],
    delivery:    {
      type:        'project',
      status:      'submitted',
      submittedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      shotCount:   3,
      data: [
        {
          label:          'Shot 1 · 开场',
          idea:           '云南大理古城清晨，阳光透过白墙',
          style:          '旅行纪录片',
          shotType:       'wide',
          framing:        'WS',
          movement:       'dolly',
          colorGrade:     'natural',
          lighting:       'daylight',
          shotDescription: '宽镜头推进，晨光斜射古城街道，低饱和自然色调',
          keyframePrompt:  'wide establishing shot, Dali ancient town at dawn, sunlight through white walls, natural color grade, dolly movement, cinematic',
          isDone:         true,
        },
        {
          label:          'Shot 2 · 市集',
          idea:           '本地市集，手工艺品与人群',
          style:          '旅行纪录片',
          shotType:       'medium',
          framing:        'MS',
          movement:       'handheld',
          colorGrade:     'natural',
          lighting:       'soft',
          shotDescription: '手持中景，市集人流与色彩纷呈的手工艺品',
          keyframePrompt:  'medium shot, Yunnan market, colorful handicrafts, handheld, soft natural light, warm documentary style',
          isDone:         true,
        },
        {
          label:          'Shot 3 · 结尾',
          idea:           '洱海夕阳，远山剪影',
          style:          '旅行纪录片',
          shotType:       'wide',
          framing:        'EWS',
          movement:       'static',
          colorGrade:     'cinematic',
          lighting:       'daylight',
          shotDescription: '极宽静止镜头，洱海日落，远山剪影，电影感收尾',
          keyframePrompt:  'extreme wide shot, Erhai Lake at sunset, mountain silhouette, cinematic color grade, static, golden hour, peaceful',
          isDone:         true,
        },
      ],
    },
    createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useJobsStore = create<JobsState>()(
  persist(
    (set) => ({
      jobs: SEED_JOBS,

      publishJob: (draft) => {
        const job: Job = {
          id:          `job-${uid()}`,
          title:       draft.title,
          description: draft.description,
          budgetRange: draft.budgetRange,
          status:      'open',
          publisherId: draft.publisherId,
          cityId:      draft.cityId,
          createdAt:   new Date().toISOString(),
        }
        set((s) => ({ jobs: [job, ...s.jobs] }))
        return job
      },

      acceptJob: (jobId, creatorId) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId && j.status === 'open'
              ? { ...j, status: 'in_progress', creatorId, delivery: { type: 'project', status: 'pending' } }
              : j
          ),
        }))
      },

      submitOffer: (jobId, draft) => {
        const offer: Offer = {
          id:        `offer-${uid()}`,
          creatorId: draft.creatorId,
          price:     draft.price,
          message:   draft.message,
          status:    'pending',
          createdAt: new Date().toISOString(),
        }
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId && j.status === 'open'
              ? { ...j, offers: [...(j.offers ?? []), offer] }
              : j
          ),
        }))
      },

      acceptOffer: (jobId, offerId) => {
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== jobId || j.status !== 'open') return j
            const accepted = j.offers?.find((o) => o.id === offerId)
            if (!accepted) return j
            return {
              ...j,
              status:    'in_progress',
              creatorId: accepted.creatorId,
              delivery:  { type: 'project', status: 'pending' },
              offers:    (j.offers ?? []).map((o) =>
                o.id === offerId
                  ? { ...o, status: 'accepted' }
                  : { ...o, status: 'rejected' }
              ),
            }
          }),
        }))
      },

      sendMessage: (jobId, senderId, content) => {
        const msg: Message = {
          id:        `msg-${uid()}`,
          senderId,
          content,
          createdAt: Date.now(),
        }
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? { ...j, messages: [...(j.messages ?? []), msg] }
              : j
          ),
        }))
      },

      submitDelivery: (jobId, data) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId && j.status === 'in_progress'
              ? {
                  ...j,
                  delivery: {
                    type:        'project',
                    status:      'submitted',
                    submittedAt: new Date().toISOString(),
                    shotCount:   data.length,
                    data,
                  },
                }
              : j
          ),
        }))
      },

      approveDelivery: (jobId) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId && j.delivery?.status === 'submitted'
              ? {
                  ...j,
                  status: 'done',
                  delivery: {
                    ...j.delivery,
                    status:      'approved',
                    approvedAt:  new Date().toISOString(),
                  },
                }
              : j
          ),
        }))
      },
    }),
    { name: 'creator-city-jobs' },
  ),
)

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectOpenJobs      = (s: JobsState) => s.jobs.filter((j) => j.status === 'open')
export const selectMyJobs        = (creatorId: string)   => (s: JobsState) => s.jobs.filter((j) => j.creatorId === creatorId)
export const selectPostedJobs    = (publisherId: string) => (s: JobsState) => s.jobs.filter((j) => j.publisherId === publisherId)
export const selectPendingReview = (s: JobsState) => s.jobs.filter((j) => j.delivery?.status === 'submitted')
