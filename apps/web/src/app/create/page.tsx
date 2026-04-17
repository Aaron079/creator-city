'use client'

import { useMemo, useState } from 'react'

type Writer = {
  id: string
  name: string
  icon: string
  desc: string
  tags: string[]
}

type Director = {
  id: string
  name: string
  icon: string
  desc: string
  tags: string[]
}

type Actor = {
  id: string
  name: string
  icon: string
  desc: string
}

type CameraStyle = {
  id: string
  name: string
  icon: string
  desc: string
}

type Scene = {
  title: string
  description: string
}

const WRITERS: Writer[] = [
  {
    id: 'classic',
    name: '经典编剧',
    icon: '📖',
    desc: '结构清晰，适合电影叙事。',
    tags: ['三幕式', '人物弧光', '稳'],
  },
  {
    id: 'commercial',
    name: '商业编剧',
    icon: '⚡',
    desc: '节奏快、冲突强、适合大众传播。',
    tags: ['高冲突', '高节奏', '爆点'],
  },
  {
    id: 'art',
    name: '艺术编剧',
    icon: '🎨',
    desc: '情绪优先，注重意象和氛围。',
    tags: ['留白', '气质', '作者性'],
  },
]

const DIRECTORS: Director[] = [
  {
    id: 'commercial',
    name: '商业导演',
    icon: '🔥',
    desc: '镜头强势、推进明确、适合大片。',
    tags: ['大场面', '节奏', '冲击'],
  },
  {
    id: 'auteur',
    name: '作者导演',
    icon: '🎞️',
    desc: '情感细腻，重视画面气质和长镜头。',
    tags: ['情绪', '美学', '表达'],
  },
  {
    id: 'control',
    name: '控制型导演',
    icon: '📐',
    desc: '逻辑强、镜头分配精确、适合成熟制作。',
    tags: ['精准', '结构', '完成度'],
  },
]

const ACTORS: Actor[] = [
  { id: 'hero', name: '主角型', icon: '🧑', desc: '魅力领袖，推动主线。' },
  { id: 'cold', name: '冷感型', icon: '🧊', desc: '克制神秘，适合高级感作品。' },
  { id: 'youth', name: '少年感', icon: '🌤️', desc: '轻盈敏感，适合青春线。' },
  { id: 'villain', name: '反派型', icon: '🕶️', desc: '气场强，适合制造压迫感。' },
]

const CAMERAS: CameraStyle[] = [
  { id: 'arri', name: 'ARRI 电影感', icon: '🎥', desc: '高质感、电影级色调。' },
  { id: 'handheld', name: '手持纪实', icon: '📹', desc: '更真实，更临场。' },
  { id: 'steady', name: '稳定器运镜', icon: '🛞', desc: '流畅、现代、适合商业片。' },
  { id: 'drone', name: '无人机视角', icon: '🚁', desc: '开阔、宏大、适合世界观展示。' },
]

