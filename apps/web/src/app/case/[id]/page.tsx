'use client'

import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { motion } from 'framer-motion'
import { useCaseStore } from '@/lib/case/caseStore'
import type { CaseStep } from '@/lib/case/caseStore'
import { Nav } from '@/components/layout/Nav'

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_META: Record<CaseStep['phase'], { label: string; icon: string; num: number }> = {
  concept:    { label: '创意',  icon: '💡', num: 1 },
  storyboard: { label: '分镜',  icon: '🎬', num: 2 },
  image:      { label: '图像',  icon: '🖼',  num: 3 },
  video:      { label: '视频',  icon: '▶',   num: 4 },
}

// ─── Trust layer mock data ────────────────────────────────────────────────────

const MOCK_REVIEWS = [
  {
    name:   '张明远',
    role:   '品牌创意总监',
    stars:  5,
    quote:  '效率提升不止 10 倍，而且创意质量完全没有打折。以前要开三次会，现在一句话就搞定了。',
  },
  {
    name:   'Linda Wu',
    role:   '独立导演',
    stars:  5,
    quote:  '分镜生成的质量真的超出预期，AI 给的参考图直接可以拿去和投资人沟通。',
  },
  {
    name:   '陈宇轩',
    role:   '电商品牌主理人',
    stars:  5,
    quote:  '48小时交付不是噱头，我们真的在两天内拿到了完整的广告片方案，直接上线跑了。',
  },
]

const TRADITIONAL_ITEMS = [
  { label: '报价区间',   value: '¥50,000 – 200,000' },
  { label: '制作周期',   value: '4 – 8 周' },
  { label: '沟通成本',   value: '频繁开会，多轮修改' },
  { label: '可见度',     value: '成片前无法预览' },
]

const TRADITIONAL_CONS = [
  '前期费用高，风险由客户承担',
  '周期长，错过营销窗口期',
  '创意理解偏差，反复返工',
]

const CC_ITEMS = [
  { label: '报价区间',   value: '¥8,000 – 30,000' },
  { label: '交付周期',   value: '48 小时' },
  { label: '沟通成本',   value: '一句话，AI 自动理解' },
  { label: '可见度',     value: '分镜图即时预览' },
]

