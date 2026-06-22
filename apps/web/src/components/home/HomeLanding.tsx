'use client'

import Link from 'next/link'
import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { useAuthStore } from '@/store/auth.store'
import {
  ArrowDown,
  Boxes,
  FileText,
  Grid2X2,
  Link2,
  Sparkles,
  UserRound,
} from 'lucide-react'
import CardSwap, { Card } from './CardSwap'
import SoftAurora from './SoftAurora'

const primaryButton =
  'inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-white px-8 text-[15px] font-semibold text-[#16121b] shadow-[0_18px_54px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-white/92'

const secondaryButton =
  'inline-flex h-14 items-center justify-center gap-2 rounded-[22px] border border-white/12 bg-white/[0.055] px-8 text-[15px] font-semibold text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-200/34 hover:bg-fuchsia-300/12 hover:text-white'

const capsuleLink =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-white/52 transition hover:bg-white/[0.055] hover:text-white'

const HOME_NAV_GROUPS = [
  {
    label: '创作',
    key: 'create',
    items: [
      { label: 'AI 画布', href: '/create' },
      { label: '生成任务', href: '/tasks' },
      { label: 'API 中心', href: '/providers' },
    ],
  },
  {
    label: '市场',
    key: 'market',
    items: [
      { label: '市场总览', href: '/marketplace' },
      { label: '创作者主页', href: '/creator-profile-preview', badge: '即将' },
      { label: '需求广场', href: '/demand-board-preview', badge: '即将' },
      { label: '报价方案', href: '/proposal-flow-preview', badge: '即将' },
    ],
  },
  {
    label: '工作台',
    key: 'workspace',
    items: [
      { label: '项目中心', href: '/projects' },
      { label: '资产中心', href: '/assets' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    label: '我的 API',
    key: 'myapi',
    items: [
      { label: 'API 账户管理', href: '/account/providers' },
      { label: 'API Key 接入指南', href: '/help/api-keys' },
      { label: '生成用量', href: '/account/usage' },
    ],
  },
  {
    label: '平台',
    key: 'platform',
    items: [
      { label: '路线图', href: '/roadmap' },
      { label: '商业模式', href: '/pricing' },
      { label: '协议版权', href: '/terms-preview' },
    ],
  },
  {
    label: '社区与帮助',
    key: 'community',
    items: [
      { label: '社区', href: '/community' },
      { label: '诊断帮助', href: '/help' },
      { label: '提交反馈', href: '/feedback' },
    ],
  },
]

function getUserInitial(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim()
  if (name) return ([...name][0] ?? 'U').toUpperCase()
  const e = email?.trim()
  if (e) return (e[0] ?? 'U').toUpperCase()
  return 'U'
}

function getUserShortName(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim()
  if (name) return name
  const e = email?.trim()
  if (e) return e.split('@')[0] ?? e
  return '用户'
}

export function HomeLanding() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { status: sessionStatus, user: sessionUser } = useCurrentUser()
  const effectiveUser = sessionUser ?? ((sessionStatus === 'loading' || sessionStatus === 'unknown') ? user : null)
  const effectiveIsAuthenticated = sessionStatus === 'authenticated' || ((sessionStatus === 'loading' || sessionStatus === 'unknown') && isAuthenticated)

  const handleCanvasEntry = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    // Do not read last-project-id here. /api/projects/ensure returns the
    // current user's own project when the canvas boots.
    router.push('/create')
  }, [router])

  return (
    <main className="relative overflow-hidden bg-[#100d16] text-white">
      <div className="fixed inset-0 z-0 bg-[#100d16]">
        <SoftAurora
          speed={0.48}
          scale={1.56}
          brightness={1.12}
          color1="#fff2ff"
          color2="#ec22a4"
          noiseFrequency={2.45}
          noiseAmplitude={1}
          bandHeight={0.45}
          bandSpread={1.08}
          octaveDecay={0.12}
          layerOffset={0.42}
          colorSpeed={0.88}
          mouseInfluence={0.22}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_55%,rgba(255,136,222,0.10),transparent_34rem),radial-gradient(circle_at_78%_58%,rgba(40,76,255,0.13),transparent_30rem),linear-gradient(180deg,rgba(16,13,22,0.18)_0%,rgba(16,13,22,0.58)_70%,rgba(16,13,22,0.88)_100%)]"
      />

      <section className="relative z-10 min-h-screen px-5 py-6 sm:px-7 lg:px-9">
        <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1740px] flex-col overflow-hidden rounded-[34px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_28px_90px_rgba(0,0,0,0.38)]">
          <HomeCapsuleNav
            handleCanvasEntry={handleCanvasEntry}
            isAuthenticated={effectiveIsAuthenticated}
            user={effectiveUser}
          />

          <div className="flex flex-1 items-center justify-center px-5 pb-20 pt-32 text-center sm:px-10 lg:pt-36">
            <div className="mx-auto max-w-5xl">
              <h1 className="text-[clamp(64px,10vw,148px)] font-semibold leading-[0.94] tracking-[-0.045em] text-white">
                Creator City
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-8 text-white/60 sm:text-xl">
                AI 创作者的会员制工作台
              </p>
              <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
                <Link href="/create" onClick={handleCanvasEntry} className={primaryButton}>
                  <Sparkles className="h-4 w-4" />
                  进入 AI Canvas
                </Link>
                <Link href="/account/providers" className={secondaryButton}>
                  <Link2 className="h-4 w-4" />
                  连接 BYOK
                </Link>
              </div>
            </div>
          </div>

          <a
            href="#engine"
            aria-label="Scroll to AI Canvas engine"
            className="absolute bottom-6 left-1/2 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/78 shadow-[0_18px_60px_rgba(236,34,164,0.22)] backdrop-blur transition hover:-translate-y-1 hover:border-white/28 lg:flex"
          >
            <ArrowDown className="h-6 w-6" />
          </a>
        </div>
      </section>

      <section id="engine" className="relative z-10 min-h-screen px-5 py-20 sm:px-6 sm:py-24">
        <SectionGlow />
        <div className="relative mx-auto grid min-h-[calc(100vh-12rem)] max-w-7xl items-center gap-16 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-xl text-center lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-fuchsia-100/42">
              AI Canvas Engine
            </p>
            <h2 className="mt-5 text-[34px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl lg:text-7xl">
              一组会自动换位的创作工具栈
            </h2>
            <p className="mt-6 text-base leading-8 text-white/54 sm:text-lg">
              从生成、拆解、重构到可信流转，第二屏用卡片交换呈现工具之间的接力感。
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link href="/create" onClick={handleCanvasEntry} className={primaryButton}>
                <Sparkles className="h-4 w-4" />
                进入 AI Canvas
              </Link>
              <Link href="/assets" className={secondaryButton}>
                <Grid2X2 className="h-4 w-4" />
                查看资产库
              </Link>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-visible sm:min-h-[620px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_64%_50%,rgba(236,72,153,0.18),transparent_40%),radial-gradient(circle_at_72%_54%,rgba(88,80,236,0.22),transparent_42%)]" />
            <CardSwap
              width={520}
              height={370}
              cardDistance={66}
              verticalDistance={74}
              delay={4300}
              pauseOnHover
              skewAmount={5}
            >
              <Card>
                <ToolStackCard
                  index="01"
                  title="AI Generate"
                  subtitle="Prompt to image / video"
                  description="把想法转为图片、视频和镜头素材。"
                  accent="from-fuchsia-400 via-pink-300 to-indigo-300"
                />
              </Card>
              <Card>
                <ToolStackCard
                  index="02"
                  title="Asset Decompose"
                  subtitle="Break assets into editable parts"
                  description="把已生成资产拆成可重构、可复用的创作片段。"
                  accent="from-violet-300 via-fuchsia-300 to-pink-300"
                />
              </Card>
              <Card>
                <ToolStackCard
                  index="03"
                  title="Remix Studio"
                  subtitle="Reframe, restyle, rebuild"
                  description="围绕已有素材快速改构图、换风格、做再设计。"
                  accent="from-indigo-300 via-purple-300 to-fuchsia-300"
                />
              </Card>
              <Card>
                <ToolStackCard
                  index="04"
                  title="Provenance Trace"
                  subtitle="Keep origin and license context"
                  description="让资产来源、授权意向和协作记录留在同一条线上。"
                  accent="from-pink-300 via-rose-200 to-violet-300"
                />
              </Card>
            </CardSwap>
          </div>
        </div>
      </section>

      <section id="trust-infra" className="relative z-10 flex min-h-screen items-center px-5 py-24 sm:px-6">
        <SectionGlow variant="trust" />
        <div className="relative mx-auto w-full max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
              可信创作基础设施
            </h2>
            <p className="mt-5 text-base leading-8 text-white/52 sm:text-lg">
              来源可追踪，授权可协作，创作者权益可声明
            </p>
          </div>

          <div className="relative mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
            <div
              aria-hidden="true"
              className="absolute left-[16%] right-[16%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-fuchsia-200/50 to-transparent shadow-[0_0_28px_rgba(236,72,153,0.48)] md:block"
            />
            <TrustNode
              icon={<Boxes className="h-8 w-8" />}
              title="Provenance"
              description="创作来源可追踪"
            />
            <TrustNode
              icon={<FileText className="h-8 w-8" />}
              title="License Inquiry"
              description="授权意向可协作"
              featured
            />
            <TrustNode
              icon={<UserRound className="h-8 w-8" />}
              title="Creator Ownership"
              description="创作者权益可声明"
            />
          </div>

          <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-5">
            <Link href="/create" onClick={handleCanvasEntry} className={primaryButton}>
              <Sparkles className="h-4 w-4" />
              进入 AI Canvas
            </Link>
            <Link href="/marketplace" className={secondaryButton}>
              <Grid2X2 className="h-4 w-4" />
              查看创作者市场
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function HomeCapsuleNav({
  handleCanvasEntry,
  isAuthenticated,
  user,
}: {
  handleCanvasEntry: (event: MouseEvent<HTMLAnchorElement>) => void
  isAuthenticated: boolean
  user: { displayName?: string | null; email?: string | null } | null
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMenuEnter = useCallback((key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenMenu(key)
  }, [])

  const handleMenuLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140)
  }, [])

  return (
    <nav className="absolute left-1/2 top-10 z-20 flex w-[min(94vw,1240px)] -translate-x-1/2 items-center justify-between gap-5 rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:px-7">
      <Link href="/" className="flex items-center gap-3 text-[22px] font-semibold tracking-[-0.03em] text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.035]">
          <Sparkles className="h-5 w-5" />
        </span>
        Creator City
      </Link>
      <div className="hidden items-center gap-1 lg:flex">
        {HOME_NAV_GROUPS.map((group) => (
          <div
            key={group.key}
            className="relative"
            onMouseEnter={() => handleMenuEnter(group.key)}
            onMouseLeave={handleMenuLeave}
          >
            <button className={capsuleLink}>
              {group.label}
              <span className="text-[9px] text-white/28">▾</span>
            </button>
            {openMenu === group.key ? (
              <div
                className="absolute left-1/2 top-full z-30 mt-3 w-[210px] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/10 bg-[#15101d]/92 p-1.5 shadow-[0_26px_74px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
                onMouseEnter={() => handleMenuEnter(group.key)}
                onMouseLeave={handleMenuLeave}
              >
                {group.items.map((item) => {
                  const isCreate = item.href === '/create'
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={isCreate ? handleCanvasEntry : undefined}
                      className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-[12px] font-semibold text-white/64 transition hover:bg-white/[0.075] hover:text-white"
                    >
                      <span>{item.label}</span>
                      {'badge' in item && item.badge ? (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/42">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {isAuthenticated && user ? (
        <Link
          href="/account"
          className="flex shrink-0 items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.065] py-2 pl-2 pr-4 text-[13px] font-semibold text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/18 hover:bg-white/[0.095] hover:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#17111c]">
            {getUserInitial(user.displayName, user.email)}
          </span>
          <span className="max-w-[112px] truncate">
            {getUserShortName(user.displayName, user.email)}
          </span>
        </Link>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/auth/login"
            className="rounded-[16px] border border-white/10 bg-white/[0.055] px-4 py-2.5 text-[13px] font-semibold text-white/72 transition hover:border-white/20 hover:bg-white/[0.085] hover:text-white"
          >
            登录
          </Link>
          <Link
            href="/auth/register"
            className="rounded-[16px] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#17111c] transition hover:bg-white/90"
          >
            注册
          </Link>
        </div>
      )}
    </nav>
  )
}

function SectionGlow({ variant = 'engine' }: { variant?: 'engine' | 'trust' }) {
  const center = variant === 'engine' ? '50% 50%' : '50% 38%'
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(circle at ${center}, rgba(236,72,153,0.13), transparent 34rem), radial-gradient(circle at 74% 52%, rgba(75,74,222,0.13), transparent 28rem), linear-gradient(180deg,rgba(16,13,22,0.20),rgba(16,13,22,0.58))`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
    </>
  )
}

function ToolStackCard({
  index,
  title,
  subtitle,
  description,
  accent,
}: {
  index: string
  title: string
  subtitle: string
  description: string
  accent: string
}) {
  return (
    <div className="relative flex h-full flex-col justify-between p-8">
      <div className={`absolute inset-x-8 top-8 h-36 rounded-[24px] bg-gradient-to-br ${accent} opacity-22 blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-white/38">
          <span>Creator City</span>
          <span>{index}</span>
        </div>
        <div className={`mt-8 h-36 rounded-[24px] border border-white/12 bg-gradient-to-br ${accent} p-px shadow-[0_24px_60px_rgba(0,0,0,0.24)]`}>
          <div className="relative h-full overflow-hidden rounded-[23px] bg-[#100d16]/72">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_32%,rgba(255,255,255,0.26),transparent_16%),radial-gradient(circle_at_76%_64%,rgba(255,255,255,0.16),transparent_20%)]" />
            <svg className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 text-white/58" viewBox="0 0 360 90" fill="none" aria-hidden="true">
              <path d="M8 58C54 10 94 78 136 38C177-1 215 66 259 34C293 10 323 20 352 46" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <circle cx="85" cy="51" r="6" fill="currentColor" />
              <circle cx="205" cy="45" r="6" fill="currentColor" />
              <circle cx="312" cy="40" r="6" fill="currentColor" />
            </svg>
          </div>
        </div>
      </div>
      <div className="relative">
        <h3 className="text-4xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
        <p className="mt-3 text-sm font-medium text-fuchsia-100/54">{subtitle}</p>
        <p className="mt-6 max-w-sm text-sm leading-7 text-white/48">{description}</p>
      </div>
    </div>
  )
}

function TrustNode({ icon, title, description, featured = false }: { icon: ReactNode; title: string; description: string; featured?: boolean }) {
  return (
    <div className={`relative rounded-[30px] border p-7 text-center backdrop-blur-2xl ${
      featured
        ? 'border-fuchsia-200/26 bg-fuchsia-300/[0.075] shadow-[0_0_70px_rgba(236,72,153,0.22),inset_0_1px_0_rgba(255,255,255,0.12)]'
        : 'border-white/10 bg-white/[0.035] shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)]'
    }`}>
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-fuchsia-100/16 bg-black/30 text-fuchsia-100 shadow-[0_0_36px_rgba(236,72,153,0.14)]">
        {icon}
      </div>
      <h3 className="mt-7 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/52">{description}</p>
    </div>
  )
}
