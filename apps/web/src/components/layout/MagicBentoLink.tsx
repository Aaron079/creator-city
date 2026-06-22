'use client'

import Link from 'next/link'
import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import styles from './MagicBentoLink.module.css'

type MagicStyle = CSSProperties & {
  '--magic-glow-color'?: string
  '--glow-x'?: string
  '--glow-y'?: string
  '--glow-intensity'?: number
  '--glow-radius'?: string
}

interface MagicBentoLinkProps {
  href: string
  children: ReactNode
  className?: string
  variant?: 'compact' | 'pill' | 'context'
  active?: boolean
  glowColor?: string
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function MagicBentoLink({
  href,
  children,
  className = '',
  variant = 'compact',
  active = false,
  glowColor = '132, 0, 255',
  onClick,
}: MagicBentoLinkProps) {
  const ref = useRef<HTMLAnchorElement | null>(null)
  const particlesRef = useRef<HTMLSpanElement[]>([])

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const clearParticles = () => {
      particlesRef.current.forEach((particle) => {
        gsap.to(particle, {
          opacity: 0,
          scale: 0,
          duration: 0.22,
          ease: 'power2.out',
          onComplete: () => particle.remove(),
        })
      })
      particlesRef.current = []
    }

    const spawnParticles = () => {
      clearParticles()
      const rect = el.getBoundingClientRect()
      const count = variant === 'pill' ? 4 : 6
      for (let index = 0; index < count; index += 1) {
        const particle = document.createElement('span')
        particle.className = styles.particle ?? ''
        particle.style.left = `${Math.random() * rect.width}px`
        particle.style.top = `${Math.random() * rect.height}px`
        el.appendChild(particle)
        particlesRef.current.push(particle)
        gsap.fromTo(particle, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.2, delay: index * 0.035, ease: 'back.out(1.7)' })
        gsap.to(particle, {
          x: (Math.random() - 0.5) * 46,
          y: (Math.random() - 0.5) * 46,
          opacity: 0.22,
          duration: 1.3 + Math.random() * 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      }
    }

    const handleEnter = () => {
      spawnParticles()
      gsap.to(el, {
        rotateX: variant === 'pill' ? 0 : 2.5,
        rotateY: variant === 'pill' ? 0 : -2.5,
        duration: 0.2,
        ease: 'power2.out',
        transformPerspective: 900,
      })
    }

    const handleLeave = () => {
      clearParticles()
      el.style.setProperty('--glow-intensity', '0')
      gsap.to(el, { x: 0, y: 0, rotateX: 0, rotateY: 0, duration: 0.24, ease: 'power2.out' })
    }

    const handleMove = (event: globalThis.MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      el.style.setProperty('--glow-x', `${(x / rect.width) * 100}%`)
      el.style.setProperty('--glow-y', `${(y / rect.height) * 100}%`)
      el.style.setProperty('--glow-intensity', '1')
      if (variant !== 'pill') {
        gsap.to(el, {
          x: (x - centerX) * 0.035,
          y: (y - centerY) * 0.035,
          rotateX: ((y - centerY) / centerY) * -4,
          rotateY: ((x - centerX) / centerX) * 4,
          duration: 0.18,
          ease: 'power2.out',
        })
      }
    }

    el.addEventListener('mouseenter', handleEnter)
    el.addEventListener('mouseleave', handleLeave)
    el.addEventListener('mousemove', handleMove)
    return () => {
      el.removeEventListener('mouseenter', handleEnter)
      el.removeEventListener('mouseleave', handleLeave)
      el.removeEventListener('mousemove', handleMove)
      clearParticles()
    }
  }, [variant])

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!prefersReducedMotion()) {
      const el = ref.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const maxDistance = Math.max(
          Math.hypot(x, y),
          Math.hypot(x - rect.width, y),
          Math.hypot(x, y - rect.height),
          Math.hypot(x - rect.width, y - rect.height),
        )
        const ripple = document.createElement('span')
        ripple.className = styles.ripple ?? ''
        ripple.style.width = `${maxDistance * 2}px`
        ripple.style.height = `${maxDistance * 2}px`
        ripple.style.left = `${x - maxDistance}px`
        ripple.style.top = `${y - maxDistance}px`
        el.appendChild(ripple)
        gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.62, ease: 'power2.out', onComplete: () => ripple.remove() })
      }
    }
    onClick?.(event)
  }

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={`${styles.item} ${styles[variant]} ${active ? styles.active : ''} ${className}`}
      style={{ '--magic-glow-color': glowColor } as MagicStyle}
    >
      <span className={styles.label}>{children}</span>
    </Link>
  )
}
