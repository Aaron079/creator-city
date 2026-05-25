'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'
type TaskType = 'image' | 'video' | 'text' | 'audio' | 'music' | string

interface GenerationTask {
  id: string
  nodeId: string | null
  projectId: string | null
  providerId: string
  type: TaskType
  status: TaskStatus
  promptPreview: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  durationMs: number | null
  errorCode: string | null
  errorStage: string | null
  errorMessage: string | null
  stageTrace: string[] | null
  resultUrl: string | null
  executorKind: string | null
}

interface ApiResponse {
  success: boolean
  tasks: GenerationTask[]
  total: number
  error?: string
  message?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number | null) {
  if (!ms || ms < 0) return null
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

// ─── Style constants ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  queued: { label: '排队中', bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', dot: '#fbbf24' },
  running: { label: '生成中', bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', dot: '#60a5fa' },
  succeeded: { label: '已完成', bg: 'rgba(52,211,153,0.1)', color: '#34d399', dot: '#34d399' },
  failed: { label: '失败', bg: 'rgba(248,113,113,0.1)', color: '#f87171', dot: '#f87171' },
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  image: { label: '图片', bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  video: { label: '视频', bg: 'rgba(251,146,60,0.1)', color: '#fb923c' },
  text: { label: '文本', bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' },
  audio: { label: '音频', bg: 'rgba(52,211,153,0.08)', color: '#34d399' },
  music: { label: '音乐', bg: 'rgba(52,211,153,0.08)', color: '#34d399' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.5)' }
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:'5px',padding:'3px 9px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:cfg.bg,color:cfg.color }}>
      <span style={{ width:'5px',height:'5px',borderRadius:'50%',background:cfg.dot,flexShrink:0 }} />
      {cfg.label}
    </span>
  )
}

function TypeChip({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }
  return (
    <span style={{ display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'5px',fontSize:'11px',fontWeight:600,background:cfg.bg,color:cfg.color }}>
      {cfg.label}
    </span>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copy = () => {
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      style={{ padding:'2px 8px',borderRadius:'5px',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:copied?'#34d399':'rgba(255,255,255,0.45)',fontSize:'11px',cursor:'pointer',flexShrink:0 }}
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px 20px',minWidth:'100px' }}>
      <div style={{ fontSize:'24px',fontWeight:700,color:accent??'#e8e8f0',letterSpacing:'-0.03em' }}>{value}</div>
      <div style={{ fontSize:'12px',color:'rgba(255,255,255,0.38)',marginTop:'4px' }}>{label}</div>
    </div>
  )
}

function MediaPreview({ task }: { task: GenerationTask }) {
  if (!task.resultUrl) return null
  if (task.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={task.resultUrl}
        alt="生成结果"
        style={{ display:'block',width:'100%',maxWidth:'200px',height:'auto',borderRadius:'6px',objectFit:'cover',border:'1px solid rgba(255,255,255,0.08)' }}
      />
    )
  }
  if (task.type === 'video') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={task.resultUrl}
        controls
        playsInline
        style={{ display:'block',width:'100%',maxWidth:'200px',height:'auto',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.08)' }}
      />
    )
  }
  return (
    <a href={task.resultUrl} target="_blank" rel="noreferrer" style={{ fontSize:'12px',color:'#60a5fa' }}>
      打开结果 ↗
    </a>
  )
}

function DiagJSON({ task }: { task: GenerationTask }) {
  const diag = JSON.stringify({
    id: task.id, nodeId: task.nodeId, projectId: task.projectId,
    providerId: task.providerId, type: task.type, status: task.status,
    errorCode: task.errorCode, errorStage: task.errorStage,
    errorMessage: task.errorMessage, stageTrace: task.stageTrace,
    executorKind: task.executorKind,
    createdAt: task.createdAt, completedAt: task.completedAt, durationMs: task.durationMs,
  }, null, 2)
  return <CopyButton text={diag} label="复制诊断 JSON" />
}

function TaskCard({ task }: { task: GenerationTask }) {
  const [expanded, setExpanded] = useState(false)
  const isFailed = task.status === 'failed'

  return (
    <article
      style={{
        background: isFailed ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isFailed ? 'rgba(248,113,113,0.14)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '12px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top row */}
      <div style={{ display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap' }}>
        <TypeChip type={task.type} />
        <StatusChip status={task.status} />
        {task.durationMs ? (
          <span style={{ fontSize:'11px',color:'rgba(255,255,255,0.3)',marginLeft:'auto',flexShrink:0 }}>
            {formatDuration(task.durationMs)}
          </span>
        ) : null}
      </div>

      {/* Prompt preview */}
      {task.promptPreview ? (
        <p style={{ margin:0,fontSize:'13px',color:'rgba(255,255,255,0.65)',lineHeight:'1.5',wordBreak:'break-word' }}>
          {task.promptPreview}{task.promptPreview.length >= 80 ? '…' : ''}
        </p>
      ) : null}

      {/* Meta */}
      <dl style={{ margin:0,display:'flex',flexDirection:'column',gap:'6px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap' }}>
          <dt style={{ fontSize:'11px',color:'rgba(255,255,255,0.28)',flexShrink:0 }}>任务 ID</dt>
          <dd style={{ margin:0,display:'flex',alignItems:'center',gap:'6px' }}>
            <code style={{ fontFamily:'ui-monospace,monospace',fontSize:'11px',color:'rgba(255,255,255,0.55)' }}>
              {shortId(task.id)}
            </code>
            <CopyButton text={task.id} label="复制任务 ID" />
          </dd>
        </div>
        {task.providerId ? (
          <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
            <dt style={{ fontSize:'11px',color:'rgba(255,255,255,0.28)',flexShrink:0 }}>Provider</dt>
            <dd style={{ margin:0,fontSize:'11px',color:'rgba(255,255,255,0.5)' }}>{task.providerId}</dd>
          </div>
        ) : null}
        <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
          <dt style={{ fontSize:'11px',color:'rgba(255,255,255,0.28)',flexShrink:0 }}>创建时间</dt>
          <dd style={{ margin:0,fontSize:'11px',color:'rgba(255,255,255,0.45)' }}>{formatDate(task.createdAt)}</dd>
        </div>
        {task.completedAt ? (
          <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
            <dt style={{ fontSize:'11px',color:'rgba(255,255,255,0.28)',flexShrink:0 }}>完成时间</dt>
            <dd style={{ margin:0,fontSize:'11px',color:'rgba(255,255,255,0.45)' }}>{formatDate(task.completedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {/* Error info */}
      {isFailed && (task.errorCode || task.errorStage || task.errorMessage) ? (
        <div style={{ background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.14)',borderRadius:'8px',padding:'10px 12px',display:'flex',flexDirection:'column',gap:'4px' }}>
          {task.errorCode ? (
            <div style={{ display:'flex',gap:'8px',alignItems:'center' }}>
              <span style={{ fontSize:'11px',color:'rgba(248,113,113,0.6)',flexShrink:0 }}>errorCode</span>
              <code style={{ fontFamily:'ui-monospace,monospace',fontSize:'11px',color:'#f87171' }}>{task.errorCode}</code>
            </div>
          ) : null}
          {task.errorStage ? (
            <div style={{ display:'flex',gap:'8px',alignItems:'center' }}>
              <span style={{ fontSize:'11px',color:'rgba(248,113,113,0.6)',flexShrink:0 }}>errorStage</span>
              <code style={{ fontFamily:'ui-monospace,monospace',fontSize:'11px',color:'#f87171' }}>{task.errorStage}</code>
            </div>
          ) : null}
          {task.errorMessage ? (
            <p style={{ margin:0,fontSize:'12px',color:'rgba(248,113,113,0.8)',marginTop:'2px' }}>{task.errorMessage}</p>
          ) : null}
        </div>
      ) : null}

      {/* Media preview */}
      {task.resultUrl ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background:'none',border:'none',padding:0,color:'rgba(255,255,255,0.4)',fontSize:'12px',cursor:'pointer',marginBottom:expanded?'8px':0 }}
          >
            {expanded ? '▾ 收起预览' : '▸ 展开结果预览'}
          </button>
          {expanded ? <MediaPreview task={task} /> : null}
        </div>
      ) : null}

      {/* Footer: copy diag JSON */}
      <div style={{ display:'flex',alignItems:'center',gap:'8px',paddingTop:'4px',borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize:'11px',color:'rgba(255,255,255,0.22)',flex:1 }}>
          {task.nodeId ? `节点 ${task.nodeId.slice(0, 8)}` : ''}
          {task.projectId ? ` · 项目 ${task.projectId.slice(0, 8)}` : ''}
        </span>
        <DiagJSON task={task} />
      </div>
    </article>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
]

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
]

const SELECT_STYLE: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '13px',
  cursor: 'pointer',
  outline: 'none',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/generation-tasks?${params.toString()}`)
      const data: ApiResponse = await res.json() as ApiResponse
      if (!data.success) {
        setError(data.message ?? data.error ?? '读取失败')
        setTasks([])
      } else {
        setTasks(data.tasks)
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => { void fetchTasks() }, [fetchTasks])

  // Derived stats from loaded tasks (full list regardless of current filter)
  const [allTasks, setAllTasks] = useState<GenerationTask[]>([])
  useEffect(() => {
    if (!typeFilter && !statusFilter) setAllTasks(tasks)
  }, [tasks, typeFilter, statusFilter])

  const statsSource = allTasks.length > 0 ? allTasks : tasks
  const stats = {
    total: statsSource.length,
    running: statsSource.filter((t) => t.status === 'running' || t.status === 'queued').length,
    succeeded: statsSource.filter((t) => t.status === 'succeeded').length,
    failed: statsSource.filter((t) => t.status === 'failed').length,
    image: statsSource.filter((t) => t.type === 'image').length,
    video: statsSource.filter((t) => t.type === 'video').length,
  }

  return (
    <div style={{ minHeight:'100vh',background:'#0a0a0f',color:'#e8e8f0',fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Header */}
      <header style={{ position:'sticky',top:0,zIndex:10,display:'flex',alignItems:'center',gap:'16px',padding:'0 32px',height:'60px',background:'rgba(10,10,15,0.9)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <a href="/create" style={{ display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'rgba(255,255,255,0.4)',textDecoration:'none',padding:'6px 10px',borderRadius:'7px',border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)' }}>
          ← 返回画布
        </a>
        <div style={{ width:'1px',height:'20px',background:'rgba(255,255,255,0.08)' }} />
        <h1 style={{ fontSize:'14px',fontWeight:600,color:'rgba(255,255,255,0.75)',margin:0 }}>生成任务中心</h1>
        <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:'8px' }}>
          <span style={{ fontSize:'11px',color:'rgba(255,255,255,0.22)' }}>只读 · 不触发生成</span>
          <button
            type="button"
            onClick={() => { void fetchTasks() }}
            disabled={loading}
            style={{ padding:'5px 12px',borderRadius:'7px',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.55)',fontSize:'12px',cursor:loading?'not-allowed':'pointer' }}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth:'960px',margin:'0 auto',padding:'40px 24px 80px' }}>
        {/* Title */}
        <div style={{ marginBottom:'32px' }}>
          <h2 style={{ fontSize:'22px',fontWeight:700,color:'#e8e8f0',margin:'0 0 6px',letterSpacing:'-0.02em' }}>生成任务中心</h2>
          <p style={{ fontSize:'13px',color:'rgba(255,255,255,0.38)',margin:0 }}>查看最近图片与视频生成任务状态、耗时、错误和结果</p>
        </div>

        {/* Stats */}
        {!loading && !error ? (
          <div style={{ display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'32px' }}>
            <StatCard label="全部任务" value={stats.total} />
            <StatCard label="进行中" value={stats.running} accent={stats.running > 0 ? '#60a5fa' : undefined} />
            <StatCard label="已成功" value={stats.succeeded} accent={stats.succeeded > 0 ? '#34d399' : undefined} />
            <StatCard label="已失败" value={stats.failed} accent={stats.failed > 0 ? '#f87171' : undefined} />
            <StatCard label="图片任务" value={stats.image} accent={stats.image > 0 ? '#a78bfa' : undefined} />
            <StatCard label="视频任务" value={stats.video} accent={stats.video > 0 ? '#fb923c' : undefined} />
          </div>
        ) : null}

        {/* Filters */}
        <div style={{ display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'24px',alignItems:'center' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={SELECT_STYLE}
            aria-label="按类型筛选"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={SELECT_STYLE}
            aria-label="按状态筛选"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {tasks.length > 0 ? (
            <span style={{ fontSize:'12px',color:'rgba(255,255,255,0.28)',marginLeft:'auto' }}>
              显示 {tasks.length} 条
            </span>
          ) : null}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 0',color:'rgba(255,255,255,0.28)',fontSize:'14px' }}>
            加载中…
          </div>
        ) : error ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 0',gap:'12px' }}>
            <div style={{ fontSize:'14px',color:'rgba(248,113,113,0.8)' }}>无法读取任务列表，请稍后重试</div>
            <div style={{ fontSize:'12px',color:'rgba(255,255,255,0.28)' }}>{error}</div>
            <button
              type="button"
              onClick={() => { void fetchTasks() }}
              style={{ marginTop:'8px',padding:'7px 16px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.6)',fontSize:'13px',cursor:'pointer' }}
            >
              重试
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 0',gap:'8px' }}>
            <div style={{ fontSize:'14px',color:'rgba(255,255,255,0.3)' }}>暂无生成任务</div>
            <div style={{ fontSize:'12px',color:'rgba(255,255,255,0.18)' }}>
              {typeFilter || statusFilter ? '当前筛选条件下没有匹配的任务' : '去画布生成图片或视频后，任务将显示在这里'}
            </div>
          </div>
        ) : (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'12px' }}>
            {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </main>
    </div>
  )
}
