'use client'

import { type CSSProperties, type PointerEvent, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import styles from './ChromaGrid.module.css'

export interface ChromaItem {
  image: string
  title: string
  subtitle?: string
  handle?: string
  borderColor?: string
  gradient?: string
  url?: string
  location?: string
}

interface ChromaGridProps {
  items: ChromaItem[]
  className?: string
  radius?: number
  columns?: number
  rows?: number
  damping?: number
  fadeOut?: number
  ease?: string
}

type ChromaStyle = CSSProperties & {
  '--r'?: string
  '--cols'?: number
  '--rows'?: number
  '--card-border'?: string
  '--card-gradient'?: string
}

type QuickSet = (value: number | string) => void

export default function ChromaGrid({
  items,
  className = '',
  radius = 330,
  columns = 3,
  rows = 2,
  damping = 0.45,
  fadeOut = 0.6,
  ease = 'power3.out',
}: ChromaGridProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fadeRef = useRef<HTMLDivElement | null>(null)
  const setX = useRef<QuickSet | null>(null)
  const setY = useRef<QuickSet | null>(null)
  const pos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    setX.current = gsap.quickSetter(el, '--x', 'px') as QuickSet
    setY.current = gsap.quickSetter(el, '--y', 'px') as QuickSet
    const { width, height } = el.getBoundingClientRect()
    pos.current = { x: width / 2, y: height / 2 }
    setX.current(pos.current.x)
    setY.current(pos.current.y)
  }, [])

  const moveTo = (x: number, y: number) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      overwrite: true,
      onUpdate: () => {
        setX.current?.(pos.current.x)
        setY.current?.(pos.current.y)
      },
    })
  }

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    moveTo(event.clientX - rect.left, event.clientY - rect.top)
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true })
  }

  const handleLeave = () => {
    gsap.to(fadeRef.current, { opacity: 1, duration: fadeOut, overwrite: true })
  }

  const handleCardMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
  }

  const openItem = (url?: string) => {
    if (!url) return
    if (/^https?:\/\//.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    window.location.href = url
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.grid} ${className}`}
      style={{ '--r': `${radius}px`, '--cols': columns, '--rows': rows } as ChromaStyle}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {items.map((item) => (
        <article
          key={`${item.title}-${item.url ?? item.image}`}
          className={styles.card}
          onPointerMove={handleCardMove}
          onClick={() => openItem(item.url)}
          style={{
            '--card-border': item.borderColor ?? 'rgba(255,255,255,0.32)',
            '--card-gradient': item.gradient ?? 'linear-gradient(145deg, rgba(100,116,139,0.45), #050407)',
            cursor: item.url ? 'pointer' : 'default',
          } as ChromaStyle}
        >
          <div className={styles.imageFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt={item.title} loading="lazy" />
          </div>
          <footer className={styles.info}>
            <h3 className={styles.title}>{item.title}</h3>
            {item.handle ? <span className={styles.handle}>{item.handle}</span> : null}
            {item.subtitle ? <p className={styles.subtitle}>{item.subtitle}</p> : null}
            {item.location ? <span className={styles.location}>{item.location}</span> : null}
          </footer>
        </article>
      ))}
      <div className={styles.overlay} />
      <div ref={fadeRef} className={styles.fade} />
    </div>
  )
}
