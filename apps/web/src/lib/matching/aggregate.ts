import type { DashboardProjectOverview } from '@/lib/dashboard/aggregate'
import type { Case } from '@/lib/case/caseStore'
import type { Creator } from '@/lib/user/creator'
import type { CreatorUser } from '@/lib/data/creators'
import type { UserProfile } from '@/store/profile.store'
import type { Review } from '@/store/review.store'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { ProjectStage, Team } from '@/store/team.store'

export interface RoleNeed {
  id: string
  projectId: string
  role: 'director' | 'cinematographer' | 'editor' | 'colorist' | 'sound' | 'composer' | 'vfx' | 'concept-artist'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'reviewing' | 'filled'
}

export interface MatchReason {
  type: 'same-city' | 'similar-case' | 'strong-rating' | 'matching-role' | 'style-fit' | 'active-now'
  message: string
}

export interface MatchCandidate {
  profileId: string
  displayName: string
  city: string
  roleTags: string[]
  score: number
  reasons: MatchReason[]
  matchedCaseIds: string[]
  ratingSummary: {
    rating: number
    reviewCount: number
  }
  availability: 'available' | 'limited' | 'unavailable'
  bio?: string
  accentColor?: string
  avatar?: string
}

export interface RoleMatchGroup {
  need: RoleNeed
  candidates: MatchCandidate[]
}

export interface TeamAssemblyProject {
  projectId: string
  title: string
  currentStage: ProjectStage
  orderStatus: DashboardProjectOverview['orderStatus']
  deliveryStatus: DashboardProjectOverview['deliveryStatus']
  openRolesCount: number
  roleGroups: RoleMatchGroup[]
}

export interface TalentMatchingData {
  totalOpenRoles: number
  totalProjectsWithGaps: number
  projects: TeamAssemblyProject[]
}

interface AggregateMatchingInput {
  overview: DashboardProjectOverview[]
  teams: Team[]
  orders: Order[]
  jobs: Job[]
  profiles: UserProfile[]
  reviews: Review[]
  creators: Creator[]
  cases: Case[]
  creatorPool: CreatorUser[]
}

interface CandidateSource {
  id: string
  displayName: string
  city: string
  roleTags: string[]
  styleTags: string[]
  rating: number
  reviewCount: number
  availability: MatchCandidate['availability']
  bio?: string
  accentColor?: string
  avatar?: string
}

const ROLE_LABELS: Record<RoleNeed['role'], string> = {
  director: '导演',
  cinematographer: '摄影',
  editor: '剪辑',
  colorist: '调色',
  sound: '声音',
  composer: '配乐',
  vfx: 'VFX',
  'concept-artist': '概念设计',
}

const STAGE_ROLE_BLUEPRINT: Record<ProjectStage, Array<Pick<RoleNeed, 'role' | 'priority'>>> = {
  idea: [
    { role: 'director', priority: 'critical' },
    { role: 'concept-artist', priority: 'high' },
  ],
  storyboard: [
    { role: 'director', priority: 'critical' },
    { role: 'concept-artist', priority: 'high' },
    { role: 'cinematographer', priority: 'medium' },
  ],
  shooting: [
    { role: 'director', priority: 'high' },
    { role: 'cinematographer', priority: 'critical' },
    { role: 'sound', priority: 'high' },
  ],
  editing: [
    { role: 'editor', priority: 'critical' },
    { role: 'colorist', priority: 'medium' },
    { role: 'composer', priority: 'medium' },
  ],
  delivery: [
    { role: 'editor', priority: 'high' },
    { role: 'colorist', priority: 'medium' },
    { role: 'sound', priority: 'medium' },
  ],
}

const ROLE_ALIASES: Record<RoleNeed['role'], string[]> = {
  director: ['director', '导演', 'direct', '分镜', 'storyboard', '品牌广告', '短片', '纪录片', 'mv', '创意'],
  cinematographer: ['cinematographer', '摄影', '摄影师', 'camera', '拍摄', '航拍', '产品摄影', '建筑摄影'],
  editor: ['editor', '剪辑', '剪辑师', '编辑', '快剪', '预告片', 'cut', 'montage'],
  colorist: ['colorist', '调色', '色彩', 'look', 'grade', '电影级'],
  sound: ['sound', '声音', '音频', '音效', '环境音', '混音'],
  composer: ['composer', '配乐', '音乐', 'ost', 'mv', '电子配乐'],
  vfx: ['vfx', '特效', '合成', 'cg', '科幻'],
  'concept-artist': ['concept-artist', '概念', '角色设计', '世界观', '设定', 'visual development', '插画'],
}

function normalizeText(text: string) {
  return text.trim().toLowerCase()
}

function includesAny(haystack: string[], needles: string[]) {
  return needles.some((needle) => haystack.some((item) => item.includes(normalizeText(needle))))
}

