'use client'

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/8 bg-black/10 p-4">
      <div className="h-3 w-28 rounded bg-white/10" />
      <div className="mt-3 h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-4 h-3 w-full rounded bg-white/5" />
      <div className="mt-2 h-3 w-4/5 rounded bg-white/5" />
    </div>
  )
}

export function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

export function LoadingState({
  title = '正在加载',
  message = '内容准备中，请稍候。',
  count = 3,
}: {
  title?: string
  message?: string
  count?: number
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-5">
      <div className="font-medium text-white">{title}</div>
      <p className="mt-2 text-sm text-white/50">{message}</p>
      <div className="mt-4">
        <SectionSkeleton count={count} />
      </div>
    </div>
  )
}
