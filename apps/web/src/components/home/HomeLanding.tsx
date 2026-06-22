'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  Boxes,
  Crown,
  FileText,
  Grid2X2,
  Link2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

export function HomeLanding() {
  const router = useRouter()
  const mainRef = useRef<HTMLElement | null>(null)

  const handleCanvasEntry = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    // Do not read last-project-id here — it may belong to a previously logged-in
    // user. Entry points always navigate to /create without a projectId; the canvas
    // calls /api/projects/ensure which returns the current user's own project.
    router.push('/create')
  }, [router])

  useEffect(() => {
    const root = mainRef.current
    if (!root) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const setMirrorState = (progress: number) => {
      root.style.setProperty('--mirror-progress', progress.toFixed(3))
      root.style.setProperty('--mirror-lift', `${Math.round(progress * -30)}px`)
      root.style.setProperty('--mirror-scale', `${(1 - progress * 0.025).toFixed(3)}`)
      root.style.setProperty('--mirror-cover-tilt', `${(progress * 2.8).toFixed(2)}deg`)
      root.style.setProperty('--mirror-base-y', `${Math.round(progress * -34)}px`)
      root.style.setProperty('--mirror-base-tilt', `${(62 - progress * 18).toFixed(2)}deg`)
      root.style.setProperty('--mirror-reflect', `${(0.26 + progress * 0.46).toFixed(3)}`)
      root.style.setProperty('--trust-rise', `${Math.round((1 - progress) * 46)}px`)
      root.style.setProperty('--trust-opacity', `${(0.74 + progress * 0.26).toFixed(3)}`)
      root.style.setProperty('--beam-slide', `${Math.round(progress * 44)}px`)
      root.style.setProperty('--beam-opacity', `${(0.68 + progress * 0.22).toFixed(3)}`)
    }

    const updateMirrorState = () => {
      frame = 0
      if (reducedMotion.matches) {
        setMirrorState(1)
        return
      }

      const start = Math.max(120, window.innerHeight * 0.16)
      const end = Math.max(start + 420, window.innerHeight * 0.82)
      const progress = Math.min(Math.max((window.scrollY - start) / (end - start), 0), 1)
      setMirrorState(progress)
    }

    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateMirrorState)
    }

    requestUpdate()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    reducedMotion.addEventListener('change', requestUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      reducedMotion.removeEventListener('change', requestUpdate)
    }
  }, [])

  return (
    <main ref={mainRef} className="overflow-hidden bg-[#f6f8fb] text-slate-950">
      <section className="relative min-h-[850px] px-5 pb-14 pt-24 sm:px-6 lg:min-h-[1030px] lg:pt-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.96), transparent 34rem), radial-gradient(circle at 18% 36%, rgba(91,141,255,0.20), transparent 28rem), radial-gradient(circle at 82% 44%, rgba(180,220,255,0.24), transparent 30rem), linear-gradient(180deg,#fbfcff 0%,#eef4ff 60%,#f7faff 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[var(--beam-opacity,0.68)]"
          style={{
            background:
              'linear-gradient(124deg, transparent 0 32%, rgba(117,165,255,0.26) 34%, transparent 39%), linear-gradient(32deg, transparent 0 45%, rgba(255,236,196,0.32) 47%, transparent 52%), linear-gradient(154deg, transparent 0 53%, rgba(111,222,255,0.18) 55%, transparent 60%)',
            transform: 'translateY(var(--beam-slide, 0px))',
          }}
        />

        <div className="relative mx-auto max-w-6xl text-center lg:min-h-[900px]">
          <h1 className="text-[clamp(52px,8vw,104px)] font-semibold leading-none text-[#061126]">
            Creator City
          </h1>
          <p className="mt-5 text-lg font-medium text-slate-500 sm:text-xl">
            AI 创作者的会员制工作台
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
            <Link
              href="/create"
              onClick={handleCanvasEntry}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-[#0a1730] bg-[#071225] px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-[#0b1831]"
            >
              <Sparkles className="h-4 w-4" />
              进入 AI Canvas
            </Link>
            <Link
              href="/assets"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-7 text-sm font-semibold text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
            >
              <Grid2X2 className="h-4 w-4" />
              查看资产库
            </Link>
            <Link
              href="/account/providers"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-7 text-sm font-semibold text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
            >
              <Link2 className="h-4 w-4" />
              连接 BYOK
            </Link>
          </div>

          <div
            className="relative z-10 mx-auto mt-14 max-w-5xl pb-8 will-change-transform lg:sticky lg:top-20"
            style={{
              transform: 'translateY(var(--mirror-lift, 0px)) scale(var(--mirror-scale, 1))',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 left-[8%] right-[8%] h-36 rounded-b-[38px] border-x border-b border-blue-200/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(204,224,255,0.10))] opacity-[var(--mirror-reflect,0.26)] shadow-[0_34px_90px_rgba(59,130,246,0.16)] backdrop-blur-xl [mask-image:linear-gradient(180deg,rgba(0,0,0,0.78),transparent)]"
              style={{
                transform:
                  'perspective(900px) rotateX(var(--mirror-base-tilt, 62deg)) translateY(var(--mirror-base-y, 0px)) scaleY(0.76)',
                transformOrigin: '50% 0%',
              }}
            />
            <div
              className="relative mx-auto min-h-[410px] rounded-[28px] border border-white/80 bg-white/35 px-5 py-8 shadow-[0_32px_90px_rgba(30,64,175,0.18)] backdrop-blur-2xl will-change-transform sm:min-h-[480px] sm:rounded-[42px] sm:px-10 sm:py-10"
              style={{
                transform: 'perspective(1200px) rotateX(var(--mirror-cover-tilt, 0deg))',
                transformOrigin: '50% 100%',
              }}
            >
              <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/70 to-transparent" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 bottom-2 h-24 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(107,180,255,0.26),transparent_65%)] opacity-[var(--mirror-progress,0)] blur-2xl"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sparkles className="h-4 w-4 text-slate-500" />
                  AI Canvas
                </div>
                <div className="hidden items-center gap-2 text-[10px] font-semibold text-slate-400 sm:flex">
                  <span>Shot</span>
                  <span className="h-px w-5 bg-blue-200" />
                  <span>Scene</span>
                  <span className="h-px w-5 bg-blue-200" />
                  <span>Sequence</span>
                </div>
              </div>

              <div className="relative mx-auto mt-12 grid max-w-3xl grid-cols-3 items-center gap-4 sm:gap-10">
                <CanvasMiniCard title="Image" caption="1024 x 1024" />
                <CanvasMiniCard title="AI Generate" caption="Completed" active />
                <CanvasMiniCard title="Video" caption="00:08" video />
                <div className="absolute left-[20%] right-[20%] top-1/2 -z-10 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
              </div>

              <div className="mt-20 flex flex-wrap items-center justify-center gap-3">
                <TrustPill icon={<Crown className="h-4 w-4" />} label="Membership-first" />
                <TrustPill icon={<LockKeyhole className="h-4 w-4" />} label="BYOK-first" />
                <TrustPill icon={<ShieldCheck className="h-4 w-4" />} label="No platform payment" />
              </div>
            </div>
            <div
              className="mx-auto h-24 max-w-[94%] rounded-b-[34px] border-x border-b border-blue-200/70 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_28px_70px_rgba(37,99,235,0.16)] backdrop-blur-xl"
              style={{
                transform:
                  'perspective(900px) rotateX(var(--mirror-base-tilt, 62deg)) translateY(var(--mirror-base-y, 0px))',
                transformOrigin: '50% 0%',
              }}
            />
          </div>

          <a
            href="#trust-infra"
            aria-label="Scroll to trusted creative infrastructure"
            className="absolute bottom-0 right-2 hidden h-16 w-16 items-center justify-center rounded-full bg-[#101828] text-white shadow-[0_18px_50px_rgba(15,23,42,0.24)] transition hover:-translate-y-1 lg:flex"
          >
            <ArrowDown className="h-8 w-8" />
          </a>
        </div>
      </section>

      <section id="trust-infra" className="relative -mt-12 min-h-screen px-5 pb-24 pt-20 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 10%, rgba(255,255,255,0.90), transparent 24rem), radial-gradient(circle at 76% 54%, rgba(125,181,255,0.20), transparent 24rem), linear-gradient(180deg,#eef4ff 0%,#f8fbff 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'linear-gradient(148deg, transparent 0 36%, rgba(104,165,255,0.20) 39%, transparent 45%), linear-gradient(28deg, transparent 0 54%, rgba(255,237,203,0.34) 57%, transparent 62%)',
          }}
        />

        <div
          className="relative mx-auto max-w-6xl will-change-transform"
          style={{
            opacity: 'var(--trust-opacity, 0.74)',
            transform: 'translateY(var(--trust-rise, 46px))',
          }}
        >
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-[clamp(34px,5vw,54px)] font-semibold leading-tight text-[#071225]">
              可信创作基础设施
            </h2>
            <p className="mt-4 text-base text-slate-500">
              让创作被信任，让合作更安心
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <InfraCard
              icon={<Boxes className="h-9 w-9" />}
              title="Provenance"
              subtitle="创作来源可追踪"
              visual="asset"
            />
            <InfraCard
              icon={<FileText className="h-9 w-9" />}
              title="License Trace"
              subtitle="授权意向可信赖"
              visual="document"
            />
            <InfraCard
              icon={<UserRound className="h-9 w-9" />}
              title="Creator Ownership"
              subtitle="创作者权益可声明"
              visual="owner"
            />
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr_1fr_1fr]">
            <FlowCard title="Asset" lines={['#CC-8f3a...c1d9']} type="image" />
            <FlowCard title="Provenance Record" lines={['Created', 'May 21, 2025 10:31', 'By Creator City']} />
            <FlowCard title="License Inquiry" lines={['Usage', 'Commercial', 'Status', 'Inquiry']} />
            <FlowCard title="Creator Ownership" lines={['Creator', 'Ava Chen', 'Share', '100%']} />
          </div>
        </div>
      </section>
    </main>
  )
}