function normalizeRoleTags(tags: string[]) {
  const normalized = tags.map(normalizeText)
  return (Object.keys(ROLE_ALIASES) as RoleNeed['role'][]).filter((role) => includesAny(normalized, ROLE_ALIASES[role]))
}

function deriveAvailability(candidateId: string, teams: Team[]): MatchCandidate['availability'] {
  let joinedCount = 0
  let invitedCount = 0

  teams.forEach((team) => {
    team.members.forEach((member) => {
      if (member.userId !== candidateId) return
      if (member.status === 'joined') joinedCount += 1
      if (member.status === 'invited') invitedCount += 1
    })
  })

  if (joinedCount >= 2) return 'unavailable'
  if (joinedCount >= 1 || invitedCount >= 1) return 'limited'
  return 'available'
}

function buildCandidatePool(input: AggregateMatchingInput): CandidateSource[] {
  const creatorById = new Map(input.creators.map((creator) => [creator.id, creator]))
  const reviewsByAuthor = new Map<string, Review[]>()

  input.reviews.forEach((review) => {
    const group = reviewsByAuthor.get(review.authorId) ?? []
    group.push(review)
    reviewsByAuthor.set(review.authorId, group)
  })

  const internalCandidates = input.profiles.map((profile) => {
    const creator = creatorById.get(profile.id)
    const reviews = reviewsByAuthor.get(profile.id) ?? []
    const reviewCount = profile.reviewCount ?? reviews.length
    const rating = profile.rating
      ?? creator?.rating
      ?? (reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0)
    const sourceTags = [
      ...(profile.skills ?? []),
      ...(creator?.tags ?? []),
      profile.bio ?? '',
      profile.name,
    ]
    const roleTags = normalizeRoleTags(sourceTags)

    return {
      id: profile.id,
      displayName: profile.name,
      city: 'Remote',
      roleTags,
      styleTags: sourceTags.map(normalizeText),
      rating,
      reviewCount,
      availability: deriveAvailability(profile.id, input.teams),
      bio: profile.bio,
      accentColor: profile.accentColor,
      avatar: profile.avatar,
    } satisfies CandidateSource
  })

  const cityCandidates = input.creatorPool.map((creator) => {
    const roleTags = normalizeRoleTags([creator.role, ...creator.tags])
    return {
      id: creator.id,
      displayName: creator.name,
      city: creator.city,
      roleTags,
      styleTags: [creator.role, ...creator.tags].map(normalizeText),
      rating: creator.rating,
      reviewCount: creator.casesCount,
      availability: deriveAvailability(creator.id, input.teams),
      bio: `${creator.city} · ${creator.role}`,
      accentColor: creator.accent,
      avatar: creator.avatar,
    } satisfies CandidateSource
  })

  return [...internalCandidates, ...cityCandidates].filter((candidate) => candidate.id !== 'user-current')
}

function inferProjectCity(projectId: string, team: Team | null, job: Job | null, creatorPool: CreatorUser[]) {
  if (job?.cityId) return job.cityId

  const creatorCityMap = new Map(creatorPool.map((creator) => [creator.id, creator.city]))
  const firstTeamCity = team?.members
    .map((member) => creatorCityMap.get(member.userId))
    .find((city): city is string => Boolean(city))

  return firstTeamCity ?? null
}

function buildProjectCaseMatches(projectText: string, cases: Case[]) {
  const tokens = normalizeText(projectText).split(/[\s、，,。.-]+/).filter(Boolean)
  return cases
    .map((item) => {
      const searchable = normalizeText(`${item.title} ${item.description} ${item.category}`)
      const overlap = tokens.filter((token) => searchable.includes(token)).length
      return { caseId: item.id, overlap }
    })
    .filter((item) => item.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 2)
    .map((item) => item.caseId)
}

function candidateSupportsRole(candidate: CandidateSource, role: RoleNeed['role']) {
  if (candidate.roleTags.includes(role)) return true
  if (role === 'colorist') return candidate.roleTags.includes('editor')
  if (role === 'sound') return candidate.roleTags.includes('composer')
  if (role === 'composer') return candidate.roleTags.includes('sound')
  if (role === 'concept-artist') return candidate.roleTags.includes('director')
  return false
}

function deriveNeedStatus(role: RoleNeed['role'], team: Team | null): RoleNeed['status'] {
  if (!team) return 'open'
  const memberRoles = team.members.map((member) => ({
    status: member.status,
    tags: normalizeRoleTags([member.role]),
  }))

  if (memberRoles.some((member) => member.status === 'joined' && member.tags.includes(role))) return 'filled'
  if (memberRoles.some((member) => member.status === 'invited' && member.tags.includes(role))) return 'reviewing'
  return 'open'
}