const CC_PROS = [
  '成本降低 60–80%，无隐性费用',
  '48h 极速交付，抓住每个窗口',
  'AI 导演精准理解创意意图',
]

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, margin: '-80px' }}
      className={`max-w-5xl mx-auto px-6 ${className}`}
    >
      {children}
    </motion.section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.25em] uppercase font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
      {children}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const cases   = useCaseStore((s) => s.cases)
  const c       = cases.find((x) => x.id === id)

  if (!c) return notFound()

  const steps        = c.steps ?? []
  const beforeIdea   = c.beforeIdea   ?? c.description
  const afterResult  = c.afterResult  ?? c.result
  const views        = c.views        ?? '—'
  const conversion   = c.conversion   ?? '—'
  const clientQuote  = c.clientQuote  ?? '创作体验超出预期。'
  const clientName   = c.clientName   ?? '— 匿名客户'

  return (
    <main className="min-h-screen" style={{ background: '#050810', color: '#f9fafb' }}>
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[82vh] flex flex-col items-center justify-center overflow-hidden pt-14">

        {/* Orb */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width:      700,
            height:     700,
            top:        '-15%',
            left:       '50%',
            transform:  'translateX(-50%)',
            background: `radial-gradient(circle, ${c.accentColor}28 0%, transparent 65%)`,
            filter:     'blur(2px)',
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.018]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize:  '56px 56px',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center flex flex-col items-center gap-7">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: `${c.accentColor}18`,
              border:     `1px solid ${c.accentColor}45`,
              color:      c.accentColor,
            }}
          >
            <span>{c.icon}</span>
            <span>{c.category}</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]"
          >
            {c.title}
          </motion.h1>

          {/* Value prop */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl leading-relaxed max-w-xl"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {c.description}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 mt-2"
          >
            <motion.div
              whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.2, ease: 'easeOut' } }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/create"
                className="h-14 px-8 rounded-2xl text-base font-bold text-white flex items-center gap-2.5"
                style={{
                  background: `linear-gradient(135deg, ${c.accentColor}dd, ${c.accentColor})`,
                  boxShadow:  `0 6px 28px ${c.accentColor}55`,
                }}
              >
                <span>✦</span>
                <span>我要类似作品</span>
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.2, ease: 'easeOut' } }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/explore"
                className="h-14 px-7 rounded-2xl text-base font-medium flex items-center gap-2 transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border:     '1px solid rgba(255,255,255,0.1)',
                  color:      'rgba(255,255,255,0.55)',
                }}
              >
                ← 返回
              </Link>
            </motion.div>
          </motion.div>

          {/* Result pill */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="rounded-2xl px-5 py-3 text-sm font-medium"
            style={{
              background: `${c.accentColor}14`,
              border:     `1px solid ${c.accentColor}30`,
              color:      c.accentColor,
            }}
          >
            📈 {c.result}
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px mx-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Before / After ───────────────────────────────────────────────── */}
      <Section className="py-20">
        <SectionLabel>Before / After</SectionLabel>
        <h2 className="text-2xl font-bold mb-10">从一句话到成片</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wider uppercase"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
              >
                客户需求
              </span>
            </div>
            <p className="text-xl font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              &ldquo;{beforeIdea}&rdquo;
            </p>
            <div className="mt-auto pt-4 border-t border-white/[0.05]">
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>原始简报 · 一句话输入</p>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-4 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${c.accentColor}18 0%, rgba(7,11,20,0.95) 100%)`,
              border:     `1px solid ${c.accentColor}35`,
            }}
          >
            {/* accent top line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${c.accentColor}, ${c.accentColor}44)` }}
            />

            <div className="flex items-center gap-2">
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wider uppercase"
                style={{ background: `${c.accentColor}22`, color: c.accentColor }}
              >
                最终呈现
              </span>
            </div>

            {/* Visual mock */}
            <div
              className="rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{
                height:     160,
                background: `linear-gradient(160deg, ${c.accentColor}22 0%, rgba(5,8,16,0.9) 100%)`,
              }}
            >
              <span className="text-6xl opacity-30 select-none">{c.icon}</span>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.2)' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
                  style={{ background: `${c.accentColor}cc`, boxShadow: `0 4px 24px ${c.accentColor}55` }}
                >
                  ▶
                </div>
              </div>
            </div>

            <p className="text-lg font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {afterResult}
            </p>
            <div className="mt-auto pt-4 border-t" style={{ borderColor: `${c.accentColor}20` }}>
              <p className="text-[11px]" style={{ color: `${c.accentColor}99` }}>AI 导演全流程 · 高端交付</p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Divider */}
      <div className="h-px mx-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Process ──────────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <Section className="py-20">
          <SectionLabel>Process</SectionLabel>
          <h2 className="text-2xl font-bold mb-12">全程拆解</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {steps.map((step, i) => {
              const meta = PHASE_META[step.phase]
              return (
                <motion.div
                  key={step.phase}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true }}
                  whileHover={{
                    y: -3,
                    boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 20px ${c.accentColor}20`,
                    transition: { duration: 0.2, ease: 'easeOut' },
                  }}
                  className="rounded-2xl p-6 flex flex-col gap-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Step number + phase */}
                  <div className="flex items-center justify-between">
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: `${c.accentColor}22`, color: c.accentColor }}
                    >
                      {meta.num}
                    </span>
                    <span className="text-xl">{meta.icon}</span>
                  </div>

                  {/* Title */}
                  <div>
                    <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: `${c.accentColor}88` }}>
                      {meta.label}
                    </p>
                    <h3 className="text-sm font-bold text-white">{step.title}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] leading-[1.65]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {step.description}
                  </p>

                  {/* Prompt chip */}
                  <div
                    className="rounded-xl p-3 mt-auto"
                    style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[9px] tracking-widest uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      prompt
                    </p>
                    <p className="text-[10px] font-mono leading-[1.55]" style={{ color: `${c.accentColor}bb` }}>
                      {step.prompt}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Divider */}
      <div className="h-px mx-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Result ───────────────────────────────────────────────────────── */}
      <Section className="py-20">
        <SectionLabel>Result</SectionLabel>
        <h2 className="text-2xl font-bold mb-10">最终成绩</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Stat: views */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-2"
            style={{
              background: `linear-gradient(135deg, ${c.accentColor}14 0%, rgba(7,11,20,0.95) 100%)`,
              border:     `1px solid ${c.accentColor}30`,
            }}
          >
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>播放量</p>
            <p className="text-4xl font-black" style={{ color: c.accentColor }}>{views}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>发布后 30 天累计</p>
          </motion.div>

          {/* Stat: conversion */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-2"
            style={{
              background: `linear-gradient(135deg, ${c.accentColor}14 0%, rgba(7,11,20,0.95) 100%)`,
              border:     `1px solid ${c.accentColor}30`,
            }}
          >
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>转化提升</p>
            <p className="text-4xl font-black" style={{ color: c.accentColor }}>{conversion}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>相较同期基准</p>
          </motion.div>

          {/* Stat: delivery */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-2"
            style={{
              background: `linear-gradient(135deg, ${c.accentColor}14 0%, rgba(7,11,20,0.95) 100%)`,
              border:     `1px solid ${c.accentColor}30`,
            }}
          >
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>交付周期</p>
            <p className="text-4xl font-black" style={{ color: c.accentColor }}>48h</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>传统制作周期 1/10</p>
          </motion.div>
        </div>

        {/* Client quote */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="rounded-2xl p-8 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-3xl" style={{ color: `${c.accentColor}66` }}>&ldquo;</p>
          <p className="text-lg font-medium leading-[1.75]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {clientQuote}
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{clientName}</p>
        </motion.div>

        {/* ── Star reviews ─────────────────────────────────────────────── */}
        <div className="mt-6">
          <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
            用户评价
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MOCK_REVIEWS.map((r, i) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                viewport={{ once: true }}
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <span key={si} className="text-sm" style={{ color: si < r.stars ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}>
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-[12px] leading-[1.65]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  &ldquo;{r.quote}&rdquo;
                </p>
                <div className="mt-auto flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${c.accentColor}30`, color: c.accentColor }}
                  >
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white/70">{r.name}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{r.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Divider */}
      <div className="h-px mx-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <Section className="py-20">
        <SectionLabel>Why Creator City</SectionLabel>
        <h2 className="text-2xl font-bold mb-10">与传统制作对比</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Traditional */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🏢</span>
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>传统制作公司</p>
            </div>
            <div className="flex flex-col gap-3">
              {TRADITIONAL_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: 'rgba(255,255,255,0.55)' }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.05]">
              {TRADITIONAL_CONS.map((con) => (
                <div key={con} className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: '#ef4444' }}>✕</span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{con}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Creator City */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="rounded-2xl p-7 flex flex-col gap-5 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${c.accentColor}16 0%, rgba(7,11,20,0.97) 100%)`,
              border:     `1px solid ${c.accentColor}40`,
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${c.accentColor}, ${c.accentColor}44)` }}
            />
            <div className="flex items-center gap-3">
              <span className="text-xl">✦</span>
              <p className="text-sm font-semibold" style={{ color: c.accentColor }}>Creator City</p>
            </div>
            <div className="flex flex-col gap-3">
              {CC_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: c.accentColor }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-4 border-t" style={{ borderColor: `${c.accentColor}20` }}>
              {CC_PROS.map((pro) => (
                <div key={pro} className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: '#10b981' }}>✓</span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{pro}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── Live usage strip ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        viewport={{ once: true }}
        className="mx-6 mb-0 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-5xl mx-auto px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: '#10b981', boxShadow: '0 0 6px #10b98188', animation: 'orb-pulse 2s ease-in-out infinite' }}
            />
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              实时动态
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">👥</span>
              <div>
                <p className="text-sm font-bold text-white">127 位</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>创作者正在使用</p>
              </div>
            </div>
            <div
              className="hidden sm:block w-px h-8"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm font-bold text-white">23 个</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>今日已完成项目</p>
              </div>
            </div>
            <div
              className="hidden sm:block w-px h-8"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚡</span>
              <div>
                <p className="text-sm font-bold text-white">平均 48h</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>从创意到交付</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="h-px mx-6 mt-16" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <Section className="py-24 text-center flex flex-col items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-6"
        >
          <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
            开始你的项目
          </p>
          <h2 className="text-3xl md:text-5xl font-black leading-tight">
            下一个爆款，<br />
            <span style={{ color: c.accentColor }}>由你来导演。</span>
          </h2>
          <p className="text-base max-w-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            一句话创意，AI 自动生成分镜、图像与视频方案，48 小时内交付。
          </p>

          <motion.div
            whileHover={{ y: -3, scale: 1.03, boxShadow: `0 12px 40px ${c.accentColor}55`, transition: { duration: 0.2, ease: 'easeOut' } }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              href="/create"
              className="h-16 px-12 rounded-2xl text-lg font-bold text-white flex items-center gap-3"
              style={{
                background: `linear-gradient(135deg, ${c.accentColor}dd, ${c.accentColor})`,
                boxShadow:  `0 6px 32px ${c.accentColor}4a`,
              }}
            >
              <span>🎬</span>
              <span>开始创作</span>
            </Link>
          </motion.div>

          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            免费开始 · 无需信用卡
          </p>
        </motion.div>
      </Section>

      {/* Bottom spacer */}
      <div className="h-20" />
    </main>
  )
}
