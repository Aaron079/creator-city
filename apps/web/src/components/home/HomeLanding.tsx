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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#010206]">

      {/* ── L1: deep indigo space wash ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_-6%,rgba(79,70,229,0.15),transparent)]" />

      {/* ── L2: central portal gate — tall vertical ellipse, the "door into the city" ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 42% 64% at 50% 42%, rgba(99,102,241,0.12) 0%, rgba(56,189,248,0.04) 55%, transparent 100%)',
        }}
      />

      {/* ── L3: top cold focus spot ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_26%_22%_at_50%_9%,rgba(148,163,255,0.065),transparent)]" />

      {/* ── L4: bottom violet horizon glow ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-52 bg-[radial-gradient(ellipse_82%_70%_at_50%_100%,rgba(67,20,148,0.16),transparent)]" />

      {/* ── L5: heavy vignette — cinematic black frame ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, rgba(1,2,6,0.90) 100%)',
        }}
      />

      {/* ── L6: perspective grid — very faint ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[30%]"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(to right, rgba(139,92,246,0.12) 0px, rgba(139,92,246,0.12) 1px, transparent 1px, transparent 88px)',
            'repeating-linear-gradient(to bottom, rgba(139,92,246,0.08) 0px, rgba(139,92,246,0.08) 1px, transparent 1px, transparent 56px)',
          ].join(', '),
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
          opacity: 0.38,
        }}
      />

      {/* ── L7: film scan line 1 ── */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: '30%',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(148,163,255,0.08) 28%, rgba(148,163,255,0.08) 72%, transparent)',
        }}
      />

      {/* ── L8: film scan line 2 ── */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: '62%',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(99,102,241,0.055) 22%, rgba(99,102,241,0.055) 78%, transparent)',
        }}
      />

      {/* ── L9: far skyline — SVG silhouette, not blocks ── */}
      <svg
        className="pointer-events-none absolute bottom-[12%] left-0 right-0 w-full"
        height="52"
        viewBox="0 0 1440 52"
        preserveAspectRatio="none"
        style={{ opacity: 0.028 }}
        aria-hidden="true"
      >
        <path
          d="M0,52 L0,38 L28,38 L28,30 L46,30 L46,36 L66,36 L66,24 L84,24 L84,34 L102,34 L102,28 L122,28 L122,38 L140,38 L140,20 L158,20 L158,32 L176,32 L176,26 L196,26 L196,40 L214,40 L214,30 L232,30 L232,36 L252,36 L252,18 L270,18 L270,30 L288,30 L288,38 L308,38 L308,24 L326,24 L326,34 L344,34 L344,28 L364,28 L364,42 L382,42 L382,22 L400,22 L400,36 L420,36 L420,28 L438,28 L438,40 L456,40 L456,32 L474,32 L474,18 L494,18 L494,34 L512,34 L512,26 L530,26 L530,40 L550,40 L550,22 L568,22 L568,36 L586,36 L586,28 L606,28 L606,42 L624,42 L624,30 L642,30 L642,20 L662,20 L662,36 L680,36 L680,28 L698,28 L698,44 L716,44 L716,26 L736,26 L736,38 L754,38 L754,18 L772,18 L772,32 L790,32 L790,26 L810,26 L810,40 L828,40 L828,22 L846,22 L846,36 L866,36 L866,30 L884,30 L884,44 L902,44 L902,24 L920,24 L920,36 L940,36 L940,28 L958,28 L958,40 L976,40 L976,22 L994,22 L994,34 L1014,34 L1014,18 L1032,18 L1032,36 L1050,36 L1050,28 L1068,28 L1068,42 L1088,42 L1088,24 L1106,24 L1106,36 L1124,36 L1124,20 L1144,20 L1144,38 L1162,38 L1162,30 L1180,30 L1180,44 L1198,44 L1198,26 L1218,26 L1218,38 L1236,38 L1236,18 L1254,18 L1254,34 L1272,34 L1272,26 L1292,26 L1292,40 L1310,40 L1310,28 L1328,28 L1328,38 L1348,38 L1348,22 L1366,22 L1366,36 L1384,36 L1384,30 L1412,30 L1412,40 L1440,40 L1440,52 Z"
          fill="rgba(196,181,253,1)"
        />
      </svg>

      {/* ── L10: mid skyline silhouette ── */}
      <svg
        className="pointer-events-none absolute bottom-[4%] left-0 right-0 w-full"
        height="82"
        viewBox="0 0 1440 82"
        preserveAspectRatio="none"
        style={{ opacity: 0.048 }}
        aria-hidden="true"
      >
        <path
          d="M0,82 L0,60 L22,60 L22,46 L40,46 L40,56 L58,56 L58,36 L76,36 L76,50 L96,50 L96,40 L114,40 L114,58 L132,58 L132,28 L152,28 L152,44 L170,44 L170,36 L188,36 L188,56 L208,56 L208,42 L226,42 L226,54 L244,54 L244,30 L264,30 L264,48 L282,48 L282,62 L300,62 L300,40 L320,40 L320,52 L338,52 L338,38 L356,38 L356,60 L376,60 L376,34 L394,34 L394,50 L412,50 L412,40 L432,40 L432,58 L450,58 L450,44 L468,44 L468,30 L488,30 L488,50 L506,50 L506,40 L524,40 L524,58 L544,58 L544,36 L562,36 L562,52 L580,52 L580,34 L600,34 L600,52 L618,52 L618,42 L636,42 L636,28 L656,28 L656,46 L674,46 L674,58 L692,58 L692,38 L712,38 L712,52 L730,52 L730,28 L748,28 L748,46 L768,46 L768,38 L786,38 L786,58 L804,58 L804,36 L824,36 L824,52 L842,52 L842,44 L860,44 L860,62 L880,62 L880,34 L898,34 L898,50 L916,50 L916,40 L936,40 L936,58 L954,58 L954,44 L972,44 L972,30 L992,30 L992,50 L1010,50 L1010,40 L1028,40 L1028,56 L1048,56 L1048,36 L1066,36 L1066,52 L1084,52 L1084,42 L1104,42 L1104,60 L1122,60 L1122,36 L1140,36 L1140,52 L1160,52 L1160,28 L1178,28 L1178,46 L1196,46 L1196,58 L1216,58 L1216,40 L1234,40 L1234,52 L1252,52 L1252,36 L1272,36 L1272,50 L1290,50 L1290,38 L1308,38 L1308,58 L1328,58 L1328,42 L1346,42 L1346,56 L1366,56 L1366,34 L1384,34 L1384,52 L1404,52 L1404,44 L1440,44 L1440,82 Z"
          fill="rgba(196,181,253,1)"
        />
      </svg>

      {/* ── L11: near skyline — tallest, most visible ── */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 right-0 w-full"
        height="108"
        viewBox="0 0 1440 108"
        preserveAspectRatio="none"
        style={{ opacity: 0.065 }}
        aria-hidden="true"
      >
        <path
          d="M0,108 L0,78 L18,78 L18,58 L36,58 L36,70 L54,70 L54,44 L72,44 L72,60 L92,60 L92,46 L110,46 L110,68 L128,68 L128,32 L148,32 L148,54 L166,54 L166,42 L184,42 L184,68 L204,68 L204,50 L222,50 L222,64 L240,64 L240,34 L260,34 L260,56 L278,56 L278,72 L296,72 L296,46 L316,46 L316,62 L334,62 L334,44 L352,44 L352,72 L372,72 L372,40 L390,40 L390,60 L408,60 L408,46 L428,46 L428,68 L446,68 L446,52 L464,52 L464,34 L484,34 L484,60 L502,60 L502,46 L520,46 L520,68 L540,68 L540,42 L558,42 L558,62 L576,62 L576,40 L596,40 L596,60 L614,60 L614,48 L632,48 L632,32 L652,32 L652,54 L670,54 L670,68 L688,68 L688,44 L708,44 L708,62 L726,62 L726,32 L744,32 L744,54 L764,54 L764,44 L782,44 L782,68 L800,68 L800,42 L820,42 L820,62 L838,62 L838,50 L856,50 L856,74 L876,74 L876,40 L894,40 L894,58 L912,58 L912,46 L932,46 L932,68 L950,68 L950,52 L968,52 L968,34 L988,34 L988,58 L1006,58 L1006,46 L1024,46 L1024,66 L1044,66 L1044,42 L1062,42 L1062,60 L1080,60 L1080,48 L1100,48 L1100,72 L1118,72 L1118,42 L1136,42 L1136,60 L1156,60 L1156,32 L1174,32 L1174,54 L1192,54 L1192,68 L1212,68 L1212,46 L1230,46 L1230,62 L1248,62 L1248,42 L1268,42 L1268,60 L1286,60 L1286,44 L1304,44 L1304,70 L1324,70 L1324,50 L1342,50 L1342,66 L1362,66 L1362,40 L1380,40 L1380,60 L1402,60 L1402,50 L1440,50 L1440,108 Z"
          fill="rgba(196,181,253,1)"
        />
      </svg>

      {/* ── L12: very sparse star field ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.032]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.85) 1px, transparent 1px)',
          backgroundSize: '290px 290px',
          backgroundPosition: '70px 50px',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-24 pt-14 text-center">

        {/* Eyebrow */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.016] px-4 py-[5px] text-[9px] uppercase tracking-[0.40em] text-white/22">
          Creator City
        </div>

        {/* Hero title — silver-cool gradient */}
        <h1
          className="font-light leading-[1.06] tracking-[-0.03em]"
          style={{
            fontSize: 'clamp(36px, 5vw, 66px)',
            background: 'linear-gradient(168deg, rgba(240,242,255,1) 0%, rgba(196,204,240,0.90) 55%, rgba(148,163,210,0.78) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          影视创作工作台
        </h1>

        {/* Tagline */}
        <p
          className="mt-5 font-light tracking-[0.02em] text-white/22"
          style={{ fontSize: 'clamp(12px, 1.25vw, 14px)' }}
        >
          可交易、可交流、可互惠、去中心化
        </p>

        {/* CTA — portal shell + inset button */}
        <div className="mt-11">
          <div
            className="inline-flex rounded-full p-[4px]"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.018) 100%)',
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,0.10)',
                'inset 0 -12px 24px rgba(0,0,0,0.48)',
                '0 24px 80px rgba(79,70,229,0.20)',
                '0 0 0 1px rgba(255,255,255,0.05)',
              ].join(', '),
            }}
          >
            <Link
              href="/create"
              onClick={handleCanvasEntry}
              className="inline-flex h-[52px] items-center justify-center rounded-full px-[38px] text-[14px] font-medium text-[#0f0f14] transition-transform duration-150 hover:scale-[1.012] active:translate-y-[1px] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(180deg, #f0f2ff 0%, #d4d8ed 100%)',
                border: '1px solid rgba(255,255,255,0.62)',
                boxShadow: [
                  'inset 0 1px 0 rgba(255,255,255,0.90)',
                  'inset 0 -10px 18px rgba(0,0,0,0.12)',
                  '0 1px 0 rgba(255,255,255,0.16)',
                  '0 4px 16px rgba(0,0,0,0.50)',
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
