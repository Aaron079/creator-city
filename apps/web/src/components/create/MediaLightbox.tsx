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
    // Backdrop — click anywhere on it to close
    <div
      className="fixed inset-0 z-[99999] flex cursor-pointer items-center justify-center bg-black/82"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '媒体预览'}
    >
      {/* Media container — stops clicks from propagating so only backdrop closes */}
      <div
        className="relative"
        style={{ maxWidth: '88vw', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — always visible, top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
          aria-label="关闭预览"
          style={{ pointerEvents: 'auto' }}
        >
          ✕
        </button>

        {type === 'image' ? (
          // Image: click image body also closes
          // explicit width + height + object-contain so it fills up to 88vw×88vh
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title ?? ''}
            draggable={false}
            onClick={onClose}
            className="block cursor-pointer rounded-xl shadow-2xl"
            style={{
              objectFit: 'contain',
              width: '88vw',
              height: '88vh',
              maxWidth: '88vw',
              maxHeight: '88vh',
            }}
          />
        ) : (
          // Video: click on video itself does NOT close (controls are there)
          // Backdrop click (above) and X button close it
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={url}
            controls
            playsInline
            className="block rounded-xl shadow-2xl"
            style={{
              objectFit: 'contain',
              width: '88vw',
              height: '88vh',
              maxWidth: '88vw',
              maxHeight: '88vh',
            }}
          />
        )}

        {/* Hint label */}
        <span
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-3 py-1 text-[10px] leading-none text-white/45 select-none"
          aria-hidden="true"
        >
          {type === 'video' ? '单击遮罩 / ✕ / ESC 关闭' : '单击图片或遮罩 / ESC 关闭'}
        </span>
      </div>
    </div>,
    document.body,
  )
}
