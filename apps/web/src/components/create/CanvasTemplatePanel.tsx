'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { PublicTemplateGallery } from '@/components/templates/PublicTemplateGallery'
import { PUBLIC_TEMPLATE_CATALOG, type PublicTemplate } from '@/lib/templates/public-template-catalog'

interface CanvasTemplatePanelProps {
  selectedTemplateId?: string
  onSelectTemplate: (template: PublicTemplate) => void
  onClose: () => void
}

export function CanvasTemplatePanel({
  selectedTemplateId,
  onSelectTemplate,
  onClose,
}: CanvasTemplatePanelProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'mine'>('public')
  const templates = useMemo(() => (
    activeTab === 'mine'
      ? PUBLIC_TEMPLATE_CATALOG.filter((template) => [
        '商业广告',
        '产品展示',
        '品牌短片',
        '社媒短视频',
        '分镜脚本',
        '情绪板',
      ].includes(template.category)).slice(0, 18)
      : PUBLIC_TEMPLATE_CATALOG
  ), [activeTab])

  return (
    <section className="canvas-template-panel" aria-label="模板面板" onPointerDown={(event) => event.stopPropagation()}>
      <div className="canvas-template-browser">
        <div className="canvas-template-tabs">
          <button type="button" className={activeTab === 'public' ? 'is-active' : ''} onClick={() => setActiveTab('public')}>公共模板</button>
          <button type="button" className={activeTab === 'mine' ? 'is-active' : ''} onClick={() => setActiveTab('mine')}>我的模板</button>
          <button type="button" className="canvas-template-expand" onClick={onClose} aria-label="关闭模板面板">
            <X size={16} />
          </button>
        </div>

        <PublicTemplateGallery
          compact
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onUseTemplate={onSelectTemplate}
        />
      </div>
    </section>
  )
}
