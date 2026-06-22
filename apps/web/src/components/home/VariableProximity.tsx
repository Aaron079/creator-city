'use client'

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type RefObject,
} from 'react'
import styles from './VariableProximity.module.css'

type Falloff = 'linear' | 'exponential' | 'gaussian'

type VariableProximityProps = {
  label: string
  className?: string
  fromFontVariationSettings: string
  toFontVariationSettings: string
  containerRef?: RefObject<HTMLElement>
  radius?: number
  falloff?: Falloff
  style?: CSSProperties
}

function useAnimationFrame(callback: () => void) {
  useEffect(() => {
    let frameId = 0
    const loop = () => {
      callback()
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [callback])
}

function useMousePositionRef(containerRef?: RefObject<HTMLElement>) {
  const positionRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect()
        positionRef.current = { x: x - rect.left, y: y - rect.top }
      } else {
        positionRef.current = { x, y }
      }
    }

    const handleMouseMove = (event: MouseEvent) => updatePosition(event.clientX, event.clientY)
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch) updatePosition(touch.clientX, touch.clientY)
    }
    const handlePointerLeave = () => {
      positionRef.current = { x: -9999, y: -9999 }
    }

    const container = containerRef?.current
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)
    container?.addEventListener('mouseleave', handlePointerLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      container?.removeEventListener('mouseleave', handlePointerLeave)
    }
  }, [containerRef])

  return positionRef
}

function parseFontVariationSettings(settings: string) {
  return new Map(
    settings
      .split(',')
      .map((setting) => setting.trim())
      .filter(Boolean)
      .flatMap((setting) => {
        const [name, value] = setting.split(/\s+/)
        if (!name || !value) return []
        return [[name.replace(/['"]/g, ''), Number.parseFloat(value)]]
      }),
  )
}

const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>(
  (
    {
      label,
      className = '',
      fromFontVariationSettings,
      toFontVariationSettings,
      containerRef,
      radius = 90,
      falloff = 'linear',
      style,
    },
    ref,
  ) => {
    const letterRefs = useRef<Array<HTMLSpanElement | null>>([])
    const mousePositionRef = useMousePositionRef(containerRef)
    const lastPositionRef = useRef({ x: Number.NaN, y: Number.NaN })

    const parsedSettings = useMemo(() => {
      const fromSettings = parseFontVariationSettings(fromFontVariationSettings)
      const toSettings = parseFontVariationSettings(toFontVariationSettings)
      return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
        axis,
        fromValue,
        toValue: toSettings.get(axis) ?? fromValue,
      }))
    }, [fromFontVariationSettings, toFontVariationSettings])

    useAnimationFrame(() => {
      const container = containerRef?.current
      if (!container) return

      const { x, y } = mousePositionRef.current
      if (lastPositionRef.current.x === x && lastPositionRef.current.y === y) return
      lastPositionRef.current = { x, y }

      const containerRect = container.getBoundingClientRect()
      letterRefs.current.forEach((letterRef) => {
        if (!letterRef) return

        const rect = letterRef.getBoundingClientRect()
        const letterCenterX = rect.left + rect.width / 2 - containerRect.left
        const letterCenterY = rect.top + rect.height / 2 - containerRect.top
        const distance = Math.hypot(x - letterCenterX, y - letterCenterY)

        if (distance >= radius) {
          letterRef.style.fontVariationSettings = fromFontVariationSettings
          letterRef.style.transform = 'translateY(0)'
          return
        }

        const normalized = Math.min(Math.max(1 - distance / radius, 0), 1)
        const falloffValue =
          falloff === 'exponential'
            ? normalized ** 2
            : falloff === 'gaussian'
              ? Math.exp(-((distance / (radius / 2)) ** 2) / 2)
              : normalized

        const newSettings = parsedSettings
          .map(({ axis, fromValue, toValue }) => {
            const value = fromValue + (toValue - fromValue) * falloffValue
            return `'${axis}' ${value}`
          })
          .join(', ')

        letterRef.style.fontVariationSettings = newSettings
        letterRef.style.transform = `translateY(${-3 * falloffValue}px)`
      })
    })

    const words = label.split(' ')
    let letterIndex = 0

    return (
      <span
        ref={ref}
        className={`${styles.variableProximity} ${className}`}
        style={style}
      >
        {words.map((word, wordIndex) => (
          <span key={`${word}-${wordIndex}`} className={styles.word}>
            {word.split('').map((letter) => {
              const currentLetterIndex = letterIndex++
              return (
                <span
                  key={`${letter}-${currentLetterIndex}`}
                  ref={(element) => {
                    letterRefs.current[currentLetterIndex] = element
                  }}
                  className={styles.letter}
                  style={{ fontVariationSettings: fromFontVariationSettings }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              )
            })}
            {wordIndex < words.length - 1 ? (
              <span aria-hidden="true" className={styles.word}>
                &nbsp;
              </span>
            ) : null}
          </span>
        ))}
        <span className={styles.screenReaderOnly}>{label}</span>
      </span>
    )
  },
)

VariableProximity.displayName = 'VariableProximity'

export default VariableProximity
