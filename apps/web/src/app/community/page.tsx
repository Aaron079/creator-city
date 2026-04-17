'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'

const POSTS = [
  {
    id: '1', user: 'NeonDirector', avatar: '🎭', time: '2小时前',
    content: '刚用商业大片组合生成了一个赛博朋克悬疑脚本，结果直接满分 🔥 强烈推荐暗夜编剧 PRO + 作者导演的组合。',
    work: { title: '《暗流》短片脚本', tags: ['悬疑', '赛博朋克'], score: 98, icon: '🎬', from: '#1f0508', accent: '#f43f5e' },
    likes: 142, comments: 23,
  },
  {
    id: '2', user: 'SynthWave_Pro', avatar: '🎹', time: '5小时前',
    content: '分享一个发现：用极简角色 + 胶片质感组合做音乐短片效果绝了，情绪强度直接拉到 9/10。',
    work: { title: '城市低语 MV', tags: ['音乐', 'Lo-fi'], score: 91, icon: '🎵', from: '#1a1200', accent: '#f59e0b' },
    likes: 87, comments: 11,
  },
  {
    id: '3', user: 'PixelForge', avatar: '✏️', time: '1天前',
    content: '史诗编剧 PRO 真的是神器，把我一个"平庸的公路片创意"直接扩展成了三线叙事史诗。代价是整个脚本字数暴涨 3 倍 😂',
    work: { title: '《迷途·归途》剧本', tags: ['史诗', '公路片'], score: 97, icon: '📜', from: '#0c0818', accent: '#818cf8' },
    likes: 215, comments: 47,
  },
  {
    id: '4', user: 'IndieGhost', avatar: '👾', time: '2天前',
    content: '终于把"末日帝国"那个创意做出来了！用控制型导演 + 无人机的组合，画面冲击力超乎想象。',
    work: { title: '《末日协议》预告片', tags: ['动作', '科幻'], score: 94, icon: '🚀', from: '#0a1220', accent: '#60a5fa' },
    likes: 308, comments: 56,
  },
]

const AGENTS = [
  { id:'commercial', icon:'⚡', name:'商业编剧',    uses:'12.4K', rating:4.8, tag:'🔥热门' },
  { id:'pro_noir',   icon:'🌑', name:'暗夜编剧 PRO', uses:'8.1K',  rating:4.9, tag:'✦ PRO' },
  { id:'art',        icon:'🎨', name:'艺术编剧',    uses:'6.7K',  rating:4.7, tag:'影展级' },
  { id:'pro_epic',   icon:'👑', name:'史诗编剧 PRO', uses:'5.3K',  rating:4.9, tag:'✦ PRO' },
]

const TABS = ['动态', '作品', 'Agent']

export default function CommunityPage() {
  const [tab, setTab] = useState('动态')

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />

      <div className="pt-14">
        {/* Page header */}
        <div className="px-6 py-10 border-b border-white/[0.05]">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-city-emerald tracking-[0.2em] uppercase mb-2 font-medium">Community</p>
            <h1 className="text-3xl font-bold tracking-tight mb-6">创作者社区</h1>

            {/* Tabs */}
            <div className="flex gap-1">
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
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {tab === '动态' && (
            <div className="space-y-4">
              {POSTS.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 space-y-4 hover:border-white/[0.12] transition-colors"
                >
                  {/* User row */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-city-surface border border-white/[0.08] flex items-center justify-center text-lg">
                      {post.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{post.user}</p>
                      <p className="text-xs text-gray-600">{post.time}</p>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-gray-300 leading-relaxed">{post.content}</p>

                  {/* Attached work */}
                  <div
                    className="flex items-center gap-3 rounded-xl p-3 border border-white/[0.06]"
                    style={{ background: `linear-gradient(135deg, ${post.work.from}80 0%, #0a0f1a 100%)` }}
                  >
                    <span className="text-2xl">{post.work.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{post.work.title}</p>
                      <div className="flex gap-1 mt-0.5">
                        {post.work.tags.map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/40 text-gray-400 border border-white/10">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className="text-sm font-bold flex-shrink-0"
                      style={{ color: post.work.accent }}
                    >
                      {post.work.score}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                    <button className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                      <span>♥</span> {post.likes}
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                      <span>💬</span> {post.comments}
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-300 transition-colors ml-auto">
                      <span>↗</span> 分享
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {tab === 'Agent' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {AGENTS.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 flex items-center gap-4 hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-city-surface border border-city-accent/20 flex items-center justify-center text-2xl flex-shrink-0">
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.uses} 次使用</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-city-gold font-bold">★ {a.rating}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">{a.tag}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {tab === '作品' && (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">🎬</p>
              <p className="text-gray-500 text-sm mb-6">精选社区作品即将上线</p>
              <Link href="/explore" className="text-sm text-city-accent-glow hover:underline">
                前往探索页面 →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
