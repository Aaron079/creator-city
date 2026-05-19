'use client'

import type { CanvasV2NodeKind } from '@/lib/canvas-v2/canvasV2Adapter'

const TOOLS: Array<{ kind: CanvasV2NodeKind; label: string; icon: string; desc: string }> = [
  { kind: 'text', label: '文本', icon: '📝', desc: '文本/脚本节点' },
  { kind: 'image', label: '图像', icon: '🖼️', desc: '图像生成节点' },
  { kind: 'video', label: '视频', icon: '🎬', desc: '视频生成节点' },
  { kind: 'asset', label: '素材', icon: '📦', desc: '素材引用节点' },
  { kind: 'generation', label: '生成', icon: '✨', desc: '通用生成节点' },
]

type Props = {
  onAddNode: (kind: CanvasV2NodeKind) => void
  onToggleAssetLibrary: () => void
  assetLibraryOpen: boolean
}

export function CanvasV2Toolbar({ onAddNode, onToggleAssetLibrary, assetLibraryOpen }: Props) {
  return (
    <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(10,10,20,.92)', border: '1px solid rgba(124,58,237,.3)', borderRadius: 14, padding: 10, backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
      <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', letterSpacing: 1, marginBottom: 2, fontWeight: 600 }}>节点</div>
      {TOOLS.map((t) => (
        <button key={t.kind} title={t.desc} onClick={() => onAddNode(t.kind)}
          style={{ width: 44, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.25)', borderRadius: 10, cursor: 'pointer', color: '#c4b5fd', fontSize: 18 }}>
          <span>{t.icon}</span>
          <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>{t.label}</span>
        </button>
      ))}
      <div style={{ height: 1, background: 'rgba(124,58,237,.2)', margin: '2px 0' }} />
      <button
        title="项目素材库"
        onClick={onToggleAssetLibrary}
        style={{ width: 44, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: assetLibraryOpen ? 'rgba(124,58,237,.3)' : 'rgba(124,58,237,.1)', border: assetLibraryOpen ? '1px solid rgba(124,58,237,.6)' : '1px solid rgba(124,58,237,.25)', borderRadius: 10, cursor: 'pointer', color: '#c4b5fd', fontSize: 18 }}
      >
        <span>📚</span>
        <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>素材库</span>
      </button>
    </div>
  )
}
