'use client'

import { useEffect, useRef } from 'react'

type SplashCursorProps = {
  densityDissipation?: number
  splatRadius?: number
  splatForce?: number
  colorUpdateSpeed?: number
  colors?: string[]
}

type SplashParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  decay: number
  color: string
}

const DEFAULT_COLORS = ['#ff2ea6', '#c770ff', '#6c75ff', '#ff87d7']

function getPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2)
}

function pickColor(colors: string[], index: number) {
  return colors[index % colors.length] ?? DEFAULT_COLORS[0] ?? '#ff2ea6'
}

export function SplashCursor({
  densityDissipation = 0.022,
  splatRadius = 24,
  splatForce = 0.18,
  colorUpdateSpeed = 5,
  colors = DEFAULT_COLORS,
}: SplashCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<SplashParticle[]>([])
  const pointerRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0, hasMoved: false, colorIndex: 0 })
  const frameRef = useRef(0)
  const colorTickRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    const resize = () => {
      const ratio = getPixelRatio()
      canvas.width = Math.floor(window.innerWidth * ratio)
      canvas.height = Math.floor(window.innerHeight * ratio)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const addSplash = (x: number, y: number, dx: number, dy: number) => {
      const speed = Math.min(Math.hypot(dx, dy), 48)
      if (speed < 0.6) return

      colorTickRef.current += speed * 0.01
      if (colorTickRef.current > colorUpdateSpeed) {
        pointerRef.current.colorIndex += 1
        colorTickRef.current = 0
      }

      const color = pickColor(colors, pointerRef.current.colorIndex)
      const count = Math.min(8, Math.max(3, Math.round(speed / 7)))

      for (let index = 0; index < count; index += 1) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.8
        const force = (0.4 + Math.random() * 0.9) * splatForce * speed
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * force + (Math.random() - 0.5) * 0.55,
          vy: Math.sin(angle) * force + (Math.random() - 0.5) * 0.55,
          radius: splatRadius * (0.45 + Math.random() * 0.95),
          life: 1,
          decay: densityDissipation * (0.75 + Math.random() * 0.9),
          color,
        })
      }

      if (particlesRef.current.length > 260) {
        particlesRef.current.splice(0, particlesRef.current.length - 260)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const pointer = pointerRef.current
      pointer.prevX = pointer.hasMoved ? pointer.x : event.clientX
      pointer.prevY = pointer.hasMoved ? pointer.y : event.clientY
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.hasMoved = true
      addSplash(pointer.x, pointer.y, pointer.x - pointer.prevX, pointer.y - pointer.prevY)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      pointerRef.current.colorIndex += 1
      addSplash(event.clientX, event.clientY, 18, -14)
      addSplash(event.clientX, event.clientY, -18, 14)
    }

    const render = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      context.save()
      context.globalCompositeOperation = 'lighter'
      context.filter = 'blur(14px)'

      const particles = particlesRef.current
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        if (!particle) continue

        particle.x += particle.vx
        particle.y += particle.vy
        particle.vx *= 0.94
        particle.vy *= 0.94
        particle.radius *= 1.006
        particle.life -= particle.decay

        if (particle.life <= 0.01) {
          particles.splice(index, 1)
          continue
        }

        const gradient = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius
        )
        gradient.addColorStop(0, `${particle.color}d8`)
        gradient.addColorStop(0.42, `${particle.color}58`)
        gradient.addColorStop(1, `${particle.color}00`)
        context.globalAlpha = Math.max(0, particle.life) * 0.72
        context.fillStyle = gradient
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fill()
      }

      context.restore()
      frameRef.current = window.requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    frameRef.current = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      particlesRef.current = []
    }
  }, [colorUpdateSpeed, colors, densityDissipation, splatForce, splatRadius])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45] overflow-hidden mix-blend-screen"
      aria-hidden="true"
      data-non-canvas-splash-cursor="true"
    >
      <canvas ref={canvasRef} className="block h-screen w-screen" />
    </div>
  )
}
