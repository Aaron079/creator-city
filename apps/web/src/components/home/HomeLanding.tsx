'use client'

import Link from 'next/link'
import { useCallback, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

export function HomeLanding() {
  const router = useRouter()

  const handleCanvasEntry = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    // Do not read last-project-id here — it may belong to a previously logged-in
    // user. Entry points always navigate to /create without a projectId; the canvas
    // calls /api/projects/ensure which returns the current user's own project.
    router.push('/create')
  }, [router])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020408]">

      {/* ── Real photo background ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/brand/home-cinema-portal-bg.jpg')" }}
      />

      {/* ── Dark overlay: top → nav area ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(1,2,6,0.55) 0%, rgba(1,2,6,0.10) 28%, transparent 55%)',
        }}
      />

      {/* ── Dark overlay: bottom → ground merge ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(0deg, rgba(2,4,8,0.92) 0%, rgba(2,4,8,0.40) 28%, transparent 58%)',
        }}
      />

      {/* ── Center text lift — title readability ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 42%, rgba(1,2,8,0.38) 0%, transparent 100%)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-28 pt-14 text-center">

        {/* Eyebrow — film title caption */}
        <div
          aria-hidden="true"
          className="mb-9 inline-flex items-center rounded-full border border-white/[0.052] bg-black/20 px-5 py-[5px]"
          style={{ fontSize: '8px', letterSpacing: '0.48em', color: 'rgba(195,215,238,0.34)', textTransform: 'uppercase' }}
        >
          Creator City
        </div>

        {/* Main title */}
        <h1
          style={{
            fontSize: 'clamp(32px, 4.6vw, 60px)',
            fontWeight: 300,
            lineHeight: 1.07,
            letterSpacing: '0.06em',
            background: 'linear-gradient(172deg, rgba(232,240,252,1) 0%, rgba(182,198,225,0.88) 60%, rgba(130,152,192,0.74) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          影视创作工作台
        </h1>

        {/* Tagline */}
        <p
          className="mt-5 font-light"
          style={{
            fontSize: 'clamp(11px, 1.05vw, 13px)',
            letterSpacing: '0.10em',
            color: 'rgba(195,215,238,0.30)',
          }}
        >
          可交易、可交流、可互惠、去中心化
        </p>

        {/* CTA — cinema glass metal */}
        <div className="mt-12">
          <div
            className="inline-flex rounded-full p-[3px]"
            style={{
              background: 'linear-gradient(155deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.010) 100%)',
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,0.07)',
                'inset 0 -10px 22px rgba(0,0,0,0.55)',
                '0 18px 56px rgba(20,45,90,0.18)',
                '0 0 0 1px rgba(255,255,255,0.038)',
              ].join(', '),
            }}
          >
            <Link
              href="/create"
              onClick={handleCanvasEntry}
              className="inline-flex items-center justify-center rounded-full font-medium transition-transform duration-150 hover:scale-[1.010] active:translate-y-[1px] active:scale-[0.99]"
              style={{
                height: '50px',
                paddingLeft: '36px',
                paddingRight: '36px',
                fontSize: '13.5px',
                color: '#080e1a',
                background: 'linear-gradient(180deg, rgba(215,226,244,0.95) 0%, rgba(142,160,192,0.90) 100%)',
                border: '1px solid rgba(255,255,255,0.42)',
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.78)',
                  'inset 0 -9px 16px rgba(0,0,0,0.14)',
                  '0 1px 0 rgba(255,255,255,0.12)',
                  '0 5px 22px rgba(0,0,0,0.58)',
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
