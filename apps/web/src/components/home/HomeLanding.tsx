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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">

      {/* ── L1: cinematic deep-blue sky ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(circle at 50% 0%, rgba(72,97,132,0.20), transparent 36%)',
            'linear-gradient(180deg, #0c1825 0%, #061018 44%, #020408 100%)',
          ].join(', '),
        }}
      />

      {/* ── L2: left atmospheric fog ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '-8%', left: '-14%',
          width: '58%', height: '48%',
          background: 'radial-gradient(ellipse at center, rgba(130,155,185,0.07) 0%, transparent 70%)',
          filter: 'blur(45px)',
        }}
      />

      {/* ── L3: right atmospheric fog ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '-10%', right: '-14%',
          width: '52%', height: '44%',
          background: 'radial-gradient(ellipse at center, rgba(59,100,160,0.06) 0%, transparent 70%)',
          filter: 'blur(65px)',
        }}
      />

      {/* ── L4: center distant sky light — behind title ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '2%', left: '50%',
          transform: 'translateX(-50%)',
          width: '38%', height: '32%',
          background: 'radial-gradient(ellipse at center, rgba(90,130,185,0.09) 0%, transparent 70%)',
          filter: 'blur(32px)',
        }}
      />

      {/* ── L5: cinematic vignette — heavy black frame ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 72% 72% at 50% 50%, transparent 16%, rgba(2,4,8,0.94) 100%)',
        }}
      />

      {/* ── L6: far horizon fog band ── */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          bottom: '22%', height: '70px',
          background: 'linear-gradient(to top, rgba(35,55,85,0.14) 0%, rgba(50,80,120,0.06) 45%, transparent 100%)',
          filter: 'blur(10px)',
        }}
      />

      {/* ── L7: mid horizon fog — closer ── */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          bottom: '16%', height: '50px',
          background: 'linear-gradient(to top, rgba(20,38,62,0.18) 0%, transparent 100%)',
          filter: 'blur(6px)',
        }}
      />

      {/* ── L8: tower base — wide lower body ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2"
        style={{
          transform: 'translateX(-50%)',
          width: '96px', height: '32vh',
          background: 'linear-gradient(to top, rgba(155,178,208,0.11) 0%, rgba(175,198,225,0.08) 55%, rgba(195,215,238,0.04) 85%, transparent 100%)',
          filter: 'blur(0.8px)',
        }}
      />

      {/* ── L9: tower upper section — narrower ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2"
        style={{
          transform: 'translateX(-50%)',
          width: '44px', height: '28vh',
          background: 'linear-gradient(to top, rgba(185,205,230,0.10) 0%, rgba(205,222,245,0.07) 65%, transparent 100%)',
          filter: 'blur(0.5px)',
        }}
      />

      {/* ── L10: tower spire ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2"
        style={{
          transform: 'translateX(-50%)',
          width: '2px', height: '40vh',
          background: 'linear-gradient(to top, rgba(195,215,240,0.14) 0%, rgba(215,232,252,0.10) 58%, rgba(230,242,255,0.05) 80%, transparent 100%)',
        }}
      />

      {/* ── L11: spire tip glow ── */}
      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          bottom: 'calc(40vh - 12px)',
          transform: 'translateX(-50%)',
          width: '20px', height: '20px',
          background: 'radial-gradient(circle, rgba(195,220,255,0.22) 0%, transparent 70%)',
          filter: 'blur(4px)',
        }}
      />

      {/* ── L12: ground depth shadow ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: '20%',
          background: 'linear-gradient(to top, rgba(2,6,14,0.60) 0%, rgba(4,10,22,0.22) 55%, transparent 100%)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-28 pt-14 text-center">

        {/* Eyebrow — film title style */}
        <div
          className="mb-9 inline-flex items-center rounded-full border border-white/[0.055] bg-white/[0.014] px-5 py-[5px]"
          style={{ fontSize: '8px', letterSpacing: '0.46em', color: 'rgba(200,215,235,0.36)', textTransform: 'uppercase' }}
        >
          Creator City
        </div>

        {/* Hero title — silver cold gradient, cinema weight */}
        <h1
          style={{
            fontSize: 'clamp(34px, 4.8vw, 62px)',
            fontWeight: 300,
            lineHeight: 1.07,
            letterSpacing: '0.06em',
            background: 'linear-gradient(172deg, rgba(236,242,252,1) 0%, rgba(188,202,228,0.88) 58%, rgba(138,158,196,0.75) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          影视创作工作台
        </h1>

        {/* Tagline */}
        <p
          className="mt-5 font-light text-white/20"
          style={{ fontSize: 'clamp(11px, 1.1vw, 13px)', letterSpacing: '0.10em' }}
        >
          可交易、可交流、可互惠、去中心化
        </p>

        {/* CTA — cinema glass metal shell */}
        <div className="mt-12">
          <div
            className="inline-flex rounded-full p-[3px]"
            style={{
              background: 'linear-gradient(155deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.012) 100%)',
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,0.08)',
                'inset 0 -10px 22px rgba(0,0,0,0.52)',
                '0 20px 64px rgba(25,55,100,0.16)',
                '0 0 0 1px rgba(255,255,255,0.042)',
              ].join(', '),
            }}
          >
            <Link
              href="/create"
              onClick={handleCanvasEntry}
              className="inline-flex items-center justify-center rounded-full text-[13.5px] font-medium transition-transform duration-150 hover:scale-[1.010] active:translate-y-[1px] active:scale-[0.99]"
              style={{
                height: '50px',
                paddingLeft: '36px',
                paddingRight: '36px',
                color: '#0a0f1c',
                background: 'linear-gradient(180deg, rgba(218,228,244,0.94) 0%, rgba(148,165,196,0.88) 100%)',
                border: '1px solid rgba(255,255,255,0.44)',
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.80)',
                  'inset 0 -9px 16px rgba(0,0,0,0.14)',
                  '0 1px 0 rgba(255,255,255,0.14)',
                  '0 5px 20px rgba(0,0,0,0.55)',
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
