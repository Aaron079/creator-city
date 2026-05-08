'use client'

import { Sparkles } from 'lucide-react'
import type { CreatorSkill, ProjectStyleBible } from '@/lib/skills'

type CanvasSkillPanelProps = {
  styleBible: ProjectStyleBible
  skills: CreatorSkill[]
  enabledSkillIds: string[]
  onStyleBibleChange: (styleBible: ProjectStyleBible) => void
  onToggleSkill: (skillId: string) => void
  onApply: () => void
  onGenerateTemplate: () => void
  onClose: () => void
}

const STYLE_FIELDS: Array<{
  key: keyof Pick<ProjectStyleBible, 'logline' | 'storyWorld' | 'visualStyle' | 'colorPalette' | 'cameraLanguage' | 'characterRules' | 'sceneRules' | 'negativeRules'>
  label: string
  placeholder: string
}> = [
  { key: 'logline', label: '项目一句话', placeholder: '一句话描述项目。' },
  { key: 'storyWorld', label: '世界观', placeholder: '这个故事发生在哪里、什么时代、什么规则。' },
  { key: 'visualStyle', label: '视觉风格', placeholder: '例如：电影感、赛博朋克、写实、胶片质感、未来城市。' },
  { key: 'colorPalette', label: '色彩方案', placeholder: '例如：霓虹蓝、紫红、冷色雨夜、高反差。' },
  { key: 'cameraLanguage', label: '镜头语言', placeholder: '例如：广角、低机位、缓慢推进、浅景深、手持感。' },
  { key: 'characterRules', label: '人物一致性', placeholder: '主角外貌、服装、道具、身份设定。' },
  { key: 'sceneRules', label: '场景一致性', placeholder: '城市、建筑、室内外、天气、时代符号。' },
  { key: 'negativeRules', label: '禁止项', placeholder: '不要卡通化、不要改变角色年龄、不要白天场景等。' },
]

export function CanvasSkillPanel({
  styleBible,
  skills,
  enabledSkillIds,
  onStyleBibleChange,
  onToggleSkill,
  onApply,
  onGenerateTemplate,
  onClose,
}: CanvasSkillPanelProps) {
  const enabledCount = skills.filter((skill) => enabledSkillIds.includes(skill.id)).length

  return (
    <section className="canvas-side-panel is-skill-panel" aria-label="风格圣经与 Skill 面板" onPointerDown={(event) => event.stopPropagation()}>
      <div className="canvas-panel-head">
        <div>
          <div className="canvas-panel-kicker">Creator Skill System</div>
          <div className="canvas-panel-title">风格圣经</div>
        </div>
        <button type="button" className="canvas-panel-close" onClick={onClose} aria-label="关闭 Skill 面板">
          ×
        </button>
      </div>

      <div className="canvas-skill-summary">
        <span><Sparkles size={14} /> Skills: {enabledCount}</span>
        <button type="button" onClick={onGenerateTemplate}>从当前节点生成模板</button>
      </div>

      <div className="canvas-style-form">
        {STYLE_FIELDS.map((field) => (
          <label key={field.key} className="canvas-style-field">
            <span>{field.label}</span>
            <textarea
              value={String(styleBible[field.key] ?? '')}
              placeholder={field.placeholder}
              onChange={(event) => onStyleBibleChange({ ...styleBible, [field.key]: event.target.value })}
              onWheel={(event) => event.stopPropagation()}
              onWheelCapture={(event) => event.stopPropagation()}
            />
          </label>
        ))}
      </div>

      <div className="canvas-skill-list" aria-label="Skill 开关">
        {skills.map((skill) => {
          const enabled = enabledSkillIds.includes(skill.id)
          return (
            <button
              key={skill.id}
              type="button"
              className={`canvas-skill-toggle ${enabled ? 'is-enabled' : ''}`}
              onClick={() => onToggleSkill(skill.id)}
              aria-pressed={enabled}
            >
              <span className="canvas-skill-toggle-switch" aria-hidden="true" />
              <span>
                <strong>{skill.name}</strong>
                <small>{skill.description}</small>
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" className="canvas-panel-primary is-full" onClick={onApply}>
        应用到当前项目
      </button>
    </section>
  )
}
