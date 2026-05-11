/**
 * Returns a server-proxied URL for any image/video/audio URL.
 * - Bypasses CORS restrictions and provider-specific auth headers.
 * - Data URLs are returned unchanged (they don't need proxying).
 * - Empty/null input returns empty string.
 */
export function getProxiedMediaUrl(url?: string | null): string {
  if (!url?.trim()) return ''
  if (url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  return `/api/media/proxy?url=${encodeURIComponent(url)}`
}
