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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020308]">

      {/* ── Layer 1: deep indigo base wash ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-5%,rgba(79,70,229,0.20),transparent)]" />

      {/* ── Layer 2: top-center cold light — space feel ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_38%_at_50%_12%,rgba(148,163,255,0.09),transparent)]" />

      {/* ── Layer 3: center text halo — lifts title off dark bg ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_44%_36%_at_50%_44%,rgba(200,210,255,0.045),transparent)]" />

      {/* ── Layer 4: bottom violet horizon glow ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-[radial-gradient(ellipse_90%_80%_at_50%_100%,rgba(91,33,182,0.18),transparent)]" />

      {/* ── Layer 5: vignette — dark corners, center focus ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(2,3,8,0.72) 100%)',
        }}
      />

      {/* ── Layer 6: perspective horizon lines ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[38%]"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(to right, rgba(139,92,246,0.18) 0px, rgba(139,92,246,0.18) 1px, transparent 1px, transparent 72px)',
            'repeating-linear-gradient(to bottom, rgba(139,92,246,0.14) 0px, rgba(139,92,246,0.14) 1px, transparent 1px, transparent 48px)',
          ].join(', '),
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
          opacity: 0.55,
        }}
      />

      {/* ── Layer 7: far skyline — distant, very low opacity ── */}
      <div className="pointer-events-none absolute bottom-[11%] left-0 right-0 flex items-end justify-center gap-px opacity-[0.042]">
        {[10, 16, 8, 22, 14, 30, 18, 26, 12, 20, 28, 10, 24, 16, 18, 12, 32, 14, 20, 8].map((h, i) => (
          <div key={i} className="flex-1 bg-violet-200" style={{ height: `${h}px` }} />
        ))}
      </div>

      {/* ── Layer 8: mid skyline — slightly closer ── */}
      <div className="pointer-events-none absolute bottom-[4%] left-0 right-0 flex items-end justify-center gap-px opacity-[0.07]">
        {[18, 28, 14, 38, 22, 52, 30, 44, 20, 34, 26, 48, 16, 36, 24, 42, 28, 20, 32, 16, 44, 22].map((h, i) => (
          <div key={i} className="flex-1 bg-violet-300" style={{ height: `${h}px` }} />
        ))}
      </div>

      {/* ── Layer 9: near skyline foreground ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[2px] opacity-[0.11]">
        {[22, 40, 16, 56, 28, 68, 36, 58, 24, 46, 32, 62, 18, 50, 30, 74, 38, 26, 44, 20].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-violet-400/80 to-violet-300/30"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {/* ── Layer 10: sparse star field ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '220px 220px',
          backgroundPosition: '40px 30px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '140px 140px',
          backgroundPosition: '100px 80px',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-28 pt-16 text-center">

        {/* Eyebrow */}
        <div className="mb-9 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-[5px] text-[9px] uppercase tracking-[0.36em] text-white/28">
          Creator City
        </div>

        {/* Hero title */}
        <h1
          className="font-light leading-[1.08] tracking-[-0.04em] text-white"
          style={{ fontSize: 'clamp(40px, 5.8vw, 76px)' }}
        >
          影视创作<span className="text-gradient">工作台</span>
        </h1>

        {/* Tagline */}
        <p
          className="mt-6 font-light tracking-[0.015em] text-white/32"
          style={{ fontSize: 'clamp(13px, 1.4vw, 16px)' }}
        >
          可交易、可交流、可互惠、去中心化
        </p>

        {/* Embossed CTA */}
        <div className="mt-12">
          {/* Outer inset frame */}
          <div
            className="rounded-full p-[3px]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <Link
              href="/create"
              onClick={handleCanvasEntry}
              className="inline-flex h-[52px] items-center justify-center rounded-full px-10 text-[15px] font-medium text-black transition-transform duration-150 hover:scale-[1.016] active:translate-y-[1px] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #dde0e8 100%)',
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.95)',
                  'inset 0 -1px 0 rgba(0,0,0,0.08)',
                  '0 1px 3px rgba(0,0,0,0.45)',
                  '0 20px 60px rgba(99,102,241,0.32)',
                  '0 6px 20px rgba(0,0,0,0.50)',
                ].join(', '),
              }}
            >
              进入 AI 画布创作
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
