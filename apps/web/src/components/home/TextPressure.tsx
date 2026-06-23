'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import styles from './TextPressure.module.css'

type Point = {
  x: number
  y: number
}

type TextPressureProps = {
  text: string
  fontFamily?: string
  flex?: boolean
  scale?: boolean
  alpha?: boolean
  stroke?: boolean
  width?: boolean
  weight?: boolean
  italic?: boolean
  textColor?: string
  strokeColor?: string
  className?: string
  minFontSize?: number
  uppercase?: boolean
}

function distance(a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function getAttr(dist: number, maxDist: number, minVal: number, maxVal: number) {
  const val = maxVal - Math.abs((maxVal * dist) / Math.max(maxDist, 1))
  return Math.max(minVal, val + minVal)
}

function debounce<T extends (...args: never[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}

export default function TextPressure({
  text,
  fontFamily = 'Roboto Flex',
  width = true,
  weight = true,
  italic = false,
  alpha = false,
  flex = true,
  stroke = false,
  scale = false,
  textColor = '#FFFFFF',
  strokeColor = '#FFFFFF',
  className = '',
  minFontSize = 24,
  uppercase = false,
}: TextPressureProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const spansRef = useRef<Array<HTMLSpanElement | null>>([])
  const mouseRef = useRef<Point>({ x: 0, y: 0 })
  const cursorRef = useRef<Point>({ x: 0, y: 0 })

  const [fontSize, setFontSize] = useState(minFontSize)
  const [scaleY, setScaleY] = useState(1)
  const [lineHeight, setLineHeight] = useState(1)

  const chars = text.split('')

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      cursorRef.current.x = event.clientX
      cursorRef.current.y = event.clientY
    }
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      cursorRef.current.x = touch.clientX
      cursorRef.current.y = touch.clientY
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    if (containerRef.current) {
      const { left, top, width: containerW, height } = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = left + containerW / 2
      mouseRef.current.y = top + height / 2
      cursorRef.current.x = mouseRef.current.x
      cursorRef.current.y = mouseRef.current.y
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  const setSize = useCallback(() => {
    if (!containerRef.current || !titleRef.current) return

    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect()
    const nextFontSize = Math.max(containerW / (chars.length / 2.05), minFontSize)

    setFontSize(nextFontSize)
    setScaleY(1)
    setLineHeight(1)

    requestAnimationFrame(() => {
      if (!titleRef.current) return
      const textRect = titleRef.current.getBoundingClientRect()
      if (scale && textRect.height > 0) {
        const yRatio = containerH / textRect.height
        setScaleY(yRatio)
        setLineHeight(yRatio)
      }
    })
  }, [chars.length, minFontSize, scale])

  useEffect(() => {
    const debouncedSetSize = debounce(setSize, 100)
    debouncedSetSize()
    window.addEventListener('resize', debouncedSetSize)
    return () => window.removeEventListener('resize', debouncedSetSize)
  }, [setSize])

  useEffect(() => {
    let rafId = 0
    const animate = () => {
      mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15
      mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15

      if (titleRef.current) {
        const titleRect = titleRef.current.getBoundingClientRect()
        const maxDist = titleRect.width / 2

        spansRef.current.forEach((span) => {
          if (!span) return

          const rect = span.getBoundingClientRect()
          const charCenter = {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          }
          const d = distance(mouseRef.current, charCenter)
          const wdth = width ? Math.floor(getAttr(d, maxDist, 28, 168)) : 100
          const wght = weight ? Math.floor(getAttr(d, maxDist, 180, 820)) : 620
          const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2) : '0'
          const alphaVal = alpha ? getAttr(d, maxDist, 0, 1).toFixed(2) : '1'
          const nextSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`

          if (span.style.fontVariationSettings !== nextSettings) {
            span.style.fontVariationSettings = nextSettings
          }
          if (alpha && span.style.opacity !== alphaVal) {
            span.style.opacity = alphaVal
          }
        })
      }

      rafId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(rafId)
  }, [alpha, italic, weight, width])

  const titleStyle: CSSProperties = {
    color: textColor,
    fontFamily,
    fontSize,
    fontWeight: 620,
    lineHeight,
    margin: 0,
    textAlign: 'center',
    textTransform: uppercase ? 'uppercase' : 'none',
    transform: `scale(1, ${scaleY})`,
    transformOrigin: 'center top',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    width: '100%',
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-transparent">
      <h1
        ref={titleRef}
        className={[styles.title, className].filter(Boolean).join(' ')}
        style={titleStyle}
      >
        <span className={flex ? 'flex justify-between' : undefined}>
          {chars.map((char, index) => (
            <span
              key={`${char}-${index}`}
              ref={(element) => {
                spansRef.current[index] = element
              }}
              data-char={char}
              className={stroke ? 'relative' : undefined}
              style={{
                color: stroke ? textColor : textColor,
                display: 'inline-block',
                textShadow: '0 18px 70px rgba(255,255,255,0.12)',
                WebkitTextStroke: stroke ? `2px ${strokeColor}` : undefined,
              }}
            >
              {char === ' ' ? '\u00a0' : char}
            </span>
          ))}
        </span>
      </h1>
    </div>
  )
}
