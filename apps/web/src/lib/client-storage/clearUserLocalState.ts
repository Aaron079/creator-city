'use client'

// Keys that hold user-specific project/canvas data.
// All of these must be removed when a user logs out to prevent
// cross-account data leakage via the browser's local storage.

const USER_SCOPED_EXACT_KEYS = [
  'creator-city:last-project-id',
  'creator-city:last-workflow-id',
  'creator-city:projects-cache',
] as const

// Per-project data is keyed as "<prefix><projectId>".
// We match by prefix so we don't need to know every projectId in advance.
const USER_SCOPED_KEY_PREFIXES = [
  'creator-city-canvas-draft:',
  'creator-city:draft:',
  'creator-city:canvas-cache:',
  'creator-city:canvas-snapshot:',
  'creator-city:style-bible:',
  'creator-city:enabled-skills:',
  'creator-city:canvas-comments-cache:',
  'creator-city:canvas-comments-pending:',
  'creator-city:storyboard:director:',
  'creator-city:scene-bible:',
  'creator-city:character-bible:',
] as const

export function clearUserScopedLocalState(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of USER_SCOPED_EXACT_KEYS) {
      window.localStorage.removeItem(key)
    }

    // Collect prefix-matched keys before removing — modifying storage while
    // iterating over it by index is undefined behavior in some browsers.
    const prefixMatches: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && USER_SCOPED_KEY_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        prefixMatches.push(k)
      }
    }
    for (const k of prefixMatches) {
      window.localStorage.removeItem(k)
    }
  } catch {
    // Private/incognito mode or storage quota error — non-fatal.
  }
}
