'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { PublicTemplateGallery } from '@/components/templates/PublicTemplateGallery'
import { TemplatePreviewHero } from '@/components/templates/TemplatePreviewHero'
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
  const [showPreviewTip, setShowPreviewTip] = useState(true)

  return (
    <section className="canvas-template-panel" aria-label="模板面板" onPointerDown={(event) => event.stopPropagation()}>
      <div className="canvas-template-browser">
        <div className="canvas-drawer-head canvas-template-drawer-head">
          <button type="button" className="canvas-drawer-back" onClick={onClose} aria-label="关闭模板库">
            ‹
          </button>
          <h2>模板库</h2>
          <button type="button" className="canvas-template-expand" onClick={onClose} aria-label="关闭模板面板">
            <X size={16} />
          </button>
        </div>

        {showPreviewTip ? (
          <TemplatePreviewHero compact onDismiss={() => setShowPreviewTip(false)} />
        ) : null}

        <div className="canvas-template-tabs">
          <button type="button" className={activeTab === 'public' ? 'is-active' : ''} onClick={() => setActiveTab('public')}>公共模板</button>
          <button type="button" className={activeTab === 'mine' ? 'is-active' : ''} onClick={() => setActiveTab('mine')}>我的模板</button>
        </div>

        {activeTab === 'public' ? (
          <PublicTemplateGallery
            compact
            templates={PUBLIC_TEMPLATE_CATALOG}
            selectedTemplateId={selectedTemplateId}
            onUseTemplate={onSelectTemplate}
          />
        ) : (
          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm leading-6 text-white/48">
            你还没有保存模板。完成一个工作流后，可以保存为我的模板。
          </div>
        )}
      </div>
    </section>
  )
}
