import type {
  DiscoveryCaseCard,
  DiscoveryCreatorCard,
  DiscoveryProjectCard,
} from '@/lib/discovery/aggregate'

export interface DiscoveryFilters {
  keyword: string
  city: string
  role: string
  style: string
  category: string
  minRating: number
  availability: string
  openRolesOnly: boolean
  highRatingOnly: boolean
  availableNowOnly: boolean
  unreadOnly?: boolean
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function includesKeyword(text: string, keyword: string) {
  if (!keyword.trim()) return true
  return normalizeText(text).includes(normalizeText(keyword))
}

export function filterDiscoveryProjects(items: DiscoveryProjectCard[], filters: DiscoveryFilters) {
  return items
    .filter((item) => {
      if (filters.openRolesOnly && item.openRoles.length === 0) return false
      if (filters.city && normalizeText(item.city) !== normalizeText(filters.city)) return false
      if (filters.role && !item.openRoles.some((role) => normalizeText(role).includes(normalizeText(filters.role)))) return false
      if (filters.style && !item.styleTags.some((tag) => tag.includes(normalizeText(filters.style)))) return false
      if (filters.category && !includesKeyword(item.summary, filters.category)) return false
      if (!includesKeyword(`${item.title} ${item.summary} ${item.openRoles.join(' ')} ${item.styleTags.join(' ')}`, filters.keyword)) return false
      return true
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority === 'urgent' ? -1 : 1
      return right.openRoles.length - left.openRoles.length
    })
}

export function filterDiscoveryCreators(items: DiscoveryCreatorCard[], filters: DiscoveryFilters) {
  return items
    .filter((item) => {
      if (filters.city && normalizeText(item.city) !== normalizeText(filters.city)) return false
      if (filters.role && !item.roleTags.some((tag) => normalizeText(tag).includes(normalizeText(filters.role)))) return false
      if (filters.style && !item.styleTags.some((tag) => tag.includes(normalizeText(filters.style)))) return false
      if (filters.minRating > 0 && item.ratingSummary.rating < filters.minRating) return false
      if (filters.highRatingOnly && item.ratingSummary.rating < 4.7) return false
      if (filters.availability && item.availability !== filters.availability) return false
      if (filters.availableNowOnly && item.availability !== 'available') return false
      if (!includesKeyword(`${item.displayName} ${item.city} ${item.roleTags.join(' ')} ${item.styleTags.join(' ')}`, filters.keyword)) return false
      return true
    })
    .sort((left, right) => {
      if (left.availability !== right.availability) {
        const order = { available: 0, limited: 1, unavailable: 2 }
        return order[left.availability] - order[right.availability]
      }
      if (Math.abs(right.ratingSummary.rating - left.ratingSummary.rating) > 0.01) {
        return right.ratingSummary.rating - left.ratingSummary.rating
      }
      return right.ratingSummary.reviewCount - left.ratingSummary.reviewCount
    })
}

export function filterDiscoveryCases(items: DiscoveryCaseCard[], filters: DiscoveryFilters) {
  return items
    .filter((item) => {
      if (filters.category && normalizeText(item.category) !== normalizeText(filters.category)) return false
      if (filters.style && !normalizeText(`${item.title} ${item.style} ${item.category}`).includes(normalizeText(filters.style))) return false
      if (!includesKeyword(`${item.title} ${item.style} ${item.category} ${(item.quote ?? '')}`, filters.keyword)) return false
      return true
    })
    .sort((left, right) => right.creatorIds.length - left.creatorIds.length)
}