function buildScenes(prompt: string, writer: Writer, director: Director, actor: Actor, camera: CameraStyle): Scene[] {
  const idea = prompt.trim() || '一个失忆的女导演在废弃影院里看见自己未拍完的未来电影'
  return [
    {
      title: '开场设定',
      description: `以“${idea}”为核心，${writer.name}建立故事前提，先把主角与核心命题稳稳立住。`,
    },
    {
      title: '人物进入',
      description: `${actor.name}角色进入画面，${director.name}强化人物气质，镜头以${camera.name}方式建立第一印象。`,
    },
    {
      title: '冲突升级',
      description: `${writer.name}推动主线冲突，${director.name}拉高节奏或情绪密度，让叙事进入真正的戏剧状态。`,
    },
    {
      title: '高潮落点',
      description: `通过${camera.name}镜头方案完成高潮，最终把主题回落到人物命运与选择，形成明确记忆点。`,
    },
  ]
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [writerId, setWriterId] = useState('commercial')
  const [directorId, setDirectorId] = useState('commercial')
  const [actorId, setActorId] = useState('hero')
  const [cameraId, setCameraId] = useState('arri')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])

  const writer = useMemo(() => WRITERS.find((x) => x.id === writerId) ?? WRITERS[0], [writerId])
  const director = useMemo(() => DIRECTORS.find((x) => x.id === directorId) ?? DIRECTORS[0], [directorId])
  const actor = useMemo(() => ACTORS.find((x) => x.id === actorId) ?? ACTORS[0], [actorId])
  const camera = useMemo(() => CAMERAS.find((x) => x.id === cameraId) ?? CAMERAS[0], [cameraId])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setScenes([])
    const steps = [
      '正在分析故事输入…',
      '正在匹配编剧风格…',
      '正在匹配导演语言…',
      '正在选择演员气质…',
      '正在规划摄影镜头…',
      '正在生成创作结果…',
    ]
    for (const step of steps) {
      setProgressText(step)
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    setScenes(buildScenes(prompt, writer, director, actor, camera))
    setProgressText('生成完成')
    setIsGenerating(false)
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_35%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10 px-6 md:px-10 py-6">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="text-sm text-white/60 hover:text-white transition">
            ← 返回首页
          </a>
          <a
            href="/studio"
            className="px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm transition"
          >
            保存项目
          </a>
        </header>

        <section className="max-w-7xl mx-auto mt-8 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-indigo-900/20">
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-sm text-indigo-200/80">Creator City / Create</div>
                <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
                  创作工作台
                </h1>
                <p className="mt-3 text-white/55 max-w-3xl leading-7">
                  先输入你的故事，再用编剧、导演、演员和摄影风格去建立完整创作团队。右侧画布会实时生成结果。
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm text-white/50 mb-3">故事输入框</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 outline-none text-base placeholder:text-white/25 focus:border-indigo-400/50 resize-none"
                  placeholder="输入你的故事创意，例如：一个失忆的女导演在废弃影院里看见自己未拍完的未来电影。"
                />
                <div className="mt-4 flex flex-col md:flex-row gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="h-12 px-6 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 transition text-base font-semibold shadow-lg shadow-indigo-500/30"
                  >
                    {isGenerating ? '生成中…' : '开始创作'}
                  </button>
                  <a
                    href="/community"
                    className="h-12 px-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-base"
                  >
                    查看社区工作流
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectorCard title="编剧部门" items={WRITERS} activeId={writerId} onChange={setWriterId} />
                <SelectorCard title="导演部门" items={DIRECTORS} activeId={directorId} onChange={setDirectorId} />
                <SelectorCard title="选角部门" items={ACTORS} activeId={actorId} onChange={setActorId} />
                <SelectorCard title="摄影部门" items={CAMERAS} activeId={cameraId} onChange={setCameraId} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl shadow-indigo-900/20 min-h-[640px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-indigo-200/80">生成画布</div>
                <h2 className="mt-2 text-2xl font-bold">右侧结果面板</h2>
              </div>
              {progressText ? <div className="text-sm text-white/45">{progressText}</div> : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
              当前团队：{writer.name} × {director.name} × {actor.name} × {camera.name}
            </div>

            {isGenerating ? (
              <div className="mt-6 space-y-3">
                {[
                  '编剧正在构思结构…',
                  '导演正在调整镜头语言…',
                  '选角导演正在匹配演员气质…',
                  '摄影组正在测试画面风格…',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/70 animate-pulse"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : scenes.length > 0 ? (
              <div className="mt-6 space-y-4">
                {scenes.map((scene, index) => (
                  <div
                    key={scene.title}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="text-xs text-indigo-200/80">Scene {index + 1}</div>
                    <div className="mt-1 text-lg font-semibold">{scene.title}</div>
                    <div className="mt-2 text-sm leading-7 text-white/60">{scene.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-white/40 leading-7">
                这里是你的创作画布。生成后可以看到故事结构、人物进入、冲突升级与高潮落点。后续这里可以继续接入分镜、图片、视频与工作流。
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

type SelectorBase = {
  id: string
  name: string
  icon: string
  desc: string
}

function SelectorCard<T extends SelectorBase>({
  title,
  items,
  activeId,
  onChange,
}: {
  title: string
  items: T[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-sm text-white/45 mb-3">{title}</div>
      <div className="space-y-3">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                active
                  ? 'border-indigo-400/50 bg-indigo-500/10'
                  : 'border-white/10 bg-black/30 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-xl">{item.icon}</div>
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-white/50 mt-1">{item.desc}</div>
                </div>
              </div>
              {'tags' in item && Array.isArray(item.tags) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
