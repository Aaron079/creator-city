export type CreatorSkillCategory =
  | 'story'
  | 'visual'
  | 'color'
  | 'camera'
  | 'character'
  | 'scene'
  | 'continuity'

export type CreatorSkillTarget = 'text' | 'image' | 'video'

export type CreatorSkill = {
  id: string
  name: string
  category: CreatorSkillCategory
  description: string
  systemInstruction: string
  promptInstruction: string
  appliesTo: CreatorSkillTarget[]
  enabledByDefault: boolean
}

export type ProjectStyleBible = {
  logline?: string
  storyWorld?: string
  visualStyle?: string
  colorPalette?: string
  cameraLanguage?: string
  characterRules?: string
  sceneRules?: string
  negativeRules?: string
  referenceKeywords?: string[]
  updatedAt?: string
}