function scoreCandidate(params: {
  candidate: CandidateSource
  role: RoleNeed['role']
  preferredCity: string | null
  projectText: string
  matchedCaseIds: string[]
}): MatchCandidate {
  const { candidate, role, preferredCity, projectText, matchedCaseIds } = params
  const reasons: MatchReason[] = [{
    type: 'matching-role',
    message: `${candidate.displayName} 的标签与 ${ROLE_LABELS[role]} 需求匹配。`,
  }]

  let score = candidate.roleTags.includes(role) ? 48 : 34

  if (preferredCity && normalizeText(candidate.city) === normalizeText(preferredCity)) {
    score += 12
    reasons.push({
      type: 'same-city',
      message: `当前项目偏向 ${preferredCity} 协作，候选人与项目城市一致。`,
    })
  }

  if (matchedCaseIds.length > 0) {
    score += 12
    reasons.push({
      type: 'similar-case',
      message: `与现有案例类型接近，可快速复用相近创作经验。`,
    })
  }

  const projectTokens = normalizeText(projectText).split(/[\s、，,。.-]+/).filter(Boolean)
  const styleHits = projectTokens.filter((token) => candidate.styleTags.some((tag) => tag.includes(token))).length
  if (styleHits > 0) {
    score += Math.min(10, styleHits * 3)
    reasons.push({
      type: 'style-fit',
      message: `风格标签与项目关键词有 ${styleHits} 处重合。`,
    })
  }

  if (candidate.rating >= 4.7 || candidate.reviewCount >= 3) {
    score += 10
    reasons.push({
      type: 'strong-rating',
      message: `口碑稳定，评分 ${candidate.rating.toFixed(1)} / ${Math.max(candidate.reviewCount, 1)} 条参考记录。`,
    })
  }

  if (candidate.availability === 'available') {
    score += 8
    reasons.push({
      type: 'active-now',
      message: '当前可接新项目，适合进入邀请名单。',
    })
  } else if (candidate.availability === 'limited') {
    score += 3
    reasons.push({
      type: 'active-now',
      message: '当前有在进行中的合作，建议先沟通可用时间。',
    })
  } else {
    score -= 8
    reasons.push({
      type: 'active-now',
      message: '当前负载较高，仅建议作为备选。',
    })
  }

  return {
    profileId: candidate.id,
    displayName: candidate.displayName,
    city: candidate.city,
    roleTags: candidate.roleTags.length > 0 ? candidate.roleTags : [role],
    score: Math.round(score),
    reasons: reasons.slice(0, 4),
    matchedCaseIds,
    ratingSummary: {
      rating: Number(candidate.rating.toFixed(2)),
      reviewCount: candidate.reviewCount,
    },
    availability: candidate.availability,
    bio: candidate.bio,
    accentColor: candidate.accentColor,
    avatar: candidate.avatar,
  }
}

export function aggregateTalentMatching(input: AggregateMatchingInput): TalentMatchingData {
  const candidates = buildCandidatePool(input)
  const ordersById = new Map(input.orders.map((order) => [order.id, order]))
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]))
  const teamsByProjectId = new Map(input.teams.map((team) => [team.projectId, team]))

  const projects = input.overview.map((project) => {
    const team = teamsByProjectId.get(project.projectId) ?? null
    const order = ordersById.get(project.projectId) ?? null
    const job = order ? jobsById.get(order.chatId) ?? null : null
    const preferredCity = inferProjectCity(project.projectId, team, job, input.creatorPool)
    const projectText = `${project.title} ${job?.title ?? ''} ${job?.description ?? ''} ${project.currentStage}`
    const suggestedCases = buildProjectCaseMatches(projectText, input.cases)
    const memberIds = new Set((team?.members ?? []).map((member) => member.userId))

    const roleGroups = STAGE_ROLE_BLUEPRINT[project.currentStage].map((blueprint) => {
      const need: RoleNeed = {
        id: `${project.projectId}-${blueprint.role}`,
        projectId: project.projectId,
        role: blueprint.role,
        priority: blueprint.priority,
        status: deriveNeedStatus(blueprint.role, team),
      }

      const roleCandidates = candidates
        .filter((candidate) => !memberIds.has(candidate.id))
        .filter((candidate) => candidateSupportsRole(candidate, blueprint.role))
        .map((candidate) => scoreCandidate({
          candidate,
          role: blueprint.role,
          preferredCity,
          projectText,
          matchedCaseIds: suggestedCases,
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)

      return {
        need,
        candidates: roleCandidates,
      } satisfies RoleMatchGroup
    })

    const openRolesCount = roleGroups.filter((group) => group.need.status !== 'filled').length

    return {
      projectId: project.projectId,
      title: project.title,
      currentStage: project.currentStage,
      orderStatus: project.orderStatus,
      deliveryStatus: project.deliveryStatus,
      openRolesCount,
      roleGroups,
    } satisfies TeamAssemblyProject
  }).filter((project) => project.roleGroups.some((group) => group.need.status !== 'filled'))

  return {
    totalOpenRoles: projects.reduce((sum, project) => sum + project.openRolesCount, 0),
    totalProjectsWithGaps: projects.length,
    projects,
  }
}

export function getRoleNeedLabel(role: RoleNeed['role']) {
  return ROLE_LABELS[role]
}
