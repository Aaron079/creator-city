'use client'

import { useState } from 'react'

type Props = {
  src: string
  alt: string
}

export function DeliveryItemImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex min-h-56 items-center justify-center bg-black/40 p-6 text-sm text-white/45">
        图片无法加载
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="max-h-[680px] w-full bg-black/40 object-contain" />
}
