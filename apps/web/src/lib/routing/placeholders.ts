function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizedCandidates(value: string) {
  const decoded = safeDecode(value)
  return [value, decoded].map((candidate) => candidate.trim().toLowerCase())
}

export function isPlaceholderProjectId(projectId: string | null | undefined) {
  if (!projectId) return false

  return normalizedCandidates(projectId).some((candidate) => (
    candidate === '<projectid>'
    || candidate === '%3cprojectid%3e'
    || candidate.includes('%3c')
    || candidate.includes('<projectid>')
  ))
}

export function isPlaceholderDeliveryToken(token: string | null | undefined) {
  if (!token) return false

  return normalizedCandidates(token).some((candidate) => (
    candidate === '<token>'
    || candidate === '%3ctoken%3e'
    || candidate.includes('%3c')
    || candidate.includes('<token>')
  ))
}