function CanvasMiniCard({ title, caption, active = false, video = false }: { title: string; caption: string; active?: boolean; video?: boolean }) {
  return (
    <div className="relative rounded-2xl border border-white/80 bg-white/70 p-3 text-left shadow-[0_18px_36px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="text-[11px] font-semibold text-slate-700">{title}</div>
      <div className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-100 via-white to-blue-200">
        {video ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/75 text-blue-500 shadow-sm">
            <Play className="h-4 w-4 fill-current" />
          </div>
        ) : (
          <div className={active ? 'h-full w-full bg-[radial-gradient(circle_at_20%_35%,rgba(197,181,255,0.75),transparent_28%),radial-gradient(circle_at_70%_60%,rgba(112,170,255,0.55),transparent_30%),linear-gradient(135deg,#f7f9ff,#cfdcff)]' : 'h-full w-full bg-[linear-gradient(135deg,#eef6ff,#adc8f8_48%,#f6fbff_49%,#d5e4ff)]'} />
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
        {caption}
      </div>
    </div>
  )
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-5 py-2 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
      <span className="text-blue-500">{icon}</span>
      {label}
    </div>
  )
}

function InfraCard({ icon, title, subtitle, visual }: { icon: React.ReactNode; title: string; subtitle: string; visual: 'asset' | 'document' | 'owner' }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/52 p-8 shadow-[0_24px_70px_rgba(37,99,235,0.12)] backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <div className="text-blue-500">{icon}</div>
        <div>
          <div className="text-base font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex h-36 w-36 items-center justify-center rounded-[30px] border border-blue-100 bg-gradient-to-br from-white to-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_22px_50px_rgba(37,99,235,0.16)]">
        {visual === 'asset' ? <div className="h-16 w-20 rounded-xl bg-[linear-gradient(135deg,#eef6ff,#adc8f8_48%,#f6fbff_49%,#d5e4ff)] shadow-lg" /> : null}
        {visual === 'document' ? <FileText className="h-16 w-16 text-blue-300" /> : null}
        {visual === 'owner' ? <UserRound className="h-16 w-16 text-blue-300" /> : null}
      </div>
    </div>
  )
}

function FlowCard({ title, lines, type }: { title: string; lines: string[]; type?: 'image' }) {
  return (
    <div className="relative rounded-2xl border border-white/80 bg-white/58 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {type === 'image' ? (
        <div className="mt-5 h-16 w-16 rounded-xl bg-[linear-gradient(135deg,#eef6ff,#adc8f8_48%,#f6fbff_49%,#d5e4ff)] shadow-md" />
      ) : null}
      <div className="mt-5 space-y-2 text-xs text-slate-500">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}
