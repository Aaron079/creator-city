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
    console.info('[MediaLightbox] mounted', { type, url })
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.info('[MediaLightbox] close via ESC')
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      console.info('[MediaLightbox] unmounted')
    }
  }, [onClose, type, url])

  // Skip during SSR
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      // Full-viewport overlay. zIndex is forced via inline style (not just Tailwind)
      // to guarantee it survives any CSS specificity war or purge.
      // bg is also inline for the same reason.
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        cursor: 'pointer',
      }}
      onClick={() => {
        console.info('[MediaLightbox] close via backdrop click')
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '媒体预览'}
    >
      {/* Debug label — visible proof that the lightbox actually opened.
          Remove after user confirms feature works. */}
      <span
        style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          zIndex: 10,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.55)',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '4px',
          padding: '3px 8px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        MEDIA LIGHTBOX OPEN
      </span>

      {/* Close button — top right, always visible */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          console.info('[MediaLightbox] close via ✕ button')
          onClose()
        }}
        aria-label="关闭预览"
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 10,
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.22)',
          background: 'rgba(0,0,0,0.55)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {type === 'image' ? (
        // Clicking the image also closes — this is the main close affordance.
        // width/height auto + max constraints → natural aspect ratio preserved.
        // objectFit: contain is present but redundant with auto dimensions;
        // the browser preserves ratio naturally. Inline style = no Tailwind purge risk.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title ?? ''}
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            console.info('[MediaLightbox] close via image click')
            onClose()
          }}
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
        // Video: clicking the video body must NOT close (controls need to work).
        // Only backdrop, ESC, or ✕ close.
        <div
          style={{ position: 'relative', lineHeight: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={url}
            controls
            playsInline
            autoPlay={false}
            style={{
              display: 'block',
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

      {/* Hint text — stays at viewport bottom */}
      <span
        style={{
          position: 'absolute',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.38)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {type === 'video'
          ? '单击空白处 / ✕ / ESC 返回画布'
          : '单击图片或空白处 / ESC 返回画布'}
      </span>
    </div>,
    document.body,
  )
}
