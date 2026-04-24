'use client'

export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string
  title?: string
  description?: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">{eyebrow}</p>
        ) : null}
        {title ? <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2> : null}
        {description ? <p className="mt-2 max-w-3xl text-sm text-white/55">{description}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  )
}
