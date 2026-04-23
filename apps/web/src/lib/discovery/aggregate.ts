import type { Case } from '@/lib/case/caseStore'
import type { CreatorUser } from '@/lib/data/creators'
import {
  aggregateTalentMatching,
  getRoleNeedLabel,
  type MatchReason,
} from '@/lib/matching/aggregate'
import type { Creator } from '@/lib/user/creator'
import type { UserProfile } from '@/store/profile.store'
import type { Review } from '@/store/review.store'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { Team } from '@/store/team.store'
import type { DashboardProjectOverview } from '@/lib/dashboard/aggregate'

export interface DiscoveryReason {
  type: 'same-city' | 'similar-style' | 'strong-rating' | 'open-role-fit' | 'recent-active'
  message: string
}

export interface DiscoveryProjectCard {
  projectId: string
  title: string
  stage: string
  city: string
  openRoles: string[]
  styleTags: string[]
  priority: 'normal' | 'urgent'
  summary: string
  reasons: DiscoveryReason[]
  deliveryStatus: string
  approvalState: string
  projectHref: string
  rolesHref: string
  inviteHref: string
}

export interface DiscoveryCreatorCard {
  profileId: string
  displayName: string
  city: string
  roleTags: string[]
  ratingSummary: {
    rating: number
    reviewCount: number
  }
  caseIds: string[]
  styleTags: string[]
  availability: 'available' | 'limited' | 'unavailable'
  reasons: DiscoveryReason[]
  profileHref: string
  caseHref?: string
  inviteHref?: string
}

export interface DiscoveryCaseCard {
  caseId: string
  title: string
  category: string
  style: string
  creatorIds: string[]
  quote?: string
  scoreTags: string[]
  reasons: DiscoveryReason[]
  detailHref: string
  creatorHref?: string
}

