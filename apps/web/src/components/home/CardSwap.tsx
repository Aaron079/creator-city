'use client'

import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react'
import gsap from 'gsap'
import styles from './CardSwap.module.css'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  customClass?: string
}

type CardSwapProps = {
  width?: number | string
  height?: number | string
  cardDistance?: number
  verticalDistance?: number
  delay?: number
  pauseOnHover?: boolean
  onCardClick?: (index: number) => void
  skewAmount?: number
  easing?: 'linear' | 'elastic'
  children: ReactNode
}

type Slot = {
  x: number
  y: number
  z: number
  zIndex: number
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass = '', className = '', ...rest }, ref) => (
  <div ref={ref} {...rest} className={`${styles.card} ${customClass} ${className}`.trim()} />
))
Card.displayName = 'Card'

function makeSlot(index: number, distX: number, distY: number, total: number): Slot {
  return {
    x: index * distX,
    y: -index * distY,
    z: -index * distX * 1.5,
    zIndex: total - index,
  }
}

function placeNow(element: HTMLDivElement | null, slot: Slot, skew: number) {
  if (!element) return
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  })
}

function getConfig(easing: 'linear' | 'elastic') {
  return easing === 'elastic'
    ? {
        ease: 'elastic.out(0.6,0.9)',
        durDrop: 2,
        durMove: 2,
        durReturn: 2,
        promoteOverlap: 0.9,
        returnDelay: 0.05,
      }
    : {
        ease: 'power1.inOut',
        durDrop: 0.8,
        durMove: 0.8,
        durReturn: 0.8,
        promoteOverlap: 0.45,
        returnDelay: 0.2,
      }
}

export default function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  children,
}: CardSwapProps) {
  const config = useMemo(() => getConfig(easing), [easing])
  const childArr = useMemo(() => Children.toArray(children), [children])
  const refs = useRef<RefObject<HTMLDivElement>[]>([])
  const order = useRef<number[]>([])
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const intervalRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  if (refs.current.length !== childArr.length) {
    refs.current = childArr.map(() => ({ current: null }))
    order.current = Array.from({ length: childArr.length }, (_, index) => index)
  }

  useEffect(() => {
    const total = refs.current.length
    if (!total) return undefined

    refs.current.forEach((ref, index) => {
      placeNow(ref.current, makeSlot(index, cardDistance, verticalDistance, total), skewAmount)
    })

    const clearSwapInterval = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const swap = () => {
      if (order.current.length < 2) return

      const [front, ...rest] = order.current
      if (typeof front !== 'number') return

      const frontElement = refs.current[front]?.current
      if (!frontElement) return

      const timeline = gsap.timeline()
      timelineRef.current = timeline

      timeline.to(frontElement, {
        y: '+=500',
        duration: config.durDrop,
        ease: config.ease,
      })

      timeline.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`)
      rest.forEach((idx, index) => {
        const element = refs.current[idx]?.current
        if (!element) return

        const slot = makeSlot(index, cardDistance, verticalDistance, total)
        timeline.set(element, { zIndex: slot.zIndex }, 'promote')
        timeline.to(
          element,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: config.durMove,
            ease: config.ease,
          },
          `promote+=${index * 0.15}`
        )
      })

      const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total)
      timeline.addLabel('return', `promote+=${config.durMove * config.returnDelay}`)
      timeline.call(() => {
        gsap.set(frontElement, { zIndex: backSlot.zIndex })
      }, undefined, 'return')
      timeline.to(
        frontElement,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: config.durReturn,
          ease: config.ease,
        },
        'return'
      )
      timeline.call(() => {
        order.current = [...rest, front]
      })
    }

    swap()
    intervalRef.current = window.setInterval(swap, delay)

    const node = containerRef.current
    const pause = () => {
      timelineRef.current?.pause()
      clearSwapInterval()
    }
    const resume = () => {
      timelineRef.current?.play()
      clearSwapInterval()
      intervalRef.current = window.setInterval(swap, delay)
    }

    if (pauseOnHover && node) {
      node.addEventListener('mouseenter', pause)
      node.addEventListener('mouseleave', resume)
    }

    return () => {
      timelineRef.current?.kill()
      clearSwapInterval()
      if (pauseOnHover && node) {
        node.removeEventListener('mouseenter', pause)
        node.removeEventListener('mouseleave', resume)
      }
    }
  }, [cardDistance, config, delay, easing, pauseOnHover, skewAmount, verticalDistance])

  const rendered = childArr.map((child, index) => {
    if (!isValidElement<CardProps>(child)) return child

    const mergedStyle: CSSProperties = {
      width,
      height,
      ...child.props.style,
    }

    return (
      <div
        key={index}
        ref={refs.current[index]}
        className={`${styles.card} ${child.props.customClass ?? ''} ${child.props.className ?? ''}`.trim()}
        style={mergedStyle}
        onClick={(event) => {
          child.props.onClick?.(event)
          onCardClick?.(index)
        }}
      >
        {child.props.children}
      </div>
    )
  })

  return (
    <div ref={containerRef} className={styles.container} style={{ width, height }}>
      {rendered}
    </div>
  )
}
