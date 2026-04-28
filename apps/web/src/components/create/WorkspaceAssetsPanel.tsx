'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Folder, Plus, Search, Upload, UserRound, Users } from 'lucide-react'

interface WorkspaceAssetsPanelProps {
  shotCount: number
  storyboardFrameCount: number
  versionCount: number
  audioCueCount: number
  compact?: boolean
  onClose?: () => void
  onUploadMock?: () => void
  onAddAsset?: (asset: { title: string; category: string; prompt: string }) => void
}

const ASSET_FOLDERS = [
  {
    id: 'character',
    title: 'Character',
    samples: ['主角造型参考', '客户代言人', '动作姿态板'],
  },
  {
    id: 'scene',
    title: 'Scene',
    samples: ['城市夜景棚', '产品展示台', '日式木屋'],
  },
  {
    id: 'item',
    title: 'Item',
    samples: ['产品 HERO 物件', '道具组合', '包装细节'],
  },
  {
    id: 'style',
    title: 'Style',
    samples: ['高端科技黑玻璃', '电影感冷暖对比', '复古胶片'],
  },
  {
    id: 'sound',
    title: 'Sound Effect',
    samples: ['低频冲击', '机械开合', '环境氛围'],
  },
  {
    id: 'others',
    title: 'Others',
    samples: ['Logo 结尾板', '字幕条样式', '客户备注'],
  },
]

export function WorkspaceAssetsPanel({
  shotCount,
  storyboardFrameCount,
  versionCount,
  audioCueCount,
  compact = false,
  onClose,
  onUploadMock,
  onAddAsset,
}: WorkspaceAssetsPanelProps) {
  const totalAssets = shotCount + storyboardFrameCount + versionCount + audioCueCount
  const [activeScope, setActiveScope] = useState<'personal' | 'team'>('personal')
  const [query, setQuery] = useState('')
  const [expandedFolder, setExpandedFolder] = useState('character')
  const folders = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ASSET_FOLDERS
    return ASSET_FOLDERS.filter((folder) => (
      folder.title.toLowerCase().includes(normalized)
      || folder.samples.some((sample) => sample.toLowerCase().includes(normalized))
    ))
  }, [query])

  function addAsset(title: string, category: string) {
    onAddAsset?.({
      title,
      category,
      prompt: `${category} · ${title} 已加入当前画布素材库，可作为后续生成节点参考。`,
    })
  }

  return (
    <div className={compact ? 'canvas-assets-panel-compact' : 'mx-5 mt-3 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]'}>
      <div className="canvas-drawer-head">
        <button type="button" className="canvas-drawer-back" onClick={onClose} aria-label="关闭素材库">
          ‹
        </button>
        <h2>素材库</h2>
        <div className="canvas-drawer-actions">
          <button type="button" className="canvas-drawer-chip" onClick={() => addAsset('AI 角色参考', 'Character')}>
            <UserRound size={18} />
            AI 角色
          </button>
          <button type="button" className="canvas-drawer-icon-button" onClick={onUploadMock} aria-label="上传素材">
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="canvas-assets-preview-card">
        <div className="canvas-assets-preview-media" />
        <div>
          <h3>素材库加速创作</h3>
          <p>用本地素材、角色、场景和风格参考，快速构建可继续生成的画布节点。</p>
        </div>
      </div>

      <div className="canvas-segment-control">
        <button type="button" className={activeScope === 'personal' ? 'is-active' : ''} onClick={() => setActiveScope('personal')}>个人</button>
        <button type="button" className={activeScope === 'team' ? 'is-active' : ''} onClick={() => setActiveScope('team')}>团队</button>
      </div>

      <label className="canvas-drawer-search">
        <Search size={21} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
      </label>

      <div className="canvas-assets-folder-list">
        {folders.map((folder) => (
          <div key={folder.id} className="canvas-assets-folder">
            <button
              type="button"
              className="canvas-assets-folder-row"
              onClick={() => setExpandedFolder((current) => (current === folder.id ? '' : folder.id))}
            >
              <ChevronRight size={22} className={expandedFolder === folder.id ? 'is-expanded' : ''} />
              <Folder size={30} />
              <span>{folder.title}</span>
            </button>
            {expandedFolder === folder.id ? (
              <div className="canvas-assets-samples">
                {folder.samples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      addAsset(sample, folder.title)
                    }}
                  >
                    <span>{sample}</span>
                    <span>加入画布</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="canvas-assets-stats">
        <span><Upload size={14} /> {activeScope === 'personal' ? '个人' : '团队'}素材 {totalAssets}</span>
        <span>镜头 {shotCount}</span>
        <span>图片 {storyboardFrameCount}</span>
        <span>音频 {audioCueCount}</span>
        <span><Users size={14} />版本 {versionCount}</span>
      </div>
    </div>
  )
}