export interface DiscoveryAggregateResult {
  projects: DiscoveryProjectCard[]
  creators: DiscoveryCreatorCard[]
  cases: DiscoveryCaseCard[]
  projectCities: string[]
  creatorCities: string[]
  roleOptions: string[]
  styleOptions: string[]
  categoryOptions: string[]
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[\s,，、。/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function toStyleTags(text: string, extra: string[] = []) {
  const tokens = tokenize(text)
  return unique([...extra.map(normalizeText), ...tokens]).slice(0, 6)
}

function inferProjectCity(projectId: string, jobs: Job[], orders: Order[], teams: Team[], creatorPool: CreatorUser[]) {
  const order = orders.find((item) => item.id === projectId) ?? null
  const job = order ? jobs.find((item) => item.id === order.chatId) ?? null : null
  if (job?.cityId) return job.cityId

  const team = teams.find((item) => item.projectId === projectId) ?? null
  const cityByCreator = new Map(creatorPool.map((creator) => [creator.id, creator.city]))
  return team?.members.map((member) => cityByCreator.get(member.userId)).find((city): city is string => Boolean(city)) ?? 'Remote'
}

function mapMatchReason(reason: MatchReason): DiscoveryReason {
  switch (reason.type) {
    case 'same-city':
      return { type: 'same-city', message: reason.message }
    case 'similar-case':
    case 'style-fit':
      return { type: 'similar-style', message: reason.message }
    case 'strong-rating':
      return { type: 'strong-rating', message: reason.message }
    case 'matching-role':
      return { type: 'open-role-fit', message: reason.message }
    case 'active-now':
    default:
      return { type: 'recent-active', message: reason.message }
  }
}

function computeReviewSummary(profileId: string, reviews: Review[]) {
  const relevant = reviews.filter((review) => review.authorId === profileId)
  if (relevant.length === 0) return { rating: 0, reviewCount: 0 }
  const rating = relevant.reduce((sum, review) => sum + review.rating, 0) / relevant.length
  return {
    rating: Number(rating.toFixed(2)),
    reviewCount: relevant.length,
  }
}

function inferCaseCreators(caseItem: Case, creators: DiscoveryCreatorCard[]) {
  const keywords = tokenize(`${caseItem.title} ${caseItem.description} ${caseItem.category} ${caseItem.result} ${caseItem.clientQuote}`)
  return creators
    .map((creator) => {
      const creatorText = [...creator.roleTags, ...creator.styleTags, creator.displayName, creator.city].map(normalizeText)
      const hits = keywords.filter((keyword) => creatorText.some((token) => token.includes(keyword))).length
      return { id: creator.profileId, hits }
    })
    .filter((item) => item.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 3)
    .map((item) => item.id)
}

export function aggregateDiscoveryData(args: {
  overview: DashboardProjectOverview[]
  profiles: UserProfile[]
  reviews: Review[]
  jobs: Job[]
  orders: Order[]
  cases: Case[]
  creators: Creator[]
  creatorPool: CreatorUser[]
  teams: Team[]
  getProjectHref: (projectId: string) => string
  getProjectRolesHref: (projectId: string) => string
  getProjectInviteHref: (projectId: string) => string
  getProfileHref: (profileId: string) => string
  getCaseHref: (caseId: string) => string
  canInviteCreators: boolean
}): DiscoveryAggregateResult {
  const matching = aggregateTalentMatching({
    overview: args.overview,
    teams: args.teams,
    orders: args.orders,
    jobs: args.jobs,
    profiles: args.profiles,
    reviews: args.reviews,
    creators: args.creators,
    cases: args.cases,
    creatorPool: args.creatorPool,
  })

  const projects: DiscoveryProjectCard[] = matching.projects.map((project) => {
    const order = args.orders.find((item) => item.id === project.projectId) ?? null
    const job = order ? args.jobs.find((item) => item.id === order.chatId) ?? null : null
    const openGroups = project.roleGroups.filter((group) => group.need.status !== 'filled')
    const openRoles = openGroups.map((group) => getRoleNeedLabel(group.need.role))
    const city = inferProjectCity(project.projectId, args.jobs, args.orders, args.teams, args.creatorPool)
    const styleTags = toStyleTags(`${project.title} ${job?.title ?? ''} ${job?.description ?? ''}`, job?.description ? tokenize(job.description).slice(0, 3) : [])
    const isUrgent = openGroups.some((group) => group.need.priority === 'critical' || group.need.priority === 'high')
    const reasons: DiscoveryReason[] = [
      {
        type: 'open-role-fit',
        message: `当前有 ${openRoles.length} 个待补位角色，适合进入匹配或邀请流程。`,
      },
      {
        type: 'recent-active',
        message: project.currentStage === 'delivery'
          ? '项目已接近交付阶段，协作节奏紧。'
          : `项目当前处于 ${project.currentStage} 阶段，仍在推进中。`,
      },
    ]

    if (styleTags.length > 0) {
      reasons.push({
        type: 'similar-style',
        message: `当前项目风格偏向 ${styleTags.slice(0, 3).join(' / ')}。`,
      })
    }

    return {
      projectId: project.projectId,
      title: project.title,
      stage: project.currentStage,
      city,
      openRoles,
      styleTags,
      priority: isUrgent ? 'urgent' : 'normal',
      summary: job?.description ?? `${project.title} 当前正在寻找 ${openRoles.join('、')} 等关键角色。`,
      reasons: reasons.slice(0, 3),
      deliveryStatus: project.deliveryStatus,
      approvalState: project.currentStage === 'delivery' ? '已进入 delivery / approval 节点' : '尚未进入 delivery',
      projectHref: args.getProjectHref(project.projectId),
      rolesHref: args.getProjectRolesHref(project.projectId),
      inviteHref: args.getProjectInviteHref(project.projectId),
    }
  })

  const creatorMap = new Map<string, DiscoveryCreatorCard>()
  const profileMap = new Map(args.profiles.map((profile) => [profile.id, profile]))
  const creatorModelMap = new Map(args.creators.map((creator) => [creator.id, creator]))
  matching.projects.forEach((project) => {
    project.roleGroups.forEach((group) => {
      group.candidates.forEach((candidate) => {
        const current = creatorMap.get(candidate.profileId)
        const profile = profileMap.get(candidate.profileId)
        const model = creatorModelMap.get(candidate.profileId)
        const mergedReasons = unique([...(current?.reasons ?? []), ...candidate.reasons.map(mapMatchReason)].map((reason) => `${reason.type}:${reason.message}`))
          .map((key) => {
            const [type, ...messageParts] = key.split(':')
            return { type: type as DiscoveryReason['type'], message: messageParts.join(':') }
          })

        creatorMap.set(candidate.profileId, {
          profileId: candidate.profileId,
          displayName: candidate.displayName,
          city: candidate.city,
          roleTags: unique([...(current?.roleTags ?? []), ...candidate.roleTags]),
          ratingSummary: candidate.ratingSummary,
          caseIds: unique([...(current?.caseIds ?? []), ...candidate.matchedCaseIds]),
          styleTags: unique([
            ...(current?.styleTags ?? []),
            ...(profile?.skills ?? []).map(normalizeText),
            ...(model?.tags ?? []).map(normalizeText),
            ...(candidate.reasons.filter((reason) => reason.type === 'style-fit').map((reason) => normalizeText(reason.message))),
          ]).slice(0, 8),
          availability: candidate.availability,
          reasons: mergedReasons.slice(0, 4),
          profileHref: args.getProfileHref(candidate.profileId),
          caseHref: candidate.matchedCaseIds[0] ? args.getCaseHref(candidate.matchedCaseIds[0]) : undefined,
          inviteHref: args.canInviteCreators ? args.getProjectInviteHref(project.projectId) : undefined,
        })
      })
    })
  })

  args.profiles.forEach((profile) => {
    if (creatorMap.has(profile.id)) return
    const creator = creatorModelMap.get(profile.id)
    const reviewSummary = {
      rating: profile.rating ?? creator?.rating ?? computeReviewSummary(profile.id, args.reviews).rating,
      reviewCount: profile.reviewCount ?? computeReviewSummary(profile.id, args.reviews).reviewCount,
    }
    const roleTags = unique([...(profile.skills ?? []), ...(creator?.tags ?? [])]).slice(0, 4)
    const reasons: DiscoveryReason[] = []
    if (reviewSummary.rating >= 4.7) {
      reasons.push({
        type: 'strong-rating',
        message: `评分 ${reviewSummary.rating.toFixed(1)}，有稳定的口碑反馈。`,
      })
    }
    reasons.push({
      type: 'recent-active',
      message: '当前资料可用，适合进一步查看作品与合作方式。',
    })
    creatorMap.set(profile.id, {
      profileId: profile.id,
      displayName: profile.name,
      city: 'Remote',
      roleTags,
      ratingSummary: reviewSummary,
      caseIds: [],
      styleTags: unique([...(profile.skills ?? []).map(normalizeText), ...(creator?.tags ?? []).map(normalizeText)]),
      availability: 'available',
      reasons,
      profileHref: args.getProfileHref(profile.id),
      inviteHref: args.canInviteCreators ? args.getProjectInviteHref(projects[0]?.projectId ?? '') : undefined,
    })
  })

  args.creatorPool.forEach((creator) => {
    if (creatorMap.has(creator.id)) return
    creatorMap.set(creator.id, {
      profileId: creator.id,
      displayName: creator.name,
      city: creator.city,
      roleTags: [creator.role],
      ratingSummary: {
        rating: creator.rating,
        reviewCount: creator.casesCount,
      },
      caseIds: [],
      styleTags: creator.tags.map(normalizeText),
      availability: 'available',
      reasons: [
        {
          type: 'same-city',
          message: `${creator.city} 本地创作者，适合城市内协作。`,
        },
        {
          type: 'strong-rating',
          message: `评分 ${creator.rating.toFixed(1)}，案例数量 ${creator.casesCount}。`,
        },
      ],
      profileHref: args.getProfileHref(creator.id),
      inviteHref: args.canInviteCreators ? args.getProjectInviteHref(projects[0]?.projectId ?? '') : undefined,
    })
  })

  const creators = [...creatorMap.values()].sort((left, right) => {
    const scoreGap = right.ratingSummary.rating - left.ratingSummary.rating
    if (Math.abs(scoreGap) > 0.01) return scoreGap
    return right.ratingSummary.reviewCount - left.ratingSummary.reviewCount
  })

  const cases: DiscoveryCaseCard[] = args.cases.map((caseItem) => {
    const creatorIds = inferCaseCreators(caseItem, creators)
    const linkedCreators = creators.filter((creator) => creatorIds.includes(creator.profileId))
    const reasons: DiscoveryReason[] = [
      {
        type: 'similar-style',
        message: `${caseItem.category} / ${caseItem.title} 适合拿来判断风格与产出质量。`,
      },
    ]

    if (linkedCreators.some((creator) => creator.ratingSummary.rating >= 4.7)) {
      reasons.push({
        type: 'strong-rating',
        message: '关联创作者拥有稳定的高评分反馈。',
      })
    }

    if (linkedCreators.some((creator) => creator.availability === 'available')) {
      reasons.push({
        type: 'recent-active',
        message: '关联创作者当前可用，适合继续深入查看或发起邀请。',
      })
    }

    return {
      caseId: caseItem.id,
      title: caseItem.title,
      category: caseItem.category,
      style: caseItem.description,
      creatorIds,
      quote: caseItem.clientQuote,
      scoreTags: unique([caseItem.result, caseItem.views, caseItem.conversion].filter(Boolean)),
      reasons: reasons.slice(0, 3),
      detailHref: args.getCaseHref(caseItem.id),
      creatorHref: creatorIds[0] ? args.getProfileHref(creatorIds[0]) : undefined,
    }
  })

  return {
    projects,
    creators,
    cases,
    projectCities: unique(projects.map((item) => item.city).filter(Boolean)).sort(),
    creatorCities: unique(creators.map((item) => item.city).filter(Boolean)).sort(),
    roleOptions: unique(creators.flatMap((item) => item.roleTags)).sort(),
    styleOptions: unique([
      ...projects.flatMap((item) => item.styleTags),
      ...creators.flatMap((item) => item.styleTags),
      ...cases.map((item) => item.category),
    ]).sort(),
    categoryOptions: unique(cases.map((item) => item.category)).sort(),
  }
}
