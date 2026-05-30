const ADMIN_TZ = 'Asia/Shanghai'

export function formatAdminDateTime(value: string | Date | null | undefined, empty = '—'): string {
  if (!value) return empty
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: ADMIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function formatAdminDate(value: string | Date | null | undefined, empty = '—'): string {
  if (!value) return empty
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: ADMIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}
