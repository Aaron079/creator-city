'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'

const MY_WORKS = [
  { id:'w1', title:'《霓虹侦探》', sub:'商业悬疑短片', icon:'🎬', score:94, from:'#1f0508', accent:'#f43f5e', date:'今天' },
  { id:'w2', title:'末日序章',     sub:'史诗动作剧本', icon:'🚀', score:97, from:'#0a1220', accent:'#60a5fa', date:'昨天' },
  { id:'w3', title:'记忆残片',     sub:'艺术短片脚本', icon:'📜', score:88, from:'#0c0818', accent:'#818cf8', date:'3天前' },
]

const MY_AGENTS = [
  { icon:'⚡', name:'我的商业编剧',  style:'爆款流', uses:47, revenue:'¥23.5', status:'normal' },
  { icon:'🎨', name:'情绪大师',      style:'情绪流', uses:31, revenue:'¥15.5', status:'normal' },
  { icon:'🌑', name:'深渊叙事者',    style:'暗黑风', uses:12, revenue:'¥6.0',  status:'降权' },
]

const STATS = [
  { label:'总生成', value:'23', color:'text-city-accent-glow' },
  { label:'本月创作', value:'8',  color:'text-city-emerald' },
  { label:'总收益',  value:'¥45', color:'text-city-gold' },
  { label:'最高分',  value:'97',  color:'text-city-rose' },
]

const TABS = ['作品', 'Agent', '收益']

export default function StudioPage() {
  const [tab, setTab] = useState('作品')

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />

      <div className="pt-14">
        {/* Profile header */}
        <div className="px-6 py-10 border-b border-white/[0.05]">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-5 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-city-accent/40 to-violet-600/40 border border-city-accent/30 flex items-center justify-center text-3xl flex-shrink-0">
                🎬
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold">创作者</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-city-accent/10 text-city-accent-glow border border-city-accent/20">
                    早期用户
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">@creator · 加入于 2024</p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-city-accent text-white text-sm font-semibold hover:bg-city-accent-glow hover:shadow-lg hover:shadow-city-accent/40 transition-all duration-200"
                >
                  + 新建创作
                </Link>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {STATS.map(s => (
                <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-white/[0.05]">
          <div className="max-w-4xl mx-auto flex gap-1 py-2">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {tab === '作品' && (
            <div className="space-y-3">
              {MY_WORKS.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <Link
                    href={`/showcase/${w.id}`}
                    className="flex items-center gap-4 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-200 group"
                    style={{ background: `linear-gradient(135deg, ${w.from}50 0%, transparent 50%)` }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${w.from}80`, border: `1px solid ${w.accent}30` }}>
                      {w.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-city-accent-glow transition-colors">
                        {w.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: w.accent }}>{w.sub}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: w.accent }}>{w.score}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{w.date}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}

              <Link
                href="/create"
                className="flex items-center justify-center gap-2 rounded-2xl p-4 border border-dashed border-white/[0.1] text-gray-600 hover:text-gray-400 hover:border-white/[0.2] transition-all duration-200 text-sm"
              >
                + 新建创作
              </Link>
            </div>
          )}

          {tab === 'Agent' && (
            <div className="space-y-3">
              {MY_AGENTS.map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className={`flex items-center gap-4 rounded-2xl p-4 bg-white/[0.03] border transition-colors ${
                    a.status === '降权' ? 'border-city-rose/20' : 'border-white/[0.07]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-city-surface border border-city-accent/20 flex items-center justify-center text-2xl flex-shrink-0">
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.style} · {a.uses} 次使用</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-city-emerald">{a.revenue}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded border mt-1 inline-block ${
                      a.status === '降权'
                        ? 'text-city-rose border-city-rose/30 bg-city-rose/5'
                        : 'text-city-emerald border-city-emerald/30 bg-city-emerald/5'
                    }`}>
                      {a.status === '降权' ? '降权' : '正常'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {tab === '收益' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['总收益', '¥45.0', 'text-city-gold'],
                  ['本月', '¥23.5', 'text-city-emerald'],
                  ['本周', '¥12.0', 'text-city-accent-glow'],
                  ['今日', '¥6.0', 'text-white'],
                ] as [string, string, string][]).map(([l, v, c]) => (
                  <div key={l} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 text-center">
                    <p className={`text-2xl font-bold ${c}`}>{v}</p>
                    <p className="text-xs text-gray-500 mt-1">{l}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5">
                <p className="text-xs text-gray-500 mb-3">收益来源</p>
                {MY_AGENTS.map(a => (
                  <div key={a.name} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-sm">{a.icon}</span>
                    <span className="flex-1 text-sm text-gray-300 truncate">{a.name}</span>
                    <span className="text-sm font-semibold text-city-emerald">{a.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
