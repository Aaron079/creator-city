import { ShieldCheck } from 'lucide-react'
import type { PublicTemplate } from '@/lib/templates/public-template-catalog'

interface TemplateLicenseBadgeProps {
  license: PublicTemplate['license']
  compact?: boolean
}

export function TemplateLicenseBadge({ license, compact = false }: TemplateLicenseBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full bg-white/[0.06] font-medium text-white/52',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
      ].join(' ')}
      title={license.usageNote}
    >
      <ShieldCheck size={compact ? 10 : 11} />
      {license.label}
    </span>
  )
}
