'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export function InvalidTokenState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <ErrorState
      title={title}
      message={message}
      actionHref="/me"
      actionLabel="返回我的工作台"
    />
  )
}
