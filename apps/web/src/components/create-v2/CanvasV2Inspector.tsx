'use client'

import { useState, useEffect } from 'react'
import type { CanvasV2NodeData, CanvasV2NodeKind } from '@/lib/canvas-v2/canvasV2Adapter'

type Props = {
  node: { id: string; data: CanvasV2NodeData } | null
  onClose: () => void
  onSave: (nodeId: string, updates: Partial<CanvasV2NodeData>) => void
  onGenerate: (nodeId: string, kind: CanvasV2NodeKind, prompt: string, providerId?: string) => Promise<void>
}

const PROVIDER_BY_KIND: Partial<Record<CanvasV2NodeKind, string>> = {
  image: 'volcengine-seedream-image',
  video: 'volcengine-seedance-video',
  generation: 'volcengine-seedream-image',
}

export function CanvasV2Inspector({ node, onClose, onSave, onGenerate }: Props) {
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (node) {
      setPrompt(node.data.prompt ?? '')
      setTitle(node.data.title ?? '')
      setError('')
    }
  }, [node?.id])

  if (!node) return null

  const canGenerate = node.data.kind === 'image' || node.data.kind === 'video' || node.data.kind === 'generation'

  async function handleGenerate() {
    if (!prompt.trim()) { setError('请输入 Prompt'); return }
    setError('')
    setGenerating(true)
    try {
      await onGenerate(node!.id, node!.data.kind as CanvasV2NodeKind, prompt.trim(), PROVIDER_BY_KIND[node!.data.kind as CanvasV2NodeKind])
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ position: 'absolute', right: 16, top: 16, bottom: 16, width: 300, zIndex: 20, background: 'rgba(10,10,22,.96)', border: '1px solid rgba(124,58,237,.35)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,.6)', overflowY: 'auto', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>节点属性</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Tag text={node.data.kind} color="#c4b5fd" bg="rgba(124,58,237,.18)" border="rgba(124,58,237,.3)" />
        <Tag text={node.data.status ?? 'idle'} color="#6ee7b7" bg="rgba(16,185,129,.12)" border="rgba(16,185,129,.25)" />
      </div>

      <Field label="标题">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="节点标题…"
          style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </Field>

      <Field label="Prompt">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入生成提示词…" rows={5}
          style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </Field>

      {node.data.resultImageUrl && (
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>生成结果</div>
          <img src={node.data.resultImageUrl} alt="result" style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)' }} />
        </div>
      )}
      {node.data.resultVideoUrl && (
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>生成视频</div>
          <video src={node.data.resultVideoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
        </div>
      )}

      {error && <div style={{ padding: '7px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
        <button onClick={() => { onSave(node.id, { title: title.trim() || undefined, prompt: prompt.trim() || undefined }); onClose() }}
          style={{ flex: 1, padding: '8px 0', background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.4)', borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          保存
        </button>
        {canGenerate && (
          <button onClick={handleGenerate} disabled={generating}
            style={{ flex: 1, padding: '8px 0', background: generating ? 'rgba(124,58,237,.1)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: '1px solid rgba(124,58,237,.5)', borderRadius: 8, color: generating ? '#6b7280' : '#fff', fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {generating ? '生成中…' : '生成'}
          </button>
        )}
      </div>
    </div>
  )
}

function Tag({ text, color, bg, border }: { text: string; color: string; bg: string; border: string }) {
  return <span style={{ padding: '2px 8px', background: bg, border: `1px solid ${border}`, borderRadius: 6, color, fontSize: 11, fontWeight: 600 }}>{text}</span>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}
