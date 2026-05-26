'use client'

import Link from 'next/link'
import { useCallback, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

export function HomeLanding() {
  const router = useRouter()

  const handleCanvasEntry = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    let href = '/create'
    try {
      const lastId = window.localStorage.getItem('creator-city:last-project-id')
      if (lastId) href = `/create?projectId=${encodeURIComponent(lastId)}`
    } catch {
      // localStorage may be unavailable; /create will ensure the active project.
    }
    router.push(href)
  }, [router])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060a]">

      {/* ── Background layer 1: top indigo ambient ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(99,102,241,0.22),transparent)]" />

      {/* ── Background layer 2: center deep-blue glow ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_50%_48%,rgba(59,130,246,0.07),transparent)]" />

      {/* ── Background layer 3: bottom violet horizon ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-56 bg-[radial-gradient(ellipse_100%_100%_at_50%_100%,rgba(109,40,217,0.13),transparent)]" />

      {/* ── Background layer 4: perspective grid ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[42%] opacity-[0.065]"
        style={{
          backgroundImage: [
            'linear-gradient(to right, rgba(139,92,246,0.7) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(139,92,246,0.7) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, transparent 100%)',
        }}
      />

      {/* ── Background layer 5: city silhouette ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-around opacity-[0.055]">
        {[24, 40, 32, 56, 36, 72, 48, 64, 40, 32, 52, 36, 68, 44, 28, 60, 38, 50, 30, 44].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-violet-300 to-violet-400"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {/* ── Background layer 6: subtle star field ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '200px 200px',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-24 pt-16 text-center">

        {/* Platform eyebrow */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1 text-[10px] uppercase tracking-[0.30em] text-white/30">
          Creator City
        </div>

        {/* Hero title */}
        <h1
          className="font-extralight leading-[1.06] tracking-[-0.05em] text-white"
          style={{ fontSize: 'clamp(48px, 9.5vw, 106px)' }}
        >
          AI 影视创作
          <br />
          <span className="text-gradient">工作台</span>
        </h1>

        {/* Tagline */}
        <p
          className="mt-7 font-light tracking-[0.01em] text-white/38"
          style={{ fontSize: 'clamp(14px, 1.7vw, 19px)' }}
        >
          为下一代影像创作者构建。
        </p>

        {/* Primary CTA */}
        <div className="mt-11">
          <Link
            href="/create"
            onClick={handleCanvasEntry}
            className="inline-flex h-[54px] items-center justify-center rounded-full border border-white/18 bg-white px-10 text-[15px] font-medium text-black transition hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]"
          >
            进入 AI 画布创作
          </Link>
        </div>
      </div>
    </main>
  )
}
