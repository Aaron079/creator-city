'use client'

import { useMemo, useState } from 'react'

type Writer = {
  id: string
  name: string
  icon: string
  desc: string
}

type Director = {
  id: string
  name: string
  icon: string
  desc: string
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

type FlowNode = {
  id: string
  title: string
  body: string
  tone: string
}

const WRITERS: Writer[] = [
  { id: 'classic', name: '经典编剧', icon: '📖', desc: '结构稳定，适合电影叙事。' },
  { id: 'commercial', name: '商业编剧', icon: '⚡', desc: '节奏快，冲突强，传播感好。' },
  { id: 'art', name: '艺术编剧', icon: '🎨', desc: '情绪优先，适合作者表达。' },
]

const DIRECTORS: Director[] = [
  { id: 'commercial', name: '商业导演', icon: '🔥', desc: '推进强，镜头清晰，适合大片。' },
  { id: 'auteur', name: '作者导演', icon: '🎞️', desc: '重视气质、情绪与表达。' },
  { id: 'control', name: '控制型导演', icon: '📐', desc: '结构精准，完成度高。' },
]

const ACTORS: Actor[] = [
  { id: 'hero', name: '主角型', icon: '🧑', desc: '魅力强，推动主线。' },
  { id: 'cold', name: '冷感型', icon: '🧊', desc: '克制神秘，高级感强。' },
  { id: 'youth', name: '少年感', icon: '🌤️', desc: '轻盈敏感，适合青春线。' },
]

const CAMERAS: CameraStyle[] = [
  { id: 'arri', name: 'ARRI 电影感', icon: '🎥', desc: '高质感电影色调。' },
  { id: 'handheld', name: '手持纪实', icon: '📹', desc: '更真实，更临场。' },
  { id: 'steady', name: '稳定器运镜', icon: '🛞', desc: '流畅现代，适合商业片。' },
]

function buildFlow(
  prompt: string,
  writer: Writer,
  director: Director,
  actor: Actor,
  camera: CameraStyle
): FlowNode[] {
  const idea = prompt.trim() || '一个失忆的女导演在废弃影院里看见自己未拍完的未来电影'

  return [
    {
      id: 'prompt',
      title: 'Prompt',
      body: idea,
      tone: '输入创意',
    },
    {
      id: 'writer',
      title: `${writer.icon} ${writer.name}`,
      body: `建立故事前提、人物命题与结构起点，让创意先变成可推进的叙事。`,
      tone: '结构搭建',
    },
    {
      id: 'director',
      title: `${director.icon} ${director.name}`,
      body: `确定叙事方式、镜头密度和情绪推进，决定这个项目“怎么被看见”。`,
      tone: '导演语言',
    },
    {
      id: 'casting',
      title: `${actor.icon} ${actor.name}`,
      body: `匹配角色气质与人物呈现方式，让观众先记住“谁在承受这个故事”。`,
      tone: '人物质感',
    },
    {
      id: 'camera',
      title: `${camera.icon} ${camera.name}`,
      body: `设定整体画面表达：运动方式、镜头感觉、电影感与空间层次。`,
      tone: '摄影方案',
    },
    {
      id: 'output',
      title: '🎬 输出结果',
      body: `输出第一版创作工作流，可继续接入分镜、概念图、视频镜头与最终成片。`,
      tone: '可执行方案',
    },
  ]
}

function OptionCard<T extends { id: string; name: string; icon: string; desc: string }>({
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
              <div className="flex items-start gap-3">
                <div className="text-xl">{item.icon}</div>
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-white/50 mt-1 leading-6">{item.desc}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [writerId, setWriterId] = useState('commercial')
  const [directorId, setDirectorId] = useState('commercial')
  const [actorId, setActorId] = useState('hero')
  const [cameraId, setCameraId] = useState('arri')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('等待生成')
  const [nodes, setNodes] = useState<FlowNode[]>([])

  const writer = useMemo(() => WRITERS.find((x) => x.id === writerId) ?? WRITERS[0], [writerId])
  const director = useMemo(() => DIRECTORS.find((x) => x.id === directorId) ?? DIRECTORS[0], [directorId])
  const actor = useMemo(() => ACTORS.find((x) => x.id === actorId) ?? ACTORS[0], [actorId])
  const camera = useMemo(() => CAMERAS.find((x) => x.id === cameraId) ?? CAMERAS[0], [cameraId])

  const handleGenerate = async () => {
    setLoading(true)
    setNodes([])

    const steps = [
      '编剧部门正在拆解故事…',
      '导演部门正在搭建镜头逻辑…',
      '选角部门正在匹配角色气质…',
      '摄影部门正在制定视觉方案…',
      '正在输出创作节点…',
    ]

    for (const step of steps) {
      setStatus(step)
      await new Promise((resolve) => setTimeout(resolve, 420))
    }

    setNodes(buildFlow(prompt, writer, director, actor, camera))
    setStatus('生成完成')
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_35%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10 px-6 md:px-10 py-6">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="text-sm text-white/60 hover:text-white transition">
            ← 返回首页
          </a>
          <div className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/60">
            当前状态：{status}
          </div>
        </header>

        <section className="max-w-7xl mx-auto mt-8">
          <div className="mb-8">
            <div className="text-sm text-indigo-200/80">Creator City / Create</div>
            <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
              节点画布工作台
            </h1>
            <p className="mt-3 max-w-3xl text-white/55 leading-7">
              上方输入故事，左侧建立剧组，右侧生成工作流节点。先把灵感变成结构，再往分镜、概念图和视频推进。
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl shadow-indigo-900/20">
                <div className="text-sm text-white/50 mb-3">故事输入</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-4 outline-none text-base placeholder:text-white/25 focus:border-indigo-400/50 resize-none"
                  placeholder="输入你的创意，例如：一个失忆的女导演在废弃影院里看见自己未拍完的未来电影。"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="mt-4 h-12 w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 transition text-base font-semibold shadow-lg shadow-indigo-500/30"
                >
                  {loading ? '生成中…' : '生成工作流'}
                </button>
              </div>

              <OptionCard title="编剧部门" items={WRITERS} activeId={writerId} onChange={setWriterId} />
              <OptionCard title="导演部门" items={DIRECTORS} activeId={directorId} onChange={setDirectorId} />
              <OptionCard title="选角部门" items={ACTORS} activeId={actorId} onChange={setActorId} />
              <OptionCard title="摄影部门" items={CAMERAS} activeId={cameraId} onChange={setCameraId} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl shadow-indigo-900/20 min-h-[760px]">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <div className="text-sm text-indigo-200/80">Canvas</div>
                  <h2 className="mt-2 text-2xl font-bold">节点画布</h2>
                </div>
                <div className="text-sm text-white/45">
                  {writer.name} × {director.name} × {actor.name} × {camera.name}
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[
                    '正在生成 Prompt 节点…',
                    '正在生成 编剧 节点…',
                    '正在生成 导演 节点…',
                    '正在生成 摄影与输出 节点…',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/70 animate-pulse"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : nodes.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[1050px] flex items-center gap-4 pt-4 pb-2">
                    {nodes.map((node, index) => (
                      <div key={node.id} className="flex items-center gap-4">
                        <div className="w-[220px] rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="text-xs text-indigo-200/80">{node.tone}</div>
                          <div className="mt-2 text-lg font-semibold">{node.title}</div>
                          <div className="mt-3 text-sm leading-7 text-white/60">{node.body}</div>
                        </div>
                        {index < nodes.length - 1 ? (
                          <div className="w-10 h-px bg-white/20 shrink-0" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-white/40 leading-7">
                  这里是你的工作流画布。生成后会以节点形式展示：
                  Prompt → 编剧 → 导演 → 选角 → 摄影 → 输出。
                  下一步我们可以继续把这里升级成可拖动、可展开、可复用的专业画布。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
