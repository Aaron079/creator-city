'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type {
  DiscoveryAggregateResult,
  DiscoveryCaseCard,
  DiscoveryCreatorCard,
  DiscoveryProjectCard,
} from '@/lib/discovery/aggregate'
import {
  filterDiscoveryCases,
  filterDiscoveryCreators,
  filterDiscoveryProjects,
  type DiscoveryFilters,
} from '@/lib/search/filters'

type DiscoveryTab = 'projects' | 'creators' | 'cases'
type ToggleFilterKey = 'openRolesOnly' | 'highRatingOnly' | 'availableNowOnly'

function SectionTag({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
      {label}
    </span>
  )
}

function ReasonPill({ message }: { message: string }) {
  return (
    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/85">
      {message}
    </span>
  )
}

function ResultCard({
  title,
  meta,
  summary,
  reasons,
  actions,
  badges,
}: {
  title: string
  meta: string
  summary: string
  reasons: string[]
  actions: Array<{ href?: string; label: string; tone?: 'default' | 'primary' }>
  badges: string[]
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/55">{meta}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => <SectionTag key={badge} label={badge} />)}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-white/68">{summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {reasons.map((reason) => <ReasonPill key={reason} message={reason} />)}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {actions.map((action) => (
          action.href ? (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className={`inline-flex rounded-xl px-3 py-2 text-sm font-medium transition ${
                action.tone === 'primary'
                  ? 'border border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:border-cyan-400/45 hover:bg-cyan-400/14'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
              }`}
            >
              {action.label}
            </Link>
          ) : (
            <span
              key={action.label}
              className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/35"
            >
              {action.label}
            </span>
          )
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ item }: { item: DiscoveryProjectCard }) {
  return (
    <ResultCard
      title={item.title}
      meta={`${item.stage} · ${item.city} · ${item.deliveryStatus}`}
      summary={item.summary}
      reasons={item.reasons.map((reason) => reason.message)}
      badges={[
        item.priority === 'urgent' ? '急招' : '开放协作',
        ...item.openRoles.slice(0, 3),
      ]}
      actions={[
        { href: item.projectHref, label: '查看项目', tone: 'primary' },
        { href: item.rolesHref, label: '查看 open roles' },
        { href: item.inviteHref, label: '进入匹配/邀请流程' },
      ]}
    />
  )
}

function CreatorCard({ item }: { item: DiscoveryCreatorCard }) {
  return (
    <ResultCard
      title={item.displayName}
      meta={`${item.city} · ${item.roleTags.join(' / ')} · ${item.availability}`}
      summary={`评分 ${item.ratingSummary.rating.toFixed(1)} / ${Math.max(item.ratingSummary.reviewCount, 0)} 条参考记录。风格标签：${item.styleTags.slice(0, 4).join(' / ') || '未记录'}`}
      reasons={item.reasons.map((reason) => reason.message)}
      badges={[
        item.city,
        item.availability,
        ...(item.roleTags.slice(0, 2)),
      ]}
      actions={[
        { href: item.profileHref, label: '查看资料', tone: 'primary' },
        { href: item.caseHref, label: '查看案例' },
        { href: item.inviteHref, label: '邀请加入' },
      ]}
    />
  )
}

function CaseCard({ item }: { item: DiscoveryCaseCard }) {
  return (
    <ResultCard
      title={item.title}
      meta={`${item.category} · 关联创作者 ${item.creatorIds.length} 位`}
      summary={`${item.style}${item.quote ? ` · 「${item.quote}」` : ''}`}
      reasons={item.reasons.map((reason) => reason.message)}
      badges={[item.category, ...item.scoreTags.slice(0, 2)]}
      actions={[
        { href: item.detailHref, label: '查看案例详情', tone: 'primary' },
        { href: item.creatorHref, label: '查看对应创作者' },
      ]}
    />
  )
}

export function DiscoveryExplorer({ data }: { data: DiscoveryAggregateResult }) {
  const [tab, setTab] = useState<DiscoveryTab>('projects')
  const [filters, setFilters] = useState<DiscoveryFilters>({
    keyword: '',
    city: '',
    role: '',
    style: '',
    category: '',
    minRating: 0,
    availability: '',
    openRolesOnly: false,
    highRatingOnly: false,
    availableNowOnly: false,
  })

  const filteredProjects = useMemo(() => filterDiscoveryProjects(data.projects, filters), [data.projects, filters])
  const filteredCreators = useMemo(() => filterDiscoveryCreators(data.creators, filters), [data.creators, filters])
  const filteredCases = useMemo(() => filterDiscoveryCases(data.cases, filters), [data.cases, filters])

  const projectCityOptions = useMemo(
    () => Array.from(new Set([...data.projectCities, ...data.creatorCities])).sort(),
    [data.creatorCities, data.projectCities],
  )
  const toggleOptions: Array<{ key: ToggleFilterKey; label: string }> = [
    { key: 'openRolesOnly', label: '只看 open roles' },
    { key: 'highRatingOnly', label: '高评分' },
    { key: 'availableNowOnly', label: '现在可接' },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Project Search / Portfolio Discovery</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">统一发现页</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
              把项目、创作者、案例放进一个可筛选的入口里。它只做前端聚合与排序，后面很容易替换成真实搜索后端。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SectionTag label={`${filteredProjects.length} 个项目`} />
            <SectionTag label={`${filteredCreators.length} 位创作者`} />
            <SectionTag label={`${filteredCases.length} 个案例`} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <input
            value={filters.keyword}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="关键词：项目 / 创作者 / 风格 / 案例"
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"
          />
          <select
            value={filters.city}
            onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">全部城市</option>
            {projectCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select
            value={filters.role}
            onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">全部角色</option>
            {data.roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select
            value={filters.style}
            onChange={(event) => setFilters((current) => ({ ...current, style: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">全部风格</option>
            {data.styleOptions.map((style) => <option key={style} value={style}>{style}</option>)}
          </select>
          <select
            value={filters.category}
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">全部分类</option>
            {data.categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {toggleOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilters((current) => ({ ...current, [option.key]: !current[option.key] }))}
              className="rounded-full border px-3 py-1.5 text-[12px] transition"
              style={{
                borderColor: filters[option.key] ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.10)',
                background: filters[option.key] ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                color: filters[option.key] ? '#cffafe' : 'rgba(255,255,255,0.62)',
              }}
            >
              {option.label}
            </button>
          ))}
          <select
            value={String(filters.minRating)}
            onChange={(event) => setFilters((current) => ({ ...current, minRating: Number(event.target.value) }))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/70 outline-none"
          >
            <option value="0">全部评分</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
            <option value="4.7">4.7+</option>
          </select>
          <select
            value={filters.availability}
            onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/70 outline-none"
          >
            <option value="">全部可用性</option>
            <option value="available">available</option>
            <option value="limited">limited</option>
            <option value="unavailable">unavailable</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-black/10 p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'projects', label: `项目 ${filteredProjects.length}` },
            { id: 'creators', label: `创作者 ${filteredCreators.length}` },
            { id: 'cases', label: `案例 ${filteredCases.length}` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as DiscoveryTab)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition"
              style={{
                background: tab === item.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                border: tab === item.id ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.08)',
                color: tab === item.id ? '#c7d2fe' : 'rgba(255,255,255,0.62)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        {tab === 'projects' && filteredProjects.map((item) => <ProjectCard key={item.projectId} item={item} />)}
        {tab === 'creators' && filteredCreators.map((item) => <CreatorCard key={item.profileId} item={item} />)}
        {tab === 'cases' && filteredCases.map((item) => <CaseCard key={item.caseId} item={item} />)}

        {((tab === 'projects' && filteredProjects.length === 0)
          || (tab === 'creators' && filteredCreators.length === 0)
          || (tab === 'cases' && filteredCases.length === 0)) ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-sm text-white/45">
              当前筛选条件下还没有可展示结果。换个关键词、城市或风格试试看，结果会更有戏。
            </div>
          ) : null}
      </section>
    </div>
  )
}
