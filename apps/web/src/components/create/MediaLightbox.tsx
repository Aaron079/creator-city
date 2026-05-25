'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface MediaLightboxState {
  type: 'image' | 'video'
  url: string
  title?: string
}

interface MediaLightboxProps extends MediaLightboxState {
  onClose: () => void
}

export function MediaLightbox({ type, url, title, onClose }: MediaLightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black/80 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '媒体预览'}
    >
      <div
        className="group relative flex items-center justify-center"
        style={{ maxWidth: '88vw', maxHeight: '88vh' }}
      >
        {type === 'image' ? (
          <img
            src={url}
            alt={title ?? ''}
            className="cursor-pointer rounded-xl object-contain shadow-2xl"
            style={{ maxWidth: '88vw', maxHeight: '88vh' }}
            draggable={false}
            onClick={onClose}
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={url}
            className="rounded-xl object-contain shadow-2xl"
            style={{ maxWidth: '88vw', maxHeight: '88vh' }}
            controls
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Close hint — fades in on hover */}
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-[10px] leading-none text-white/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 select-none">
          {type === 'video' ? '单击遮罩 / ESC 关闭' : '单击 / ESC 关闭'}
        </span>
      </div>
    </div>,
    document.body,
  )
}
