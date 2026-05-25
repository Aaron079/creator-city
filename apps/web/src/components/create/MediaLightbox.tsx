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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.92)',
        cursor: 'zoom-out',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '媒体预览'}
    >
      {/* Close button — subtle, top-right */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="关闭"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '15px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        ✕
      </button>

      {type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title ?? ''}
          draggable={false}
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            display: 'block',
            width: 'auto',
            height: 'auto',
            maxWidth: '92vw',
            maxHeight: '88vh',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 40px 100px rgba(0,0,0,0.85)',
            cursor: 'zoom-out',
            border: 'none',
          }}
        />
      ) : (
        /* Video — clicking body does not close so controls remain usable */
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
              boxShadow: '0 40px 100px rgba(0,0,0,0.85)',
              border: 'none',
            }}
          />
        </div>
      )}

      <span
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.28)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
        }}
      >
        {type === 'video' ? '单击空白处 · ESC 返回' : '单击图片或空白处 · ESC 返回'}
      </span>
    </div>,
    document.body,
  )
}
