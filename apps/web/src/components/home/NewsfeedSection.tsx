'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const news = [
  {
    id: '1',
    category: '公告',
    categoryColor: 'text-city-emerald',
    title: 'v0.8 版本上线：AI 导演模式正式开放',
    time: '2小时前',
    excerpt: '全新的 AI 导演功能现已对所有 Lv.5+ 用户开放，支持自动分镜、配音和剪辑。',
  },
  {
    id: '2',
    category: '赛事',
    categoryColor: 'text-city-gold',
    title: '首届创作者杯海选启动，总奖池 50 万积分',
    time: '5小时前',
    excerpt: '跨类型创作大赛正式开赛，影视、音乐、游戏三条赛道，截止报名日期 5 月 1 日。',
  },
  {
    id: '3',
    category: '社区',
    categoryColor: 'text-city-sky',
    title: '影视区新城区「深海片场」正式落成',
    time: '1天前',
    excerpt: '深海主题新片场开放入驻，含 4 个专属摄影棚和 1 个水下特效实验室。',
  },
  {
    id: '4',
    category: '更新',
    categoryColor: 'text-city-accent-glow',
    title: 'Agent 技能树系统重大更新',
    time: '2天前',
    excerpt: '全新的 Agent 升级路径，剧本 Agent 现支持多幕剧结构和人物弧光自动分析。',
  },
]

const recruitments = [
  {
    id: '1',
    project: '《量子边境》网剧',
    owner: 'CyberDirector',
    avatar: '🎬',
    needs: ['声音设计', '3D 角色建模'],
    deadline: '3天后',
    reputation: 'Lv.8+',
  },
  {
    id: '2',
    project: '城市交响曲 Vol.3',
    owner: 'SynthMaster',
    avatar: '🎵',
    needs: ['混音师', '专辑封面设计'],
    deadline: '5天后',
    reputation: 'Lv.5+',
  },
  {
    id: '3',
    project: '独立游戏《迷城》',
    owner: 'IndieForge',
    avatar: '🎮',
    needs: ['剧情撰写', '像素艺术'],
    deadline: '1周后',
    reputation: 'Lv.3+',
  },
]

export function NewsfeedSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* News */}
          <div className="lg:col-span-3">
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-2xl font-bold">新闻社快报</h2>
              <Link href="/news" className="text-city-accent-glow text-sm hover:underline underline-offset-4">
                查看全部 →
              </Link>
            </div>
            <div className="space-y-3">
              {news.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  viewport={{ once: true }}
                >
                  <Link href={`/news/${item.id}`} className="block city-card hover:border-city-accent/30 group">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs font-medium ${item.categoryColor}`}>
                            [{item.category}]
                          </span>
                          <span className="text-xs text-gray-600">{item.time}</span>
                        </div>
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-city-accent-glow transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {item.excerpt}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recruitment */}
          <div className="lg:col-span-2">
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-2xl font-bold">合作招募</h2>
              <Link href="/recruit" className="text-city-accent-glow text-sm hover:underline underline-offset-4">
                发布招募 →
              </Link>
            </div>
            <div className="space-y-3">
              {recruitments.map((rec, i) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                  viewport={{ once: true }}
                >
                  <Link href={`/recruit/${rec.id}`} className="block city-card hover:border-city-accent/30 group">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{rec.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-snug mb-0.5 group-hover:text-city-accent-glow transition-colors">
                          {rec.project}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">@{rec.owner}</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {rec.needs.map((need) => (
                            <span
                              key={need}
                              className="text-xs px-1.5 py-0.5 rounded bg-city-accent/10 text-city-accent-glow border border-city-accent/20"
                            >
                              {need}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span>截止 {rec.deadline}</span>
                          <span>需求 {rec.reputation}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
