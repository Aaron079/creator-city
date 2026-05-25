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
  // ESC to close — listener attached when lightbox mounts, removed when it unmounts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Skip during SSR — lightbox only ever opens from a client click anyway
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      // Full-viewport fixed overlay — always above canvas, toolbar, AI button
      // bg-black/80 = rgba(0,0,0,0.80), a safe standard Tailwind value
      className="fixed inset-0 z-[99999] flex cursor-pointer items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '媒体预览'}
    >
      {type === 'image' ? (
        // Image — clicks on image also close
        // width/height auto + max constraints → natural aspect ratio, fills up to 92vw × 88vh
        // No object-fit needed: browser preserves ratio naturally with auto dimensions
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title ?? ''}
          draggable={false}
          onClick={onClose}
          style={{
            display: 'block',
            width: 'auto',
            height: 'auto',
            maxWidth: '92vw',
            maxHeight: '88vh',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            cursor: 'pointer',
          }}
        />
      ) : (
        // Video — clicking video body does NOT close (controls must work)
        // Only backdrop click, ESC, or ✕ button closes it
        <div
          style={{ position: 'relative', lineHeight: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ✕ close button — always visible top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭预览"
            style={{
              position: 'absolute',
              top: '-14px',
              right: '-14px',
              zIndex: 10,
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.6)',
              color: 'rgba(255,255,255,0.75)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={url}
            controls
            playsInline
            style={{
              display: 'block',
              // width: min(92vw, 1280px) → fills screen up to 1280px, shrinks on small screens
              width: 'min(92vw, 1280px)',
              height: 'auto',
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}
          />
        </div>
      )}

      {/* Hint — stays at viewport bottom, never overlaps media */}
      <span
        style={{
          position: 'absolute',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.35)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {type === 'video' ? '单击空白处 / ✕ / ESC 返回画布' : '单击图片或空白处 / ESC 返回画布'}
      </span>
    </div>,
    document.body,
  )
}
