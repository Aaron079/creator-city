'use client'

import { useMemo, useState } from 'react'
import { Maximize2 } from 'lucide-react'

export interface CanvasHistoryItem {
  id: string
  title: string
  detail: string
  type?: 'image' | 'video' | 'world'
}

interface CanvasHistoryPanelProps {
  items: CanvasHistoryItem[]
  selectedId?: string
  onSelectItem: (item: CanvasHistoryItem) => void
  onClose: () => void
}

export function CanvasHistoryPanel({
  items,
  selectedId,
  onSelectItem,
  onClose,
}: CanvasHistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'world'>('image')
  const visibleItems = useMemo(() => {
    const typed = items.filter((item) => (item.type ?? 'image') === activeTab)
    return typed.length > 0 ? typed : items.slice(0, 5)
  }, [activeTab, items])

  return (
    <section className="canvas-history-panel" aria-label="历史面板" onPointerDown={(event) => event.stopPropagation()}>
      <div className="canvas-history-tabs">
        <button type="button" className={activeTab === 'image' ? 'is-active' : ''} onClick={() => setActiveTab('image')}>图片历史</button>
        <button type="button" className={activeTab === 'video' ? 'is-active' : ''} onClick={() => setActiveTab('video')}>视频历史</button>
        <button type="button" className={activeTab === 'world' ? 'is-active' : ''} onClick={() => setActiveTab('world')}>3D 世界</button>
        <button type="button" className="canvas-template-expand" onClick={onClose} aria-label="关闭历史面板">
          <Maximize2 size={20} />
        </button>
      </div>

      <div className="canvas-history-grid">
        {visibleItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`canvas-history-card is-${item.type ?? activeTab}-${index % 4} ${selectedId === item.id ? 'is-active' : ''}`}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelectItem(item)
            }}
          >
            <span className="canvas-history-thumb" />
            <span className="canvas-history-title">{item.title}</span>
            <span className="canvas-history-copy">{item.detail}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
