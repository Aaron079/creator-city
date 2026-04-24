'use client'

import type { ProjectTemplateRecommendation, ProjectWorkflowTemplate } from '@/lib/templates/projectTemplates'

export function ProjectTemplateSummaryPanel({
  templates,
  activeTemplateId,
  projectId,
  onSelectTemplate,
  recommendation,
}: {
  templates: ProjectWorkflowTemplate[]
  activeTemplateId: string | null
  projectId: string
  onSelectTemplate: (templateId: string) => void
  recommendation?: ProjectTemplateRecommendation
}) {
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null

  return (
    <section id="project-template-summary" className="px-5 pt-3">
      <div
        className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-3xl"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 28px 70px rgba(0,0,0,0.3)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Project Templates</p>
            <h2 className="mt-2 text-2xl font-light tracking-[-0.03em] text-white">先选一个更像样的项目起步结构</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              模板只决定启动建议，不会替你自动创建复杂镜头、任务或审批流。你可以先选一个更贴合的项目结构，再进入创作工作区细化。
            </p>
          </div>
          <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-3 backdrop-blur-2xl">
            <div className="text-[11px] text-white/45">当前项目</div>
            <div className="mt-1 text-sm font-semibold text-white">{projectId}</div>
            <div className="mt-1 text-xs text-white/45">
              {activeTemplate ? `已记录模板：${activeTemplate.name}` : '尚未选择模板'}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {templates.map((template) => {
            const active = template.id === activeTemplateId
            const suggested = recommendation?.templateId === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template.id)}
                className="rounded-[24px] border p-4 text-left transition-all hover:-translate-y-0.5"
                style={{
                  background: active ? 'rgba(138,43,226,0.14)' : 'rgba(255,255,255,0.026)',
                  borderColor: active ? 'rgba(138,43,226,0.34)' : 'rgba(255,255,255,0.08)',
                  boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 36px rgba(0,0,0,0.24)' : 'none',
                  backdropFilter: 'blur(24px)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-white">{template.name}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">{template.category}</div>
                  </div>
                  {suggested ? (
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-emerald-300">
                      AI 建议
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] leading-[1.7] text-white/55">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {template.recommendedRoles.slice(0, 3).map((role) => (
                    <span
                      key={`${template.id}-${role}`}
                      className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-white/55"
                    >
                      {role}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-white/40">
                  流程重点：{template.defaultWorkflowTabs.join(' / ')}
                </div>
              </button>
            )
          })}
        </div>

        {activeTemplate ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Template Summary</p>
                  <h3 className="mt-2 text-lg font-light tracking-[-0.03em] text-white">{activeTemplate.name}</h3>
                </div>
                <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-indigo-300">
                  起步结构
                </span>
              </div>
              <p className="mt-3 text-sm leading-[1.8] text-white/60">{activeTemplate.summary}</p>

              {recommendation ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/18 bg-emerald-500/8 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">AI 模板建议</div>
                  <div className="mt-2 text-sm text-white/80">{recommendation.reason}</div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">推荐角色</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeTemplate.recommendedRoles.map((role) => (
                    <span key={role} className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                      {role}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/35">推荐交付</div>
                <div className="mt-3 space-y-2 text-sm text-white/65">
                  {activeTemplate.recommendedOutputs.map((output) => <div key={output}>• {output}</div>)}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">流程与风险重点</div>
                <div className="mt-3 space-y-2 text-sm text-white/65">
                  {activeTemplate.defaultMilestones.map((milestone) => <div key={milestone}>• {milestone}</div>)}
                </div>
                <div className="mt-4 space-y-2 text-sm text-amber-200/85">
                  {activeTemplate.riskFocus.map((risk) => <div key={risk}>• {risk}</div>)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
