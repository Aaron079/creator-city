'use client'

import { useState, useCallback, useRef, useEffect, WheelEvent, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CanvasProvider, DEFAULT_NODES, DEFAULT_EDGES } from '@/components/canvas/CanvasProvider'
import { AudioDesk } from '@/components/audio/AudioDesk'
import { DeliveryTab } from '@/components/delivery/DeliveryTab'
import { EditorAdapterPanel } from '@/components/editor/EditorAdapterPanel'
import { RoleViewSwitcher } from '@/components/roles/RoleViewSwitcher'
import { StoryboardAdapterPanel } from '@/components/storyboard/StoryboardAdapterPanel'
import { useCanvasStore } from '@/store/canvas.store'
import { useShotsStore } from '@/store/shots.store'
import type { CastingSuggestion, CharacterBible, ClipReview, EditorClip, EditorTimeline, EditSuggestion, InsightContext, Narrative, NarrativeInsight, NarrativeType, RoleBible, SequenceSuggestion, Shot, ShotDerivativeJob, ShotSuggestion, ShotSnapshot, StoryboardFrame, StoryboardPrevis, StyleBible, SuggestionContext } from '@/store/shots.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import type { DirectorNote, DirectorNoteCategory, DirectorNotePriority, DirectorNoteStatus, DirectorNoteTargetType } from '@/store/director-notes.store'
import { useApprovalStore } from '@/store/approval.store'
import type { ApprovalDecision, ApprovalRequest, ApprovalRole, ApprovalTargetType } from '@/store/approval.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import type { DeliveryAsset, DeliveryPackage } from '@/store/delivery-package.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import type { VersionChangeType, VersionedEntityType } from '@/store/version-history.store'
import { useAudioDeskStore } from '@/store/audio-desk.store'
import type { AudioSyncReview, AudioTimelineClip, AudioTrack, CueSheet, DialogueLine, LipSyncJob, MusicCue, MusicMotif, SoundEffectCue, VoiceTake } from '@/store/audio-desk.store'
import { createDefaultAudioTimeline } from '@/store/audio-desk.store'
import type { ProParams, GlobalPro } from '@/lib/ai/prompts'
import { DEFAULT_GLOBAL_PRO } from '@/lib/ai/prompts'
import { PROJECT_TEMPLATES, PROJECT_TEMPLATE_MAP, TEMPLATES } from '@/lib/templates'
import { computeScoreSystem } from '@/lib/score/scoreSystem'
import { downloadStoryboard, downloadPromptPack, downloadProjectExport, extractShotData } from '@/lib/export'
import { runDirector, directorShotsToResetDefs, generateTasksFromIdea } from '@/lib/ai/director'
import type { DirectorShot, DirectorTask } from '@/lib/ai/director'
import { generateCrew, findReplacement } from '@/lib/ai/crew'
import type { CrewMember } from '@/lib/ai/crew'
import { runProjectPipeline, PIPELINE_STEPS } from '@/lib/ai/orchestrator'
import type { PipelinePhase } from '@/lib/ai/orchestrator'
import { generatePrice } from '@/lib/ai/pricing'
import type { PricingResult, QualityLevel } from '@/lib/ai/pricing'
import { CREATORS } from '@/lib/data/creators'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useOrderStore } from '@/store/order.store'
import { useJobsStore } from '@/store/jobs.store'
import { useRelationshipStore } from '@/store/relationship.store'
import { analyzeCommercial, commercialToShotDefs } from '@/lib/ai/commercial'
import type { CanvasNode } from '@/store/canvas.store'
import { useFeedStore } from '@/store/feed.store'
import { useAuthStore } from '@/store/auth.store'
import { recordDirectorSession } from '@/lib/data/directorData'
import { useStyleStore, BUILTIN_STYLES } from '@/lib/style/styleStore'
import { buildCameraLensSuggestions, CAMERA_SIGNATURES, LENS_SIGNATURES } from '@/lib/camera/signatures'
import { buildCinematicSkillSuggestions } from '@/lib/cinematic/registry'
import { analyzeRhythmContext, buildRhythmContext } from '@/lib/score/rhythmEngine'
import { buildProductionDecision, type ProductionDecision } from '@/lib/score/productionIntelligence'
import { buildClipReview } from '@/lib/score/clipReview'
import { buildStageReadiness, type StageReadiness } from '@/lib/score/stageReadiness'
import { generateStoryboardPrevis, regenerateStoryboardFrame } from '@/lib/storyboard/previs'
import { buildCastingSuggestions } from '@/lib/casting/casting'
import { analyzeAudioTimelineIssues, buildAudioSyncReview, buildCueSheet, buildMusicMotifs, createAudioTimelineClip, createMockLipSyncJob, generateMockMusicCues, generateMockSoundEffects, generateMockVoiceTakes } from '@/lib/audio/mock'
import { buildDeliveryAssets } from '@/lib/delivery/aggregate'
import { buildDeliveryProjectData, buildDeliverySummaryText } from '@/lib/delivery/export'
import { getVisibleSectionsForRole, useMockRoleMode } from '@/lib/roles/view-mode'
import {
  SHOT_FRAMES, ANGLES, MOVEMENT_GROUPS,
  FOCAL_LENGTHS, FOCAL_LENS_CHARS, APERTURES, SPEEDS,
  LIGHTING_TYPES, LIGHTING_POSITIONS, COLOR_LUTS,
  CAMERA_PRESETS, DEFAULT_CAMERA_PARAMS,
} from '@/lib/camera'

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLES      = ['商业广告', '电影感', '短剧', '纪录片', 'MV', '品牌故事']
const TEXT_MODELS  = ['claude', 'gpt-4o']
const IMAGE_MODELS = ['mock', 'nano-banana-2', 'nano-banana-pro', 'dall-e-3', 'flux-dev', 'sdxl', 'midjourney']
const VIDEO_MODELS = ['mock', 'runway', 'seedance', 'happyhorse', 'kling', 'pika', 'luma']
const GLOBAL_IMAGE_MODELS = ['nano-banana-2', 'nano-banana-pro', 'dall-e-3', 'flux-dev', 'sdxl', 'midjourney', 'mock']
const GLOBAL_VIDEO_MODELS = ['runway', 'seedance', 'happyhorse', 'kling', 'pika', 'luma', 'mock']
const DURATIONS   = ['5s', '10s', '15s']
const PREVIS_FRAME_COUNTS = [6, 8, 10] as const
const PREVIS_FRAME_STYLES = ['comic', 'storyboard', 'cinematic'] as const
const PREVIS_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const

const CATEGORY_COLORS: Record<string, string> = {
  ad: '#6366f1', film: '#f43f5e', short: '#f59e0b', mv: '#8b5cf6',
}

const DEFAULT_PRO: ProParams = {
  // legacy
  shotType: 'medium', colorGrade: 'cinematic', lighting: 'soft',
  // camera
  ...DEFAULT_CAMERA_PARAMS,
  // models
  textModel: 'claude', imageModel: 'mock', videoModel: 'mock',
  duration: '5s', aiStrength: 60,
}

const SHOT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle:     { label: '待开始', color: 'rgba(255,255,255,0.3)' },
  inprogress: { label: '制作中', color: '#a5b4fc' },
  done:     { label: '已完成', color: '#34d399' },
}

type CanvasMode = 'simple' | 'advanced' | 'pro'
type WorkspaceView = 'canvas' | 'previs' | 'footage' | 'editor' | 'audio' | 'delivery'

const DERIVATIVE_PROVIDERS = ['mock', 'runway', 'seedance', 'happyhorse', 'kling'] as const
const DERIVATIVE_DURATIONS = [5, 10, 15] as const
const EDITOR_PACING_GOALS = ['commercial-fast', 'cinematic-slow', 'emotional-wave', 'documentary-natural'] as const
const CLIP_TRANSITIONS = ['cut', 'fade', 'dissolve', 'match-cut', 'jump-cut'] as const
const CLIP_PACING = ['slow', 'medium', 'fast'] as const

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const CANVAS_MODE_META: Record<CanvasMode, { label: string; hint: string }> = {
  simple: { label: 'Simple', hint: '最干净的创作视图，只保留必要操作。' },
  advanced: { label: 'Advanced', hint: '增加更多建议信息与浮层内容。' },
  pro: { label: 'Pro', hint: '为导演、摄影、制片提供更完整的控制密度。' },
}

const SHOT_INTENTS = ['建立环境', '推进情绪', '强调角色', '制造冲突', '品牌展示', '产品特写'] as const

const NARRATIVE_TYPE_OPTIONS: Array<{ value: NarrativeType; label: string }> = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'story', label: 'Story' },
  { value: 'product', label: 'Product' },
  { value: 'cinematic', label: 'Cinematic' },
]

function summarizeSuggestionParams(presetParams: Partial<ProParams>) {
  return [
    { label: '景别', value: presetParams.framing ?? 'MS' },
    { label: '运镜', value: presetParams.movement ?? 'Static' },
    { label: '灯光', value: presetParams.lightingType ?? 'Natural' },
    { label: 'LUT', value: presetParams.colorLUT ?? 'Rec.709' },
    { label: '焦距', value: `${presetParams.focalLength ?? DEFAULT_CAMERA_PARAMS.focalLength}mm` },
  ]
}

function buildCompareFields(originalShot: ShotSnapshot, suggestedShot: ShotSnapshot) {
  const originalParams = originalShot.presetParams ?? {}
  const suggestedParams = suggestedShot.presetParams ?? {}

  return [
    { label: '镜头类型', original: originalParams.shotType ?? originalParams.framing ?? 'medium', suggested: suggestedParams.shotType ?? suggestedParams.framing ?? 'medium' },
    { label: '角度', original: originalParams.angle ?? 'Eye Level', suggested: suggestedParams.angle ?? 'Eye Level' },
    { label: '运动', original: originalParams.movement ?? 'Static', suggested: suggestedParams.movement ?? 'Static' },
    { label: '焦距', original: `${originalParams.focalLength ?? DEFAULT_CAMERA_PARAMS.focalLength}mm`, suggested: `${suggestedParams.focalLength ?? DEFAULT_CAMERA_PARAMS.focalLength}mm` },
    { label: '光线', original: originalParams.lightingType ?? 'Natural', suggested: suggestedParams.lightingType ?? 'Natural' },
    { label: '色彩', original: originalParams.colorLUT ?? 'Rec.709', suggested: suggestedParams.colorLUT ?? 'Rec.709' },
    { label: '风格', original: originalShot.style || '商业广告', suggested: suggestedShot.style || '商业广告' },
    { label: '摄影机', original: [originalShot.cameraBrand, originalShot.cameraModel].filter(Boolean).join(' ') || '未指定', suggested: [suggestedShot.cameraBrand, suggestedShot.cameraModel].filter(Boolean).join(' ') || '未指定' },
    { label: '镜头组', original: [originalShot.lensBrand, originalShot.lensModel].filter(Boolean).join(' ') || '未指定', suggested: [suggestedShot.lensBrand, suggestedShot.lensModel].filter(Boolean).join(' ') || '未指定' },
  ].map((field) => ({
    ...field,
    changed: field.original !== field.suggested,
  }))
}

function makeShotSnapshot(shot: Shot, fallbackPro: Partial<ProParams>): ShotSnapshot {
  return {
    idea: shot.idea,
    style: shot.style,
    intent: shot.intent,
    presetParams: { ...fallbackPro, ...shot.presetParams },
    cameraBrand: shot.cameraBrand,
    cameraModel: shot.cameraModel,
    lensBrand: shot.lensBrand,
    lensModel: shot.lensModel,
  }
}

function buildSequenceSuggestions(context: SuggestionContext): SequenceSuggestion[] {
  const key = `${context.templateId ?? 'default'}:${context.sequenceName ?? 'generic'}`

  const registry: Record<string, SequenceSuggestion[]> = {
    'commercial-ad:Hook': [
      {
        id: 'hook-impact',
        title: '强化开场冲击',
        reasoning: '商业广告的 Hook 需要在前 3 秒建立品牌记忆点，建议更快把视觉重心推到主体。',
        params: { framing: 'CU', movement: 'Push In', lightingType: 'Softbox', colorLUT: 'Cinematic', focalLength: 50 },
        intent: '建立环境',
        fitsSequence: '适合 Hook 段落快速建立注意力。',
        expectedEffect: '更快建立品牌印象，让观众停留。',
      },
      {
        id: 'hook-graphic',
        title: '更强图形化开场',
        reasoning: '用更干净的构图和利落的镜头语言，可以让广告开场更专业、更有商业质感。',
        params: { framing: 'MS', movement: 'Static', lightingType: 'Backlight', colorLUT: 'Rec.709', focalLength: 35 },
        intent: '品牌展示',
        fitsSequence: '适合需要突出品牌世界观的 Hook。',
        expectedEffect: '让开场更利落，信息识别更清晰。',
      },
    ],
    'commercial-ad:Solution': [
      {
        id: 'highlight-detail',
        title: '突出卖点细节',
        reasoning: 'Solution 段落更适合把功能亮点拆开给观众看，建议提高特写密度。',
        params: { framing: 'ECU', movement: 'Static', lightingType: 'Softbox', colorLUT: 'Rec.709', focalLength: 85 },
        intent: '产品特写',
        fitsSequence: '适合 Highlight / Solution 段落强调产品价值。',
        expectedEffect: '让卖点更可感知，提升说服力。',
      },
    ],
    'commercial-ad:CTA': [
      {
        id: 'cta-brand-lock',
        title: '强化品牌收束',
        reasoning: 'CTA 段落需要清晰收束，建议用更稳定的镜头和明确的品牌视觉结束。',
        params: { framing: 'WS', movement: 'Static', lightingType: 'Natural', colorLUT: 'Cinematic', focalLength: 35 },
        intent: '品牌展示',
        fitsSequence: '适合 CTA 段落做品牌锁定与行动引导。',
        expectedEffect: '提高记忆点，让收尾更完整。',
      },
    ],
    'brand-story:Opening': [
      {
        id: 'opening-atmosphere',
        title: '先建立情绪语境',
        reasoning: '品牌故事的 Opening 不需要过早解释信息，先把氛围和人物状态建立起来更有效。',
        params: { framing: 'WS', movement: 'Dolly', lightingType: 'Natural', colorLUT: 'Teal & Orange', focalLength: 35 },
        intent: '建立环境',
        fitsSequence: '适合 Opening 段落营造气氛。',
        expectedEffect: '让观众先进入品牌情绪世界。',
      },
    ],
    'brand-story:Resolution': [
      {
        id: 'resolution-emotion',
        title: '把转机落到人物情绪',
        reasoning: '品牌故事的 Resolution 更适合用人物反应完成情绪兑现，而不是单纯信息说明。',
        params: { framing: 'CU', movement: 'Push In', lightingType: 'Backlight', colorLUT: 'Cinematic', focalLength: 50 },
        intent: '推进情绪',
        fitsSequence: '适合 Resolution 段落做情绪收束。',
        expectedEffect: '增强人物共鸣，让品牌价值更自然落地。',
      },
    ],
    'product-showcase:Attention': [
      {
        id: 'reveal-hero',
        title: '用英雄镜头做揭示',
        reasoning: '产品展示的开段更适合先完成“Reveal”，让观众立刻知道主角是什么。',
        params: { framing: 'MS', movement: 'Push In', lightingType: 'Softbox', colorLUT: 'Rec.709', focalLength: 50 },
        intent: '建立环境',
        fitsSequence: '适合 Reveal / Attention 段落建立产品存在感。',
        expectedEffect: '让产品更快成为画面核心。',
      },
    ],
    'product-showcase:Feature': [
      {
        id: 'feature-detail',
        title: '拆分功能特写',
        reasoning: 'Feature 段落最好把一个卖点讲清楚，再进入下一个点，避免信息拥挤。',
        params: { framing: 'ECU', movement: 'Static', lightingType: 'Softbox', colorLUT: 'Rec.709', focalLength: 85 },
        intent: '产品特写',
        fitsSequence: '适合 Feature 段落突出细节。',
        expectedEffect: '提升功能理解度，让卖点更具说服力。',
      },
    ],
    'product-showcase:CTA': [
      {
        id: 'product-cta',
        title: '把购买动作收得更明确',
        reasoning: 'CTA 阶段建议回到稳定构图和清晰信息层级，让转化动作更明确。',
        params: { framing: 'WS', movement: 'Static', lightingType: 'Natural', colorLUT: 'Cinematic', focalLength: 35 },
        intent: '品牌展示',
        fitsSequence: '适合 CTA 段落收束品牌与行动提示。',
        expectedEffect: '更明确地驱动下一步行动。',
      },
    ],
    'cinematic-short:Establish': [
      {
        id: 'establish-breathing',
        title: '给空间更多呼吸感',
        reasoning: '电影感短片的 Establishing 段落需要先让观众感受到空间和时间，而不是急着推进信息。',
        params: { framing: 'EWS', movement: 'Dolly', lightingType: 'Natural', colorLUT: 'Teal & Orange', focalLength: 24 },
        intent: '建立环境',
        fitsSequence: '适合 Establishing 段落建立氛围与空间。',
        expectedEffect: '提升沉浸感，让短片语气更完整。',
      },
    ],
    'cinematic-short:Shift': [
      {
        id: 'emotional-shift',
        title: '让情绪转折更明显',
        reasoning: 'Emotional Shift 需要比前一段更靠近人物或更不稳定的运动，观众才会感到变化。',
        params: { framing: 'MCU', movement: 'Handheld', lightingType: 'Backlight', colorLUT: 'High Contrast', focalLength: 50 },
        intent: '制造冲突',
        fitsSequence: '适合 Emotional Shift 段落制造转折。',
        expectedEffect: '让情绪变化更可感知。',
      },
    ],
    'cinematic-short:Resolve': [
      {
        id: 'ending-beat',
        title: '留下一个余韵结尾',
        reasoning: 'Ending Beat 更适合减少信息量，用一个更稳、更克制的镜头完成收束。',
        params: { framing: 'WS', movement: 'Static', lightingType: 'Natural', colorLUT: 'Cinematic', focalLength: 35 },
        intent: '推进情绪',
        fitsSequence: '适合 Ending Beat 段落完成收束。',
        expectedEffect: '结尾更有余韵，导演感更强。',
      },
    ],
  }

  const exact = registry[key]
  if (exact) return exact

  return [
    {
      id: 'generic-clarity',
      title: '提高镜头表达清晰度',
      reasoning: '结合当前 sequence 目标，建议收束镜头重点，让观众更快读懂这一段的任务。',
      params: { framing: 'MS', movement: 'Static', lightingType: 'Natural', colorLUT: 'Rec.709', focalLength: 35 },
      intent: context.existingShots[0]?.intent ?? '推进情绪',
      fitsSequence: `适合 ${context.sequenceName ?? '当前段落'} 的叙事目标。`,
      expectedEffect: '让段落表达更清晰，结构更稳定。',
    },
  ]
}

function buildMockSuggestionShots(shot: Shot, basePro: ProParams, context: SuggestionContext): ShotSuggestion[] {
  const originalShot = makeShotSnapshot(shot, basePro)
  const presets = buildSequenceSuggestions(context)

  return presets.map((preset, index) => {
    const nextStyle = context.recommendedStyle || (index === 1 ? '电影感' : shot.style || '商业广告')
    const presetParams = { ...basePro, ...shot.presetParams, ...preset.params }

    return {
      id: `suggestion-${shot.id}-${preset.id}`,
      kind: 'creative',
      shotId: shot.id,
      shotLabel: shot.label,
      title: preset.title,
      intent: preset.intent,
      styleNote: `建议贴合 ${context.sequenceName ?? '当前段落'} 的目标，并优先保持 ${context.recommendedStyle ?? nextStyle} 的视觉方向。`,
      reasoning: preset.reasoning,
      params: preset.params,
      fitsSequence: preset.fitsSequence,
      expectedEffect: preset.expectedEffect,
      context,
      originalShot,
      suggestedShot: {
        idea: shot.idea
          ? `${shot.idea}（AI建议：突出${preset.title}方向）`
          : `围绕 ${preset.title} 方向重组这个镜头的表达`,
        style: nextStyle,
        intent: preset.intent,
        presetParams,
        cameraBrand: shot.cameraBrand,
        cameraModel: shot.cameraModel,
        lensBrand: shot.lensBrand,
        lensModel: shot.lensModel,
      },
    }
  })
}

function buildInsightContext(args: {
  narrative: Narrative | null
  shots: Shot[]
}): InsightContext {
  const { narrative, shots } = args
  const projectTemplate = narrative?.templateId ? PROJECT_TEMPLATE_MAP[narrative.templateId] : undefined

  return {
    templateId: narrative?.templateId,
    templateCategory: projectTemplate?.category,
    narrativeType: narrative?.type,
    sequences: (narrative?.sequences ?? []).map((sequence) => ({
      id: sequence.id,
      name: sequence.name,
      goal: sequence.goal,
      suggestedIntent: sequence.suggestedIntent,
      shotCount: shots.filter((shot) => shot.sequenceId === sequence.id).length,
    })),
    shots: shots.map((shot) => ({
      id: shot.id,
      sequenceId: shot.sequenceId,
      label: shot.label,
      idea: shot.idea,
      style: shot.style,
      intent: shot.intent,
      presetParams: shot.presetParams,
    })),
    recommendedStyle: projectTemplate?.recommendedStyle,
    recommendedPacing: projectTemplate?.recommendedPacing,
  }
}

function buildNarrativeInsights(context: InsightContext): NarrativeInsight[] {
  const insights: NarrativeInsight[] = []
  const framings = context.shots.map((shot) => shot.presetParams?.framing ?? 'MS')
  const repeatedMedium = framings.filter((framing) => framing === 'MS').length >= 3
  const missingIntentShot = context.shots.find((shot) => !shot.intent?.trim())
  const dominantStyle = context.shots[0]?.style

  context.sequences.forEach((sequence) => {
    if (sequence.shotCount === 0) {
      insights.push({
        id: `insight-missing-${sequence.id}`,
        level: 'strong',
        type: 'missing-sequence',
        title: `${sequence.name} 段落缺失`,
        message: `当前模板预期包含 ${sequence.name}，但这段还没有镜头，结构会显得不完整。`,
        targetSequenceId: sequence.id,
        suggestedAction: { label: '聚焦段落', kind: 'focus-sequence' },
      })
      return
    }

    if (sequence.shotCount === 1) {
      insights.push({
        id: `insight-weak-${sequence.id}`,
        level: 'warning',
        type: 'weak-sequence',
        title: `${sequence.name} 段落偏弱`,
        message: `${sequence.name} 当前只有 1 个镜头，${sequence.goal} 的表达可能还不够成立。`,
        targetSequenceId: sequence.id,
        suggestedAction: { label: '聚焦段落', kind: 'focus-sequence' },
      })
    }
  })

  if (repeatedMedium) {
    insights.push({
      id: 'insight-rhythm',
      level: 'warning',
      type: 'rhythm-problem',
      title: '镜头节奏较单一',
      message: '当前有较多中景镜头连续出现，节奏层次偏平，建议用不同景别打破重复。',
      suggestedAction: { label: '打开建议', kind: 'open-suggestion', panel: 'ai' },
    })
  }

  if (missingIntentShot) {
    insights.push({
      id: `insight-intent-${missingIntentShot.id}`,
      level: 'strong',
      type: 'intent-missing',
      title: `${missingIntentShot.label} 缺少创作意图`,
      message: '这个镜头还没有明确它在叙事中承担什么作用，会影响 sequence 的整体表达。',
      targetShotId: missingIntentShot.id,
      suggestedAction: { label: '编辑意图', kind: 'focus-shot', panel: 'style' },
    })
  }

  if (context.recommendedStyle && dominantStyle && dominantStyle !== context.recommendedStyle) {
    insights.push({
      id: 'insight-style',
      level: 'info',
      type: 'style-mismatch',
      title: '当前风格与模板推荐不完全一致',
      message: `模板更推荐 ${context.recommendedStyle}，但当前镜头主风格更接近 ${dominantStyle}，可能会削弱整体统一性。`,
      suggestedAction: { label: '打开建议', kind: 'open-suggestion', panel: 'ai' },
    })
  }

  return insights
}

function buildRhythmNarrativeInsights(args: {
  narrative: Narrative | null
  shots: Shot[]
  projectTemplate?: typeof PROJECT_TEMPLATES[number]
}): NarrativeInsight[] {
  const rhythmInsights = analyzeRhythmContext(buildRhythmContext(args))

  return rhythmInsights.map((insight) => ({
    id: insight.id,
    level: insight.level,
    type: insight.type,
    title: insight.title,
    message: insight.message,
    targetSequenceId: insight.targetSequenceId,
    targetShotId: insight.targetShotId,
    suggestedAction: insight.suggestedAction,
  }))
}

function buildSuggestionContext(args: {
  shot: Shot
  shots: Shot[]
  narrative: Narrative | null
}) : SuggestionContext {
  const { shot, shots, narrative } = args
  const sequence = narrative?.sequences.find((item) => item.id === shot.sequenceId)
  const projectTemplate = narrative?.templateId ? PROJECT_TEMPLATE_MAP[narrative.templateId] : undefined
  const sequenceShots = shots
    .filter((item) => item.sequenceId === shot.sequenceId)
    .map((item) => ({ id: item.id, label: item.label, idea: item.idea, intent: item.intent }))

  return {
    templateId: projectTemplate?.id ?? narrative?.templateId,
    templateCategory: projectTemplate?.category,
    narrativeType: narrative?.type,
    sequenceId: sequence?.id ?? shot.sequenceId,
    sequenceName: sequence?.name,
    sequenceGoal: sequence?.goal,
    recommendedStyle: projectTemplate?.recommendedStyle,
    recommendedPacing: projectTemplate?.recommendedPacing,
    existingShots: sequenceShots,
  }
}

function summarizeTargetNotes(notes: DirectorNote[], targetType: DirectorNoteTargetType, targetId: string): NoteBadgeSummary {
  const active = notes.filter((note) => note.targetType === targetType && note.targetId === targetId && (note.status === 'open' || note.status === 'in-progress'))
  return {
    total: active.length,
    blockers: active.filter((note) => note.priority === 'blocker').length,
  }
}

function buildNotesAiSummary(notes: DirectorNote[]) {
  const unresolved = notes.filter((note) => note.status === 'open' || note.status === 'in-progress')
  const blockers = unresolved.filter((note) => note.priority === 'blocker')
  const categoryWeight = new Map<DirectorNoteCategory, number>()
  unresolved.forEach((note) => {
    categoryWeight.set(note.category, (categoryWeight.get(note.category) ?? 0) + (note.priority === 'blocker' ? 3 : note.priority === 'high' ? 2 : 1))
  })
  const sortedCategories = [...categoryWeight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([category]) => category)
  const summary = sortedCategories.length > 0
    ? `建议优先处理${sortedCategories.join('和')}问题。`
    : '当前批注分布较均衡，建议优先清掉 blocker 和高优先级项。'

  return {
    unresolvedCount: unresolved.length,
    blockerCount: blockers.length,
    summary,
  }
}

function pickChangedFields(snapshot: Record<string, unknown>, previous?: Record<string, unknown>) {
  if (!previous) return Object.keys(snapshot)
  return Array.from(new Set([...Object.keys(snapshot), ...Object.keys(previous)])).filter((key) => JSON.stringify(snapshot[key]) !== JSON.stringify(previous[key]))
}

function snapshotShot(shot: Shot) {
  return {
    idea: shot.idea,
    style: shot.style,
    intent: shot.intent,
    presetParams: shot.presetParams,
    cinematicSkillIds: shot.cinematicSkillIds,
    cameraBrand: shot.cameraBrand,
    cameraModel: shot.cameraModel,
    lensBrand: shot.lensBrand,
    lensModel: shot.lensModel,
  }
}

function snapshotStoryboardFrame(frame: StoryboardFrame) {
  return {
    timecode: frame.timecode,
    description: frame.description,
    intent: frame.intent,
    shotType: frame.shotType,
    angle: frame.angle,
    movement: frame.movement,
    focalLength: frame.focalLength,
    lighting: frame.lighting,
    colorGrade: frame.colorGrade,
    imagePrompt: frame.imagePrompt,
    imageUrl: frame.imageUrl,
    status: frame.status,
    roleBibleId: frame.roleBibleId,
    consistencyKey: frame.consistencyKey,
  }
}

function snapshotSequence(sequence: Narrative['sequences'][number]) {
  return {
    name: sequence.name,
    goal: sequence.goal,
    suggestedIntent: sequence.suggestedIntent,
    cinematicSkillIds: sequence.cinematicSkillIds,
    shotIds: sequence.shotIds,
  }
}

function snapshotVideoShot(job: ShotDerivativeJob) {
  return {
    videoPrompt: job.videoPrompt,
    provider: job.provider,
    duration: job.duration,
    movement: job.movement,
    motionStrength: job.motionStrength,
    status: job.status,
    roleBibleId: job.roleBibleId,
    consistencyKey: job.consistencyKey,
  }
}

function snapshotEditorClip(clip: EditorClip) {
  return {
    title: clip.title,
    description: clip.description,
    order: clip.order,
    duration: clip.duration,
    transition: clip.transition,
    pacing: clip.pacing,
    note: clip.note,
    cinematicSkillIds: clip.cinematicSkillIds,
  }
}

function snapshotRoleBible(role: RoleBible) {
  return {
    name: role.name,
    roleType: role.roleType,
    personality: role.personality,
    motivation: role.motivation,
    emotionalArc: role.emotionalArc,
    appearance: role.appearance,
    performanceStyle: role.performanceStyle,
    consistencyKey: role.consistencyKey,
    referenceImageUrl: role.referenceImageUrl,
    status: role.status,
  }
}

function snapshotEditorTimeline(timeline: EditorTimeline) {
  return {
    pacingGoal: timeline.pacingGoal,
    musicDirection: timeline.musicDirection,
    status: timeline.status,
    clips: timeline.clips.map((clip) => ({
      id: clip.id,
      order: clip.order,
      title: clip.title,
      transition: clip.transition,
      pacing: clip.pacing,
      videoUrl: clip.videoUrl,
    })),
  }
}

function snapshotProjectBrief(input: {
  idea: string
  narrative: Narrative | null
  currentStage: string
  templateName?: string
}) {
  return {
    idea: input.idea,
    narrativeType: input.narrative?.type,
    structure: input.narrative?.structure,
    sequenceCount: input.narrative?.sequences.length ?? 0,
    currentStage: input.currentStage,
    templateName: input.templateName,
  }
}

function snapshotDelivery(input: {
  teamId?: string
  orderId?: string
  jobId?: string
  currentStage: string
  editorTimeline: EditorTimeline
  deliveryPackage?: DeliveryPackage | null
}) {
  const includedAssetCount = input.deliveryPackage?.assets.filter((asset) => asset.included).length ?? 0
  const strongRiskCount = input.deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0
  return {
    teamId: input.teamId,
    orderId: input.orderId,
    jobId: input.jobId,
    currentStage: input.currentStage,
    timelineClipCount: input.editorTimeline.clips.length,
    timelineStatus: input.editorTimeline.status,
    packageId: input.deliveryPackage?.id,
    packageStatus: input.deliveryPackage?.status,
    includedAssetCount,
    strongRiskCount,
    finalVersion: input.deliveryPackage?.manifest?.finalVersion,
  }
}

function snapshotDirectorNote(note: DirectorNote) {
  return {
    category: note.category,
    priority: note.priority,
    status: note.status,
    content: note.content,
    assignedTo: note.assignedTo,
    replies: note.replies,
  }
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function ChipSelect({ label, options, value, onChange, compact = false }: {
  label: string; options: string[]; value: string
  onChange: (v: string) => void; compact?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="transition-all"
            style={{
              padding:    compact ? '2px 7px' : '3px 9px',
              borderRadius: 6,
              fontSize:   10,
              background: value === opt ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.04)',
              border:     value === opt ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(255,255,255,0.07)',
              color:      value === opt ? '#a5b4fc' : 'rgba(255,255,255,0.38)',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({ imageModel, videoModel, onImageModel, onVideoModel }: {
  imageModel: string; videoModel: string
  onImageModel: (v: string) => void; onVideoModel: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>模型</span>
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>图像</span>
          <select
            value={imageModel}
            onChange={(e) => onImageModel(e.target.value)}
            className="w-full text-[10px] rounded-md px-2 py-1 outline-none"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
          >
            {IMAGE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>视频</span>
          <select
            value={videoModel}
            onChange={(e) => onVideoModel(e.target.value)}
            className="w-full text-[10px] rounded-md px-2 py-1 outline-none"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}
          >
            {VIDEO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function ComparePanel({
  suggestion,
  onApply,
  onClose,
  canvasMode,
}: {
  suggestion: ShotSuggestion
  onApply: (id: string) => void
  onClose: () => void
  canvasMode: CanvasMode
}) {
  const compareFields = (
    suggestion.compareFields?.length
      ? suggestion.compareFields.map((field) => ({ ...field, changed: field.original !== field.suggested }))
      : buildCompareFields(suggestion.originalShot, suggestion.suggestedShot)
  )
  const visibleFields = canvasMode === 'simple'
    ? compareFields.filter((field) => field.changed)
    : compareFields
  const changedCount = compareFields.filter((field) => field.changed).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="rounded-2xl p-4"
      style={{ background: 'rgba(4,10,18,0.68)', border: '1px solid rgba(110,231,183,0.18)', boxShadow: '0 18px 40px rgba(0,0,0,0.24)' }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[12px] font-semibold text-white/85">Compare Panel</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            对比原始镜头与 AI 建议，重点看哪些字段发生了变化。
          </p>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(199,210,254,0.7)' }}>
            共 {changedCount} 项字段变化
          </p>
          <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(167,243,208,0.82)' }}>
            Why: {suggestion.reasoning}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onApply(suggestion.id)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            应用建议
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            保持原始版本
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>原始镜头</p>
          <p className="text-[10px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
            {suggestion.originalShot.idea || '暂无镜头描述'}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.14)' }}>
          <p className="text-[10px] font-semibold mb-2" style={{ color: '#6ee7b7' }}>AI 建议</p>
          <p className="text-[10px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {suggestion.suggestedShot.idea || '暂无建议描述'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="grid grid-cols-[120px_1fr_1fr] px-3 py-2 text-[9px] uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.26)' }}>
          <span>字段</span>
          <span>原始</span>
          <span>AI建议</span>
        </div>
        {visibleFields.map((field) => (
          <div
            key={field.label}
            className="grid grid-cols-[120px_1fr_1fr] gap-2 px-3 py-2.5 text-[10px]"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: field.changed ? 'rgba(99,102,241,0.05)' : 'transparent',
            }}
          >
            <span style={{ color: field.changed ? '#c7d2fe' : 'rgba(255,255,255,0.38)', fontWeight: field.changed ? 700 : 500 }}>
              {field.label}
            </span>
            <span
              className="rounded-lg px-2 py-1"
              style={{
                background: field.changed ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: 'rgba(255,255,255,0.56)',
                border: field.changed ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
              }}
            >
              {field.original}
            </span>
            <span
              className="rounded-lg px-2 py-1"
              style={{
                background: field.changed ? 'rgba(16,185,129,0.10)' : 'transparent',
                color: field.changed ? '#a7f3d0' : 'rgba(255,255,255,0.56)',
                border: field.changed ? '1px solid rgba(16,185,129,0.18)' : '1px solid transparent',
              }}
            >
              {field.suggested}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg text-[10px]"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.46)' }}
        >
          关闭
        </button>
      </div>
    </motion.div>
  )
}

const INSIGHT_LEVEL_META: Record<NarrativeInsight['level'], { label: string; accent: string }> = {
  info: { label: 'Info', accent: '#93c5fd' },
  warning: { label: 'Warning', accent: '#fbbf24' },
  strong: { label: 'Strong', accent: '#fda4af' },
}

const SEQUENCE_STATUS_META = {
  ok: { label: 'OK', background: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.24)', color: '#a7f3d0' },
  weak: { label: 'Weak', background: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.24)', color: '#fde68a' },
  missing: { label: 'Missing', background: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.24)', color: '#fda4af' },
} as const

const OWNER_META: Record<ProductionDecision['ownerSuggestion'], { label: string; color: string; background: string }> = {
  director: { label: 'Director', color: '#c7d2fe', background: 'rgba(99,102,241,0.12)' },
  cinematographer: { label: 'Cinematographer', color: '#bae6fd', background: 'rgba(14,165,233,0.12)' },
  editor: { label: 'Editor', color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  ai: { label: 'AI', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
}

const STAGE_STATUS_META: Record<StageReadiness['status'], { label: string; color: string; background: string }> = {
  blocked: { label: 'Blocked', color: '#fda4af', background: 'rgba(244,63,94,0.12)' },
  'needs-review': { label: 'Needs Review', color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  ready: { label: 'Ready', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
}

const CLIP_REVIEW_STATUS_META: Record<ClipReview['status'], { label: string; color: string; background: string }> = {
  usable: { label: 'Usable', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
  'needs-adjustment': { label: 'Needs Adjustment', color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  'needs-regenerate': { label: 'Needs Regenerate', color: '#fdba74', background: 'rgba(249,115,22,0.12)' },
  'not-recommended': { label: 'Not Recommended', color: '#fda4af', background: 'rgba(244,63,94,0.12)' },
}

const CLIP_REVIEW_SEVERITY_META: Record<'info' | 'warning' | 'strong', { color: string; background: string }> = {
  info: { color: '#93c5fd', background: 'rgba(59,130,246,0.12)' },
  warning: { color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  strong: { color: '#fda4af', background: 'rgba(244,63,94,0.12)' },
}

const NOTE_CATEGORIES: DirectorNoteCategory[] = ['creative', 'camera', 'casting', 'lighting', 'color', 'rhythm', 'editing', 'continuity', 'client-feedback', 'production']
const NOTE_PRIORITIES: DirectorNotePriority[] = ['low', 'medium', 'high', 'blocker']

const NOTE_PRIORITY_META: Record<DirectorNotePriority, { color: string; background: string }> = {
  low: { color: 'rgba(255,255,255,0.56)', background: 'rgba(255,255,255,0.06)' },
  medium: { color: '#93c5fd', background: 'rgba(59,130,246,0.12)' },
  high: { color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  blocker: { color: '#fda4af', background: 'rgba(244,63,94,0.12)' },
}

const NOTE_STATUS_META: Record<DirectorNoteStatus, { color: string; background: string }> = {
  open: { color: '#c7d2fe', background: 'rgba(99,102,241,0.12)' },
  'in-progress': { color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  resolved: { color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
  dismissed: { color: 'rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.06)' },
}

type NoteBadgeSummary = { total: number; blockers: number }

type DirectorNoteDraft = {
  targetType: DirectorNoteTargetType
  targetId: string
  category?: DirectorNoteCategory
  priority?: DirectorNotePriority
  content?: string
  assignedTo?: string
}

type ApprovalTargetOption = {
  value: string
  label: string
  targetType: ApprovalTargetType
  targetId: string
}

type ApprovalBadgeSummary = {
  status: ApprovalRequest['status']
  pendingRoles: number
  requiredCount: number
}

const APPROVAL_ROLE_META: Record<ApprovalRole, { label: string; color: string; background: string }> = {
  director: { label: '导演', color: '#c7d2fe', background: 'rgba(99,102,241,0.12)' },
  client: { label: '客户', color: '#f9a8d4', background: 'rgba(236,72,153,0.12)' },
  producer: { label: '制片', color: '#bae6fd', background: 'rgba(14,165,233,0.12)' },
  editor: { label: '剪辑', color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  cinematographer: { label: '摄影', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
  creator: { label: '创作者', color: 'rgba(255,255,255,0.68)', background: 'rgba(255,255,255,0.06)' },
}

const APPROVAL_STATUS_META: Record<ApprovalRequest['status'], { label: string; color: string; background: string }> = {
  pending: { label: '待确认', color: '#c7d2fe', background: 'rgba(99,102,241,0.12)' },
  approved: { label: '已确认', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)' },
  'changes-requested': { label: '需修改', color: '#fde68a', background: 'rgba(251,191,36,0.12)' },
  rejected: { label: '已拒绝', color: '#fda4af', background: 'rgba(244,63,94,0.12)' },
  stale: { label: '已过期', color: '#fdba74', background: 'rgba(249,115,22,0.12)' },
}

function NoteBadge({ summary }: { summary?: NoteBadgeSummary }) {
  if (!summary || (summary.total === 0 && summary.blockers === 0)) return null
  return (
    <div className="flex items-center gap-1.5">
      {summary.total > 0 && (
        <span className="px-1.5 py-0.5 rounded-md text-[9px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.66)' }}>
          💬 {summary.total}
        </span>
      )}
      {summary.blockers > 0 && (
        <span className="px-1.5 py-0.5 rounded-md text-[9px]" style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af' }}>
          ⚠️ {summary.blockers}
        </span>
      )}
    </div>
  )
}

function ApprovalBadge({ summary }: { summary?: ApprovalBadgeSummary }) {
  if (!summary) return null
  const meta = APPROVAL_STATUS_META[summary.status]
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded-md text-[9px]" style={{ background: meta.background, color: meta.color }}>
        {meta.label}
      </span>
      {summary.pendingRoles > 0 && (
        <span className="px-1.5 py-0.5 rounded-md text-[9px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.56)' }}>
          剩余 {summary.pendingRoles}/{summary.requiredCount}
        </span>
      )}
    </div>
  )
}

function summarizeTargetApprovals(approvals: ApprovalRequest[], targetType: ApprovalTargetType, targetId: string): ApprovalBadgeSummary | undefined {
  const latest = approvals
    .filter((approval) => approval.targetType === targetType && approval.targetId === targetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  if (!latest) return undefined
  const effectiveRoles = latest.requiredRoles.filter((role) => latest.decisions.some((decision) => decision.role === role && decision.status === 'approved'))
  return {
    status: latest.status,
    pendingRoles: Math.max(0, latest.requiredRoles.length - effectiveRoles.length),
    requiredCount: latest.requiredRoles.length,
  }
}

function buildApprovalSummary(approvals: ApprovalRequest[]) {
  const unresolved = approvals.filter((approval) => approval.status === 'pending' || approval.status === 'stale' || approval.status === 'changes-requested')
  const clientChangeRequests = unresolved.filter((approval) => approval.decisions.some((decision) => decision.role === 'client' && decision.status === 'changes-requested'))
  return {
    unresolvedCount: unresolved.length,
    clientChangeRequestCount: clientChangeRequests.length,
    summary: unresolved.length === 0
      ? '当前确认流比较清爽，可以继续推进。'
      : `当前还有 ${unresolved.length} 个确认项待处理，其中 ${clientChangeRequests.length} 个为客户修改意见。`,
  }
}

function mapApprovalTargetToNoteCategory(targetType: ApprovalTargetType): DirectorNoteCategory {
  switch (targetType) {
    case 'role-bible':
      return 'casting'
    case 'storyboard-frame':
    case 'shot':
      return 'creative'
    case 'sequence':
    case 'editor-timeline':
    case 'editor-clip':
      return 'editing'
    case 'video-shot':
      return 'production'
    case 'delivery':
      return 'client-feedback'
    case 'project-brief':
      return 'production'
    default:
      return 'creative'
  }
}

function mapEntityTypeToApprovalTargetType(entityType: VersionedEntityType): ApprovalTargetType | null {
  switch (entityType) {
    case 'project-brief':
    case 'sequence':
    case 'shot':
    case 'storyboard-frame':
    case 'video-shot':
    case 'editor-clip':
    case 'role-bible':
    case 'editor-timeline':
    case 'delivery':
      return entityType
    default:
      return null
  }
}

function StageReadinessCard({
  stageReadiness,
  onViewIssues,
  onContinueRefining,
  onConfirmAdvance,
}: {
  stageReadiness: StageReadiness
  onViewIssues: () => void
  onContinueRefining: () => void
  onConfirmAdvance: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const statusMeta = STAGE_STATUS_META[stageReadiness.status]

  return (
    <div
      className="rounded-2xl px-4 py-3.5 mt-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>
            阶段检查
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <p className="text-[12px] font-semibold text-white/86">
              {stageReadiness.currentStage} → {stageReadiness.nextStage ?? 'completed'}
            </p>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: statusMeta.background, color: statusMeta.color }}>
              {statusMeta.label}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.44)' }}>
              Readiness {stageReadiness.score}
            </span>
          </div>
          <p className="text-[10px] mt-1.5 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.36)' }}>
            当前阶段只做可推进判断，是否进入下一阶段仍然由你确认。
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onViewIssues}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            查看问题
          </button>
          <button
            onClick={() => {
              setDetailsOpen(false)
              onContinueRefining()
            }}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            继续完善
          </button>
          <button
            onClick={onConfirmAdvance}
            disabled={!stageReadiness.nextStage || stageReadiness.status === 'blocked'}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)', color: '#a7f3d0' }}
          >
            确认进入下一阶段
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="grid gap-2 mt-3 md:grid-cols-2"
          >
            {stageReadiness.highlights?.map((highlight) => (
              <div key={highlight} className="rounded-xl px-3 py-2 md:col-span-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.14)' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#a7f3d0' }}>Ready Signal</p>
                <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.34)' }}>{highlight}</p>
              </div>
            ))}
            {stageReadiness.blockers.slice(0, 2).map((blocker) => (
              <div key={blocker.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.14)' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#fda4af' }}>{blocker.title}</p>
                <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.34)' }}>{blocker.message}</p>
              </div>
            ))}
            {stageReadiness.warnings.slice(0, 2).map((warning) => (
              <div key={warning.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.14)' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#fde68a' }}>{warning.title}</p>
                <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.34)' }}>{warning.message}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NextBestActionCard({
  productionDecision,
  onGoHandle,
}: {
  productionDecision: ProductionDecision
  onGoHandle: (decision: ProductionDecision) => void
}) {
  const [showReasons, setShowReasons] = useState(false)
  const owner = OWNER_META[productionDecision.ownerSuggestion]

  return (
    <div
      className="rounded-2xl px-4 py-3.5 mt-3"
      style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.16)' }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>
            下一步建议
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <p className="text-[13px] font-semibold text-white/88">{productionDecision.title}</p>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: owner.background, color: owner.color }}>
              {owner.label}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.44)' }}>
              Confidence {productionDecision.confidence}
            </span>
          </div>
          <p className="text-[10px] mt-1.5 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.36)' }}>
            {productionDecision.message}
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onGoHandle(productionDecision)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            去处理
          </button>
          <button
            onClick={() => setShowReasons((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            {showReasons ? '收起原因' : '查看原因'}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showReasons && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="grid gap-2 mt-3 md:grid-cols-3"
          >
            {productionDecision.reasons.map((reason, index) => (
              <div
                key={`${productionDecision.id}-${index}`}
                className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <p className="text-[9px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.36)' }}>
                  {reason}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function InsightPanel({
  insights,
  scoreSummary,
  onAction,
  onClose,
}: {
  insights: NarrativeInsight[]
  scoreSummary: ReturnType<typeof computeScoreSystem>
  onAction: (insight: NarrativeInsight) => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mx-5 mt-3 rounded-2xl p-4"
      style={{
        background: 'rgba(9,14,24,0.82)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 18px 46px rgba(0,0,0,0.24)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[12px] font-semibold text-white/85">Structure-aware Insights</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            AI 从模板、sequence 和镜头结构出发指出薄弱点，但不会替你做决定。
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.44)' }}
        >
          ✕
        </button>
      </div>

      <div
        className="rounded-2xl p-3.5 mb-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>当前创作评分</p>
            <p className="text-[24px] font-black mt-1 text-white/88">{scoreSummary.totalScore}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(14,165,233,0.12)', color: '#bae6fd' }}>
              结构 {scoreSummary.breakdown.structureCompletenessScore}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(168,85,247,0.12)', color: '#ddd6fe' }}>
              顺序 {scoreSummary.breakdown.structureOrderScore}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(99,102,241,0.12)', color: '#c7d2fe' }}>
              Narrative {scoreSummary.breakdown.narrativeScore}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(16,185,129,0.12)', color: '#a7f3d0' }}>
              Sequence {scoreSummary.breakdown.averageSequenceScore}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(251,191,36,0.12)', color: '#fde68a' }}>
              Rhythm {scoreSummary.breakdown.rhythmScore}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(244,63,94,0.1)', color: '#fda4af' }}>
              Ready {scoreSummary.breakdown.productionReadinessScore}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {scoreSummary.breakdown.structureAnalysis.sequenceChecks.slice(0, 6).map((check) => {
            const meta = SEQUENCE_STATUS_META[check.status]
            return (
              <span
                key={check.sequenceId}
                className="px-2 py-1 rounded-lg text-[9px]"
                style={{ background: meta.background, border: `1px solid ${meta.border}`, color: meta.color }}
              >
                {check.sequenceName} · {meta.label}
              </span>
            )
          })}
        </div>
        <div className="grid gap-2 mt-3 md:grid-cols-2">
          {scoreSummary.issues.slice(0, 2).map((issue) => (
            <div key={issue.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold text-white/78">{issue.title}</p>
              <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.32)' }}>{issue.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {insights.map((insight) => {
          const meta = INSIGHT_LEVEL_META[insight.level]
          return (
            <div
              key={insight.id}
              className="rounded-2xl px-3.5 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold"
                      style={{ background: `${meta.accent}14`, border: `1px solid ${meta.accent}30`, color: meta.accent }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
                      {insight.type}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-white/82">{insight.title}</p>
                  <p className="text-[10px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.36)' }}>
                    {insight.message}
                  </p>
                </div>
                <button
                  onClick={() => onAction(insight)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-semibold"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#c7d2fe' }}
                >
                  {insight.suggestedAction.label}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function TemplateSelectionPanel({
  activeTemplateId,
  onSelectTemplate,
}: {
  activeTemplateId: string | null
  onSelectTemplate: (id: string) => void
}) {
  return (
    <div className="px-5 pt-3">
      <div
        className="rounded-[24px] p-4"
        style={{
          background: 'rgba(9,14,24,0.76)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 18px 46px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="mb-4">
          <p className="text-[12px] font-semibold text-white/85">商业级模板系统</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            先选择一个专业模板，再自动生成 Narrative、Sequence 和初始创作意图。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROJECT_TEMPLATES.map((template) => {
            const active = activeTemplateId === template.id
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                className="rounded-[20px] p-4 text-left transition-all"
                style={{
                  background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: active ? '0 0 0 1px rgba(99,102,241,0.12) inset' : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: active ? '#c7d2fe' : 'rgba(255,255,255,0.82)' }}>
                      {template.icon} {template.name}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      {template.description}
                    </p>
                  </div>
                  {active && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#c7d2fe' }}>
                      已选中
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.48)' }}>
                    风格: {template.recommendedStyle}
                  </span>
                  <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.48)' }}>
                    节奏: {template.recommendedPacing}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {template.sequences.map((sequence) => (
                    <div
                      key={`${template.id}-${sequence.structureId}`}
                      className="rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.78)' }}>
                          {sequence.name}
                        </span>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {sequence.suggestedIntent}
                        </span>
                      </div>
                      <p className="text-[9px] mt-1 leading-[1.5]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                        {sequence.goal}
                      </p>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ScoreSummaryStrip({
  scoreSummary,
  canvasMode,
  productionDecision,
  onProductionAction,
  stageReadiness,
  onViewStageIssues,
  onContinueRefiningStage,
  onConfirmAdvanceStage,
}: {
  scoreSummary: ReturnType<typeof computeScoreSystem>
  canvasMode: CanvasMode
  productionDecision: ProductionDecision
  onProductionAction: (decision: ProductionDecision) => void
  stageReadiness: StageReadiness
  onViewStageIssues: () => void
  onContinueRefiningStage: () => void
  onConfirmAdvanceStage: () => void
}) {
  return (
    <div className="px-5 pt-3">
      <div
        className="rounded-[24px] px-4 py-3.5"
        style={{
          background: 'rgba(9,14,24,0.72)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 16px 42px rgba(0,0,0,0.16)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>Creator Score</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-[30px] font-black text-white/90">{scoreSummary.totalScore}</span>
              <span className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.32)' }}> / 100</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>
              当前作品的结构、镜头适配与生产就绪度的基础判断。
            </p>
          </div>

          <div className="flex gap-2 flex-wrap md:justify-end">
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(14,165,233,0.12)', color: '#bae6fd' }}>
              Structure {scoreSummary.breakdown.structureCompletenessScore}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(168,85,247,0.12)', color: '#ddd6fe' }}>
              Order {scoreSummary.breakdown.structureOrderScore}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(99,102,241,0.12)', color: '#c7d2fe' }}>
              Narrative {scoreSummary.breakdown.narrativeScore}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(16,185,129,0.12)', color: '#a7f3d0' }}>
              Sequence {scoreSummary.breakdown.averageSequenceScore}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(251,191,36,0.12)', color: '#fde68a' }}>
              Fit {scoreSummary.breakdown.averageShotFitScore}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(244,63,94,0.1)', color: '#fda4af' }}>
              Ready {scoreSummary.breakdown.productionReadinessScore}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {scoreSummary.breakdown.structureAnalysis.sequenceChecks
            .slice(0, canvasMode === 'simple' ? 4 : 8)
            .map((check) => {
              const meta = SEQUENCE_STATUS_META[check.status]
              return (
                <span
                  key={check.sequenceId}
                  className="px-2 py-1 rounded-lg text-[9px]"
                  style={{ background: meta.background, border: `1px solid ${meta.border}`, color: meta.color }}
                >
                  {check.sequenceName} · {meta.label}
                </span>
              )
            })}
        </div>

        <div className="grid gap-2 mt-3 md:grid-cols-2">
          {scoreSummary.issues.slice(0, canvasMode === 'simple' ? 1 : 2).map((issue) => (
            <div key={issue.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold text-white/78">{issue.title}</p>
              <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.32)' }}>{issue.message}</p>
            </div>
          ))}
          {scoreSummary.suggestions.slice(0, 1).map((suggestion) => (
            <div key={suggestion.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.14)' }}>
              <p className="text-[10px] font-semibold text-[#c7d2fe]">{suggestion.label}</p>
              <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{suggestion.message}</p>
            </div>
          ))}
        </div>

        <StageReadinessCard
          stageReadiness={stageReadiness}
          onViewIssues={onViewStageIssues}
          onContinueRefining={onContinueRefiningStage}
          onConfirmAdvance={onConfirmAdvanceStage}
        />

        <NextBestActionCard
          productionDecision={productionDecision}
          onGoHandle={onProductionAction}
        />
      </div>
    </div>
  )
}

function EditorDesk({
  jobs,
  timeline,
  view,
  clipReviews,
  dialogueLines,
  voiceTakes,
  lipSyncJobs,
  musicCues,
  soundEffectCues,
  notes,
  acceptedReviewIds,
  ignoredReviewActions,
  focusedJobId,
  focusedClipId,
  requestedReviewId,
  onAddJobToEditor,
  onMoveClip,
  onRemoveClip,
  onSetClipTransition,
  onSetClipPacing,
  onApplyEditSuggestion,
  onApplyClipReviewRecommendation,
  onIgnoreClipReviewRecommendation,
  onDraftNoteFromClipReviewIssue,
  onExportEditPlan,
  onTimelinePacingGoalChange,
  onTimelineMusicDirectionChange,
  onRetryJob,
  onBackToCanvas,
  onOpenPrevis,
}: {
  jobs: ShotDerivativeJob[]
  timeline: EditorTimeline
  view: WorkspaceView
  clipReviews: Record<string, ClipReview>
  dialogueLines: DialogueLine[]
  voiceTakes: VoiceTake[]
  lipSyncJobs: LipSyncJob[]
  musicCues: MusicCue[]
  soundEffectCues: SoundEffectCue[]
  notes: DirectorNote[]
  acceptedReviewIds: string[]
  ignoredReviewActions: string[]
  focusedJobId: string | null
  focusedClipId: string | null
  requestedReviewId: string | null
  onAddJobToEditor: (jobId: string) => void
  onMoveClip: (clipId: string, direction: 'up' | 'down') => void
  onRemoveClip: (clipId: string) => void
  onSetClipTransition: (clipId: string, transition: EditorClip['transition']) => void
  onSetClipPacing: (clipId: string, pacing: EditorClip['pacing']) => void
  onApplyEditSuggestion: (suggestion: EditSuggestion) => void
  onApplyClipReviewRecommendation: (review: ClipReview, actionId: string) => void
  onIgnoreClipReviewRecommendation: (reviewId: string, actionId: string) => void
  onDraftNoteFromClipReviewIssue: (review: ClipReview, issueId: string) => void
  onExportEditPlan: () => void
  onTimelinePacingGoalChange: (goal: EditorTimeline['pacingGoal']) => void
  onTimelineMusicDirectionChange: (direction: string) => void
  onRetryJob: (jobId: string) => void
  onBackToCanvas: () => void
  onOpenPrevis: () => void
}) {
  const approvals = useApprovalStore((s) => s.approvals)
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([])
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const footageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const clipRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const orderedClips = [...timeline.clips].sort((a, b) => a.order - b.order)
  const selectedMusicCue = musicCues.find((cue) => cue.targetEditorTimelineId === timeline.id && cue.status === 'selected') ?? null
  const editableJobs = jobs
    .filter((job) => job.status === 'done')
    .sort((a, b) => {
      const priority = { usable: 0, 'needs-adjustment': 1, 'needs-regenerate': 2, 'not-recommended': 3 } as const
      const reviewA = clipReviews[a.id]
      const reviewB = clipReviews[b.id]
      return (priority[reviewA?.status ?? 'usable'] - priority[reviewB?.status ?? 'usable']) || ((reviewB?.scores.overall ?? 0) - (reviewA?.scores.overall ?? 0))
    })
  const activeReview = activeReviewId ? Object.values(clipReviews).find((review) => review.id === activeReviewId) ?? null : null

  useEffect(() => {
    if (!requestedReviewId) return
    setActiveReviewId(requestedReviewId)
  }, [requestedReviewId])

  useEffect(() => {
    if (!focusedJobId) return
    footageRefs.current[focusedJobId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedJobId])

  useEffect(() => {
    if (!focusedClipId) return
    clipRefs.current[focusedClipId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedClipId])

  const suggestions = useMemo<EditSuggestion[]>(() => {
    const next: EditSuggestion[] = []
    if (orderedClips.length > 0) {
      next.push({
        id: 'opening-shot',
        type: 'opening-shot',
        title: '建议确认开场镜头',
        message: `当前第一个镜头是 ${orderedClips[0]?.title ?? '未命名镜头'}，它适合作为开场的候选。`,
        targetClipId: orderedClips[0]?.id,
        suggestedAction: '保持当前镜头作为开场，并确认它承担建立环境或品牌第一印象。',
      })
    }
    if (orderedClips.length > 1) {
      const repetitive = orderedClips.every((clip) => clip.transition === 'cut')
      if (repetitive) {
        next.push({
          id: 'transition-cut',
          type: 'transition',
          title: '转场可以更有层次',
          message: '当前所有镜头都使用 cut，节奏可能偏平。',
          targetClipId: orderedClips[1]?.id,
          suggestedAction: '把第二个镜头的转场改成 fade，拉开第一段节奏。',
        })
      }
    }
    if (orderedClips.length > 2) {
      next.push({
        id: 'reorder-middle',
        type: 'reorder',
        title: '中段顺序可再整理',
        message: '当前第三个镜头更适合作为第二拍出现，能更快进入信息主体。',
        targetClipId: orderedClips[2]?.id,
        suggestedAction: '把第三个镜头上移一位。',
      })
    }
    if (orderedClips.length > 1 && orderedClips.every((clip) => clip.pacing === orderedClips[0]?.pacing)) {
      next.push({
        id: 'pacing-balance',
        type: 'pacing',
        title: '节奏层次偏单一',
        message: '当前所有 clip 的 pacing 都一致，可以手动做出快慢变化。',
        targetClipId: orderedClips[0]?.id,
        suggestedAction: '把前两个镜头的 pacing 分别调整为 medium / fast。',
      })
    }
    next.push({
      id: 'music-direction',
      type: 'music-direction',
      title: '建议先确定音乐方向',
      message: timeline.musicDirection ? `当前音乐方向为 ${timeline.musicDirection}。` : '当前还没有音乐方向，会影响节奏判断。',
      suggestedAction: timeline.musicDirection ? '保持当前音乐方向，并据此微调转场。' : '先给这条序列补一个音乐方向，例如“紧凑电子”或“温暖电影感”。',
    })
    return next.filter((item) => !dismissedSuggestionIds.includes(item.id))
  }, [dismissedSuggestionIds, orderedClips, timeline.musicDirection])

  const clipAudioSummary = useCallback((clip: EditorClip) => {
    const dialogue = dialogueLines.find((line) => line.targetClipId === clip.id)
    const selectedVoiceTake = dialogue ? voiceTakes.find((take) => take.dialogueLineId === dialogue.id && take.status === 'selected') : null
    const selectedSfxCount = soundEffectCues.filter((cue) => cue.targetClipId === clip.id && cue.status === 'selected').length
    const lipSyncReady = lipSyncJobs.some((job) => job.targetVideoClipId === clip.sourceJobId && job.status === 'done')
    return { dialogue, selectedVoiceTake, selectedSfxCount, lipSyncReady }
  }, [dialogueLines, lipSyncJobs, soundEffectCues, voiceTakes])

  return (
    <div className="flex-1 min-w-0 flex flex-col" style={{ background: '#060a14', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,10,20,0.9)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>Editor Desk</p>
          <p className="text-[12px] font-semibold text-white/84 mt-1">
            {view === 'footage' ? '视频镜头素材池，只有你手动加入的镜头才会进入剪辑序列。' : '剪辑建议只提示，不自动应用完整序列。'}
          </p>
          <div className="mt-2">
            <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'editor-timeline', timeline.id)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenPrevis} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>打开分镜预演</button>
          <button onClick={onExportEditPlan} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#a7f3d0' }}>导出剪辑方案</button>
          <button onClick={onBackToCanvas} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>返回画布</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-3">
          <EditorAdapterPanel timeline={timeline} />
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold text-white/82">已生成镜头</p>
            <div className="flex flex-col gap-3 mt-3">
              {editableJobs.length === 0 ? (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>还没有可剪辑的视频镜头。先从分镜预演里选择单帧，再手动生成对应镜头。</p>
              ) : editableJobs.map((job) => {
                const review = clipReviews[job.id]
                const reviewMeta = review ? CLIP_REVIEW_STATUS_META[review.status] : null
                const hasStrongIssue = review?.issues.some((issue) => issue.severity === 'strong')
                return (
                <div
                  key={job.id}
                  ref={(node) => {
                    footageRefs.current[job.id] = node
                  }}
                  className="rounded-xl px-3 py-3 flex items-start justify-between gap-3"
                  style={{ background: focusedJobId === job.id ? 'rgba(99,102,241,0.07)' : hasStrongIssue ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.025)', border: focusedJobId === job.id ? '1px solid rgba(99,102,241,0.22)' : hasStrongIssue ? '1px solid rgba(244,63,94,0.16)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-white/82">{job.provider} · {job.duration}s · {job.status}</p>
                    {reviewMeta && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: reviewMeta.background, color: reviewMeta.color }}>
                          {reviewMeta.label}
                        </span>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          overall {review?.scores.overall}
                        </span>
                        <span className="text-[9px]" style={{ color: job.characterConsistency ? '#a7f3d0' : '#fda4af' }}>
                          {job.characterConsistency ? '角色一致性已绑定' : '角色一致性未绑定'}
                        </span>
                        {acceptedReviewIds.includes(review?.id ?? '') && (
                          <span className="text-[9px]" style={{ color: '#a7f3d0' }}>已接受审片</span>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.36)' }}>{job.videoPrompt}</p>
                    <div className="mt-2">
                      <NoteBadge summary={summarizeTargetNotes(notes, 'video-shot', job.id)} />
                    </div>
                    <div className="mt-1">
                      <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'video-shot', job.id)} />
                    </div>
                    <div className="mt-1">
                      <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'video-shot', job.id)} />
                    </div>
                    {job.error && <p className="text-[9px] mt-1" style={{ color: '#fda4af' }}>{job.error}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {review && (
                      <button onClick={() => setActiveReviewId(review.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>
                        查看审片
                      </button>
                    )}
                    {job.status === 'done' && (
                      <button onClick={() => onAddJobToEditor(job.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#a7f3d0' }}>
                        添加到剪辑台
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button onClick={() => onRetryJob(job.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}>
                        重试
                      </button>
                    )}
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold text-white/82">剪辑台</p>
            <div className="mt-2">
              <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'editor-timeline', timeline.id)} />
            </div>
            <div className="grid gap-2 mt-3 md:grid-cols-2">
              <select
                value={timeline.pacingGoal}
                onChange={(e) => onTimelinePacingGoalChange(e.target.value as EditorTimeline['pacingGoal'])}
                className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
              >
                {EDITOR_PACING_GOALS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
              </select>
              <input
                value={timeline.musicDirection ?? ''}
                onChange={(e) => onTimelineMusicDirectionChange(e.target.value)}
                placeholder="输入音乐方向，例如 warm cinematic"
                className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
              />
            </div>
            {selectedMusicCue && (
              <p className="text-[9px] mt-2" style={{ color: '#a7f3d0' }}>
                已绑定音乐候选 · {selectedMusicCue.mood}/{selectedMusicCue.tempo} · license {selectedMusicCue.licenseStatus}
              </p>
            )}
            <div className="flex flex-col gap-3 mt-3">
              {orderedClips.length === 0 ? (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>当前还没有 Editor Clip。你可以从左侧把已生成镜头手动加入这里。</p>
              ) : orderedClips.map((clip, index) => (
                <div
                  key={clip.id}
                  ref={(node) => {
                    clipRefs.current[clip.id] = node
                  }}
                  className="rounded-xl px-3 py-3"
                  style={{ background: focusedClipId === clip.id ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.025)', border: focusedClipId === clip.id ? '1px solid rgba(99,102,241,0.22)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  {(() => {
                    const audio = clipAudioSummary(clip)
                    return (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-white/82">#{index + 1} · {clip.title}</p>
                      <div className="mt-2">
                        <NoteBadge summary={summarizeTargetNotes(notes, 'editor-clip', clip.id)} />
                      </div>
                      <div className="mt-1">
                        <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'editor-clip', clip.id)} />
                      </div>
                      <div className="mt-1">
                        <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'editor-clip', clip.id)} />
                      </div>
                      <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>{clip.description}</p>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {audio.selectedVoiceTake && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}>
                            已绑定配音
                          </span>
                        )}
                        {audio.lipSyncReady && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: 'rgba(16,185,129,0.12)', color: '#a7f3d0' }}>
                            lip sync 已完成
                          </span>
                        )}
                        {audio.selectedSfxCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: 'rgba(251,191,36,0.12)', color: '#fde68a' }}>
                            音效 {audio.selectedSfxCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onMoveClip(clip.id, 'up')} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.62)' }}>上移</button>
                      <button onClick={() => onMoveClip(clip.id, 'down')} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.62)' }}>下移</button>
                      <button onClick={() => onRemoveClip(clip.id)} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(244,63,94,0.08)', color: '#fda4af' }}>移除</button>
                    </div>
                  </div>
                    )
                  })()}
                  <video src={clip.videoUrl} controls className="w-full rounded-lg mt-3" style={{ maxHeight: 140 }} />
                  <div className="grid gap-2 mt-3 md:grid-cols-2">
                    <select
                      value={clip.transition}
                      onChange={(e) => onSetClipTransition(clip.id, e.target.value as EditorClip['transition'])}
                      className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                    >
                      {CLIP_TRANSITIONS.map((transition) => <option key={transition} value={transition}>{transition}</option>)}
                    </select>
                    <select
                      value={clip.pacing}
                      onChange={(e) => onSetClipPacing(clip.id, e.target.value as EditorClip['pacing'])}
                      className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                    >
                      {CLIP_PACING.map((pacing) => <option key={pacing} value={pacing}>{pacing}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
            <p className="text-[11px] font-semibold text-[#c7d2fe]">AI 剪辑建议</p>
            <div className="flex flex-col gap-2 mt-3">
              {suggestions.length === 0 ? (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>镜头还不够多，等你手动加入几个视频镜头后，这里会给出节奏和开场建议。</p>
              ) : suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-semibold text-white/82">{suggestion.title}</p>
                  <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{suggestion.message}</p>
                  <p className="text-[9px] mt-1" style={{ color: '#c7d2fe' }}>{suggestion.suggestedAction}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => {
                      onApplyEditSuggestion(suggestion)
                      setDismissedSuggestionIds((prev) => [...prev, suggestion.id])
                    }} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>
                      应用建议
                    </button>
                    <button onClick={() => setDismissedSuggestionIds((prev) => [...prev, suggestion.id])} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}>
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {activeReview && (
          <ClipReviewPanel
            review={activeReview}
            accepted={acceptedReviewIds.includes(activeReview.id)}
            ignoredActionIds={ignoredReviewActions}
            noteSummary={summarizeTargetNotes(notes, 'clip-review', activeReview.id)}
            onClose={() => setActiveReviewId(null)}
            onDraftNoteFromIssue={(issueId) => onDraftNoteFromClipReviewIssue(activeReview, issueId)}
            onApplyRecommendation={(actionId) => onApplyClipReviewRecommendation(activeReview, actionId)}
            onIgnoreRecommendation={(actionId) => onIgnoreClipReviewRecommendation(activeReview.id, actionId)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ClipReviewPanel({
  review,
  accepted,
  ignoredActionIds,
  noteSummary,
  onClose,
  onDraftNoteFromIssue,
  onApplyRecommendation,
  onIgnoreRecommendation,
}: {
  review: ClipReview
  accepted: boolean
  ignoredActionIds: string[]
  noteSummary?: NoteBadgeSummary
  onClose: () => void
  onDraftNoteFromIssue: (issueId: string) => void
  onApplyRecommendation: (actionId: string) => void
  onIgnoreRecommendation: (actionId: string) => void
}) {
  const meta = CLIP_REVIEW_STATUS_META[review.status]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      className="absolute right-5 top-20 z-40 w-[420px] max-w-[calc(100%-40px)] rounded-2xl p-4"
      style={{ background: 'rgba(7,11,20,0.94)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', backdropFilter: 'blur(18px)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>Clip Review</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: meta.background, color: meta.color }}>{meta.label}</span>
            <span className="text-[11px] font-semibold text-white/84">overall {review.scores.overall}</span>
            <NoteBadge summary={noteSummary} />
            {accepted && <span className="text-[9px]" style={{ color: '#a7f3d0' }}>已接受</span>}
          </div>
        </div>
        <button onClick={onClose} className="px-2 py-1 rounded-lg text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>关闭</button>
      </div>

      <div className="grid gap-2 mt-4 md:grid-cols-2">
        {Object.entries(review.scores).map(([key, value]) => (
          <div key={key} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{key}</p>
            <p className="text-[12px] font-semibold text-white/82 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {(review.roleBibleId || review.consistencyKey) && (
        <div className="rounded-xl px-3 py-3 mt-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <p className="text-[10px] font-semibold text-white/82">绑定角色信息</p>
          {review.roleBibleId && (
            <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.46)' }}>roleBibleId: {review.roleBibleId}</p>
          )}
          {review.consistencyKey && (
            <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
              consistencyKey: {review.consistencyKey}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {review.issues.map((issue) => {
          const severity = CLIP_REVIEW_SEVERITY_META[issue.severity]
          return (
            <div key={issue.id} className="rounded-xl px-3 py-2" style={{ background: severity.background, border: `1px solid ${severity.color}22` }}>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: severity.background, color: severity.color }}>{issue.severity}</span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{issue.type}</span>
              </div>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.62)' }}>{issue.message}</p>
              <button
                onClick={() => onDraftNoteFromIssue(issue.id)}
                className="mt-2 px-2.5 py-1.5 rounded-lg text-[9px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}
              >
                添加为导演批注
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {review.recommendations
          .filter((recommendation) => !ignoredActionIds.includes(`${review.id}:${recommendation.id}`))
          .map((recommendation) => (
          <div key={recommendation.id} className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] font-semibold text-white/82">{recommendation.label}</p>
            <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.4)' }}>{recommendation.message}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => onApplyRecommendation(recommendation.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>
                应用建议
              </button>
              <button onClick={() => onIgnoreRecommendation(recommendation.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}>
                忽略
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({ globalPro }: { globalPro: GlobalPro }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shots = useShotsStore((s) => s.shots)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handle = useCallback((fn: () => void) => { fn(); setOpen(false) }, [])

  const ITEMS = [
    { label: '分镜脚本', sub: 'TXT · 每个镜头的描述与参数', icon: '📄', action: () => downloadStoryboard(shots, globalPro) },
    { label: 'Prompt 包', sub: 'JSON · 图像 & 视频 Prompt 集合', icon: '📦', action: () => downloadPromptPack(shots, globalPro) },
    { label: '项目数据', sub: 'JSON · 完整镜头数据', icon: '💾', action: () => downloadProjectExport(shots) },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all"
        style={{
          background: open ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)',
          border: open ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
          color: open ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
        }}
      >
        <span>📥</span><span>导出</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-[210px] rounded-xl overflow-hidden z-50"
          style={{ background: 'rgba(12,17,28,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider px-3 pt-2.5 pb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            导出方案 · {shots.length} 个镜头
          </p>
          {ITEMS.map((item) => (
            <button key={item.label} onClick={() => handle(item.action)} className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
              <span className="text-base leading-none mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white/80">{item.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.sub}</p>
              </div>
            </button>
          ))}
          <div className="h-px mx-3 my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-[9px] px-3 pb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>直接下载到本地，无需后端</p>
        </div>
      )}
    </div>
  )
}

// ─── Publish modal ────────────────────────────────────────────────────────────

function PublishProjectModal({ defaultTitle, onClose }: { defaultTitle: string; onClose: () => void }) {
  const [title, setTitle]   = useState(defaultTitle)
  const [desc, setDesc]     = useState('')
  const [submitting, setSub] = useState(false)
  const [done, setDone]     = useState(false)
  const publishProject = useFeedStore((s) => s.publishProject)
  const user           = useAuthStore((s) => s.user)
  const shots          = useShotsStore((s) => s.shots)

  const handlePublish = useCallback(() => {
    if (!title.trim()) return
    setSub(true)
    const extracted = shots.map(extractShotData)
    publishProject({
      title: title.trim(), description: desc.trim() || `共 ${shots.length} 个镜头的创作方案`,
      shots: extracted, coverImage: extracted.find((s) => s.imageUrl)?.imageUrl,
      author: user?.displayName ?? user?.username ?? '匿名创作者', authorId: user?.id,
      tags: [...new Set(extracted.map((s) => s.style).filter(Boolean))],
    })
    setDone(true)
    setTimeout(onClose, 1800)
  }, [title, desc, shots, publishProject, user, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,15,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">发布到 Explore</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">让更多人看到你的创作 · {shots.length} 个镜头</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>
        {done ? (
          <div className="px-6 py-10 text-center">
            <p className="text-3xl mb-3">🎉</p>
            <p className="text-sm font-semibold text-white mb-1">发布成功！</p>
            <p className="text-xs text-gray-500">已出现在 Explore 页面</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">作品标题 *</label>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/90 outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: title.trim() ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">简介（可选）</label>
                <textarea
                  value={desc} onChange={(e) => setDesc(e.target.value)}
                  placeholder="描述你的创作思路…" rows={3}
                  className="w-full rounded-xl px-3.5 py-3 text-sm text-white/90 placeholder-gray-600 outline-none resize-none leading-6"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>取消</button>
              <button onClick={handlePublish} disabled={!title.trim() || submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>{submitting ? '发布中…' : '发布作品'}</button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ─── Director helpers ──────────────────────────────────────────────────────────

const MOOD_THUMB_COLORS: Record<string, [string, string]> = {
  'neon-night': ['0d0d24', 'f43f5e'], 'wanderlust': ['0a1a0a', '34d399'],
  'tender': ['1a0f0a', 'f59e0b'], 'intense': ['1a0808', 'f43f5e'],
  'ominous': ['080808', '6366f1'], 'clean': ['0a1020', '60a5fa'], 'cinematic': ['0a0f1a', 'a5b4fc'],
}

function getMoodThumbnail(mood: string, index: number): string {
  const [bg, fg] = MOOD_THUMB_COLORS[mood] ?? MOOD_THUMB_COLORS['cinematic']!
  return `https://placehold.co/1792x1024/${bg}/${fg}?text=Shot+${index + 1}`
}

function buildFilledNodes(idea: string, dir: DirectorShot, shotIndex: number, baseNodes: CanvasNode[]): CanvasNode[] {
  const imgUrl = getMoodThumbnail(dir.mood, shotIndex)
  const { framing = 'MS', colorGrade = 'cinematic', lighting = 'soft' } = dir.presetParams
  const kfPrompt = `${dir.description.slice(0, 60)}, ${framing} framing, ${colorGrade} color grade, ${lighting} lighting, film grain, cinematic`
  return baseNodes.map((node) => {
    switch (node.id) {
      case 'prompt-1':      return { ...node, content: idea }
      case 'agent-writer':  return { ...node, status: 'done', progress: 100, source: 'mock' as const, content: `【分镜 ${shotIndex + 1} 剧本】\n${idea}\n\n核心情绪：${dir.mood}` }
      case 'agent-director':return { ...node, status: 'done', progress: 100, source: 'mock' as const, content: `【导演注记 · Shot ${shotIndex + 1}】\n${dir.description}` }
      case 'agent-actor':   return { ...node, status: 'done', progress: 100, source: 'mock' as const, characterName: '主角', personality: '沉静内敛', lookSummary: '去符号化气质', wardrobe: '深色系简约', content: '{}' }
      case 'agent-dop':     return { ...node, status: 'done', progress: 100, source: 'mock' as const, imageUrl: imgUrl, shotDescription: dir.description, keyframePrompt: kfPrompt, content: `{}` }
      case 'agent-editor':  return { ...node, status: 'done', progress: 100, source: 'mock' as const, content: `【剪辑 · Shot ${shotIndex + 1}】节奏：稳步推进` }
      case 'output-1':      return { ...node, content: `Shot ${shotIndex + 1} · ${dir.shotType} · ${dir.mood}` }
      case 'final-edit-1':  return { ...node, status: 'done', progress: 100, source: 'mock' as const, content: `镜头 ${shotIndex + 1} 已纳入时间线`, timelineSummary: `Shot ${shotIndex + 1}: ${dir.description.slice(0, 40)}` }
      default: return node
    }
  })
}

// ─── Shot Card (expanded timeline card) ───────────────────────────────────────

function ShotCard({
  shot, index, isActive, isHighlighted, onSelect, onRemove, onUpdate, crewMember, canvasMode, noteSummary,
}: {
  shot: Shot; index: number; isActive: boolean
  isHighlighted?: boolean
  onSelect: () => void; onRemove: () => void
  onUpdate: (patch: Partial<Shot>) => void
  crewMember?: CrewMember
  canvasMode: CanvasMode
  noteSummary?: NoteBadgeSummary
}) {
  const approvals = useApprovalStore((s) => s.approvals)
  const params = shot.presetParams ?? {}
  const approvalSummary = useMemo(() => summarizeTargetApprovals(approvals, 'shot', shot.id), [approvals, shot.id])

  const statusKey = shot.isDone ? 'done' : isActive ? 'inprogress' : 'idle'
  const statusMeta = SHOT_STATUS_LABELS[statusKey]!

  return (
    <motion.div
      layout
      onClick={onSelect}
      className="relative flex-shrink-0 flex flex-col cursor-pointer overflow-hidden"
      style={{
        width: 280,
        background: isActive ? 'rgba(14,18,36,0.95)' : 'rgba(10,14,26,0.8)',
        border: isHighlighted
          ? '1px solid rgba(110,231,183,0.4)'
          : isActive
            ? '1px solid rgba(99,102,241,0.45)'
            : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        boxShadow: isHighlighted
          ? '0 0 0 1px rgba(110,231,183,0.14), 0 10px 28px rgba(16,185,129,0.12)'
          : isActive
            ? '0 0 0 1px rgba(99,102,241,0.12), 0 8px 32px rgba(0,0,0,0.5)'
            : '0 4px 16px rgba(0,0,0,0.35)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Active indicator bar */}
      {(isActive || isHighlighted) && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', borderRadius: '16px 16px 0 0' }} />
      )}

      {/* Thumbnail + header */}
      <div className="relative" style={{ height: 120 }}>
        {shot.thumbnailUrl ? (
          <Image
            src={shot.thumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="280px"
            className="object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: isActive ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)' }}
          >
            <span style={{ fontSize: 32, opacity: 0.2 }}>🎬</span>
          </div>
        )}

        {/* Overlay: shot number + status */}
        <div className="absolute inset-0 flex items-start justify-between p-2.5" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 60%)' }}>
          <span
            className="flex items-center justify-center font-black text-white"
            style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.5)', fontSize: 11 }}
          >
            {index + 1}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Status badge */}
            <span
              style={{
                padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700,
                background: 'rgba(0,0,0,0.55)', color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>

            {/* Assigned avatar */}
            {crewMember && (
              <div
                title={crewMember.name}
                className="flex items-center justify-center text-[10px] font-black text-white"
                style={{ width: 20, height: 20, borderRadius: 5, background: crewMember.accent, flexShrink: 0 }}
              >
                {crewMember.avatar}
              </div>
            )}

            {/* Remove button */}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="flex items-center justify-center transition-colors"
              style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-3.5">

        {/* Label + idea */}
        <div>
          <p className="text-[12px] font-semibold mb-0.5" style={{ color: isActive ? '#e0e7ff' : 'rgba(255,255,255,0.65)' }}>
            {shot.label}
          </p>
          <div className="mt-1">
            <NoteBadge summary={noteSummary} />
          </div>
          <div className="mt-1">
            <ApprovalBadge summary={approvalSummary} />
          </div>
          {shot.intent && (
            <span
              className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.42)' }}
            >
              {shot.intent}
            </span>
          )}
          {shot.cinematicSkillIds?.[0] && (
            <span
              className="inline-flex mt-1 ml-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.18)', color: '#c7d2fe' }}
            >
              {shot.cinematicSkillIds[shot.cinematicSkillIds.length - 1]}
            </span>
          )}
          {shot.idea && (
            <p className="text-[10px] leading-[1.4]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {shot.idea.slice(0, 56)}{shot.idea.length > 56 ? '…' : ''}
            </p>
          )}
          {crewMember && (
            <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
              负责：{crewMember.name} · {crewMember.role}
            </p>
          )}
        </div>

        {canvasMode !== 'simple' && (
        <div className="flex flex-wrap gap-1.5">
          {summarizeSuggestionParams(params).slice(0, canvasMode === 'advanced' ? 3 : 5).map((item) => (
            <span
              key={`${shot.id}-${item.label}`}
              className="px-2 py-1 rounded-lg text-[9px]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
            >
              {item.label}: {item.value}
            </span>
          ))}
        </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {canvasMode === 'simple' ? 'Simple 模式下保持干净，控制收纳到底部工具栏' : canvasMode === 'advanced' ? 'Advanced 模式显示更多镜头摘要' : 'Pro 模式提供更完整的镜头摘要'}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUpdate({ presetParams: { ...params } })
            }}
            className="px-2 py-1 rounded-lg text-[9px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#a5b4fc' }}
          >
            底部编辑
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Shot Timeline (center column) ────────────────────────────────────────────

function ShotTimeline({
  shots, narrative, currentShotId, onSwitchShot, onAddShot, onRemoveShot, onUpdateShot, crewMembers, running,
  suggestionShots, compareSuggestionId, gearSuggestions, compareGearSuggestionId,
  onGenerateSuggestions, onGenerateGearSuggestions, onApplySuggestion, onApplyGearSuggestion,
  onToggleCompareSuggestion, onToggleCompareGearSuggestion, onIgnoreSuggestion, onIgnoreGearSuggestion,
  idea, onIdeaChange, pro, onPatchPro, globalPro, setGlobalPro, selectedStyle, onStyleChange,
  activeTemplateId, onApplyTemplate, selectedStyleId, onSelectStyle, onGenerateCurrent, canvasMode,
  insights, scoreSummary, productionDecision, onProductionAction, insightOpen, onToggleInsight, onInsightAction,
  stageReadiness, onViewStageIssues, onContinueRefiningStage, onConfirmAdvanceStage,
  currentIntent, onIntentChange, requestedPanel, onRequestedPanelHandled, onNarrativeTypeChange,
  focusedSequenceId, focusedShotId, storyboardPrevis, characterBible, styleBible, roleBibles,
  notes, noteTargets, notesSummary, requestedNoteDraft, noteAssigneeOptions, approvalTargets, approvalsSummary,
  castingSuggestions, compareCastingSuggestionId, editingCastingSuggestionId,
  onGenerateCastingSuggestions, onApplyCastingSuggestion, onToggleCompareCastingSuggestion,
  onIgnoreCastingSuggestion, onStartEditCastingSuggestion, onPatchEditingCastingSuggestion, onApplyEditedCastingSuggestion, onToggleRoleBibleLock,
  onCreateDirectorNote, onReplyDirectorNote, onUpdateDirectorNoteStatus, onLocateDirectorNote, onConvertDirectorNoteToTask, onCreateApprovalRequest, onApprovalDecision, onLocateApprovalTarget, onRequestedNoteDraftHandled,
  focusedStoryboardFrameId, focusedRoleBibleId,
  previsSourceType, onPrevisSourceTypeChange, previsSourcePrompt, onPrevisSourcePromptChange,
  previsSourceImageUrl, onPrevisSourceImageUrlChange, previsDuration, onPrevisDurationChange,
  previsFrameCount, onPrevisFrameCountChange, previsFrameStyle, onPrevisFrameStyleChange,
  previsAspectRatio, onPrevisAspectRatioChange, editingStoryboardFrameId,
  onEditingStoryboardFrameChange, activeStoryboardFrame, onSelectStoryboardFrame,
  onDiscardStoryboardFrame, onDuplicateStoryboardFrame, onOpenStoryboardFrameEditor,
  onPatchStoryboardFrame, videoConfigFrameId, onGenerateStoryboardPrevis,
  onRegenerateStoryboardFrame, onUpdateStoryboardFramePrompt, onStoryboardGenerateVideoPlaceholder,
  derivativeProvider, onDerivativeProviderChange, derivativeDuration, onDerivativeDurationChange,
  derivativeMovement, onDerivativeMovementChange, motionStrength, onMotionStrengthChange,
  characterConsistency, onCharacterConsistencyChange, styleConsistency, onStyleConsistencyChange,
  onCreateShotDerivativeJob, onApplyCinematicSkill, currentStage,
}: {
  shots: Shot[]; narrative: Narrative | null; currentShotId: string; running: boolean
  onSwitchShot: (id: string) => void; onAddShot: (sequenceId?: string) => void
  onRemoveShot: (id: string) => void; onUpdateShot: (id: string, patch: Partial<Shot>) => void
  crewMembers: CrewMember[] | null
  suggestionShots: ShotSuggestion[]
  compareSuggestionId: string | null
  gearSuggestions: ShotSuggestion[]
  compareGearSuggestionId: string | null
  onGenerateSuggestions: () => void
  onGenerateGearSuggestions: () => void
  onApplySuggestion: (id: string) => void
  onApplyGearSuggestion: (id: string) => void
  onToggleCompareSuggestion: (id: string) => void
  onToggleCompareGearSuggestion: (id: string) => void
  onIgnoreSuggestion: (id: string) => void
  onIgnoreGearSuggestion: (id: string) => void
  idea: string
  onIdeaChange: (v: string) => void
  pro: ProParams
  onPatchPro: (patch: Partial<ProParams>) => void
  globalPro: GlobalPro
  setGlobalPro: React.Dispatch<React.SetStateAction<GlobalPro>>
  selectedStyle: string
  onStyleChange: (v: string) => void
  activeTemplateId: string | null
  onApplyTemplate: (id: string) => void
  selectedStyleId: string | null
  onSelectStyle: (id: string | null) => void
  onGenerateCurrent: () => void
  canvasMode: CanvasMode
  insights: NarrativeInsight[]
  scoreSummary: ReturnType<typeof computeScoreSystem>
  productionDecision: ProductionDecision
  onProductionAction: (decision: ProductionDecision) => void
  stageReadiness: StageReadiness
  onViewStageIssues: () => void
  onContinueRefiningStage: () => void
  onConfirmAdvanceStage: () => void
  insightOpen: boolean
  onToggleInsight: () => void
  onInsightAction: (insight: NarrativeInsight) => void
  currentIntent?: string
  onIntentChange: (intent: string) => void
  requestedPanel: CanvasActionPanel | null
  onRequestedPanelHandled: () => void
  onNarrativeTypeChange: (type: NarrativeType) => void
  focusedSequenceId: string | null
  focusedShotId: string | null
  storyboardPrevis: StoryboardPrevis | null
  characterBible: CharacterBible | null
  styleBible: StyleBible | null
  roleBibles: RoleBible[]
  notes: DirectorNote[]
  noteTargets: Array<{ value: string; label: string; targetType: DirectorNoteTargetType; targetId: string }>
  notesSummary: { unresolvedCount: number; blockerCount: number; summary: string }
  requestedNoteDraft: DirectorNoteDraft | null
  noteAssigneeOptions: Array<{ id: string; label: string }>
  approvalTargets: ApprovalTargetOption[]
  approvalsSummary: { unresolvedCount: number; clientChangeRequestCount: number; summary: string }
  castingSuggestions: CastingSuggestion[]
  compareCastingSuggestionId: string | null
  editingCastingSuggestionId: string | null
  onGenerateCastingSuggestions: () => void
  onApplyCastingSuggestion: (id: string) => void
  onToggleCompareCastingSuggestion: (id: string) => void
  onIgnoreCastingSuggestion: (id: string) => void
  onStartEditCastingSuggestion: (id: string | null) => void
  onPatchEditingCastingSuggestion: (patch: Partial<RoleBible>) => void
  onApplyEditedCastingSuggestion: () => void
  onToggleRoleBibleLock: (id: string) => void
  onCreateDirectorNote: (draft: DirectorNoteDraft & { content: string; category: DirectorNoteCategory; priority: DirectorNotePriority; assignedTo?: string }) => DirectorNote | null
  onReplyDirectorNote: (noteId: string, content: string) => void
  onUpdateDirectorNoteStatus: (noteId: string, status: DirectorNoteStatus) => void
  onLocateDirectorNote: (note: DirectorNote) => void
  onConvertDirectorNoteToTask: (noteId: string) => void
  onCreateApprovalRequest: (draft: { targetType: ApprovalTargetType; targetId: string; title: string; description?: string; requiredRoles: ApprovalRole[] }) => ApprovalRequest | null
  onApprovalDecision: (draft: { approvalId: string; role: ApprovalRole; status: ApprovalDecision['status']; comment: string; followUp: 'note' | 'task' | 'comment'; assignedTo?: string }) => ApprovalRequest | null
  onLocateApprovalTarget: (targetType: ApprovalTargetType, targetId: string) => void
  onRequestedNoteDraftHandled: () => void
  focusedStoryboardFrameId: string | null
  focusedRoleBibleId: string | null
  previsSourceType: 'prompt' | 'image'
  onPrevisSourceTypeChange: (value: 'prompt' | 'image') => void
  previsSourcePrompt: string
  onPrevisSourcePromptChange: (value: string) => void
  previsSourceImageUrl: string
  onPrevisSourceImageUrlChange: (value: string) => void
  previsDuration: number
  onPrevisDurationChange: (value: number) => void
  previsFrameCount: (typeof PREVIS_FRAME_COUNTS)[number]
  onPrevisFrameCountChange: (value: (typeof PREVIS_FRAME_COUNTS)[number]) => void
  previsFrameStyle: (typeof PREVIS_FRAME_STYLES)[number]
  onPrevisFrameStyleChange: (value: (typeof PREVIS_FRAME_STYLES)[number]) => void
  previsAspectRatio: (typeof PREVIS_ASPECT_RATIOS)[number]
  onPrevisAspectRatioChange: (value: (typeof PREVIS_ASPECT_RATIOS)[number]) => void
  editingStoryboardFrameId: string | null
  onEditingStoryboardFrameChange: (value: string | null) => void
  activeStoryboardFrame: StoryboardFrame | null
  onSelectStoryboardFrame: (frameId: string) => void
  onDiscardStoryboardFrame: (frameId: string) => void
  onDuplicateStoryboardFrame: (frameId: string) => void
  onOpenStoryboardFrameEditor: (frameId: string, panel?: CanvasActionPanel) => void
  onPatchStoryboardFrame: (frameId: string, patch: Partial<StoryboardFrame>) => void
  videoConfigFrameId: string | null
  onGenerateStoryboardPrevis: () => void
  onRegenerateStoryboardFrame: (frameId: string) => void
  onUpdateStoryboardFramePrompt: (frameId: string, value: string) => void
  onStoryboardGenerateVideoPlaceholder: (frameId: string) => void
  derivativeProvider: (typeof DERIVATIVE_PROVIDERS)[number]
  onDerivativeProviderChange: (value: (typeof DERIVATIVE_PROVIDERS)[number]) => void
  derivativeDuration: (typeof DERIVATIVE_DURATIONS)[number]
  onDerivativeDurationChange: (value: (typeof DERIVATIVE_DURATIONS)[number]) => void
  derivativeMovement: string
  onDerivativeMovementChange: (value: string) => void
  motionStrength: number
  onMotionStrengthChange: (value: number) => void
  characterConsistency: number
  onCharacterConsistencyChange: (value: number) => void
  styleConsistency: number
  onStyleConsistencyChange: (value: number) => void
  onCreateShotDerivativeJob: (frameId: string) => void
  onApplyCinematicSkill: (suggestion: ShotSuggestion) => void
  currentStage: string
}) {
  const approvals = useApprovalStore((s) => s.approvals)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]   = useState(1)
  const sequenceRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const shotRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sequenceRows = useMemo(() => {
    const baseSequences = narrative?.sequences ?? []
    return baseSequences.map((sequence) => ({
      sequence,
      shots: sequence.shotIds
        .map((shotId) => shots.find((shot) => shot.id === shotId))
        .filter((shot): shot is Shot => Boolean(shot)),
    }))
  }, [narrative, shots])
  const widestRow = Math.max(...sequenceRows.map((row) => row.shots.length), 1)

  // Wheel → horizontal scroll; Ctrl/Cmd+wheel → zoom
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.06 : 0.06
      setZoom((z) => Math.min(1.4, Math.max(0.55, z + delta)))
    } else {
      const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX
      if (containerRef.current) containerRef.current.scrollLeft += scrollAmount
    }
  }, [])

  useEffect(() => {
    if (!focusedSequenceId) return
    sequenceRefs.current[focusedSequenceId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [focusedSequenceId])

  useEffect(() => {
    if (!focusedShotId) return
    shotRefs.current[focusedShotId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [focusedShotId])

  return (
    <div
      className="flex-1 min-w-0 flex flex-col"
      style={{ background: '#060a14', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,10,20,0.9)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            镜头时间线
          </span>
          <span
            className="text-[9px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
          >
            {shots.length} 个镜头
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>
              Narrative
            </span>
            <select
              value={narrative?.type ?? 'commercial'}
              onChange={(e) => onNarrativeTypeChange(e.target.value as NarrativeType)}
              className="text-[10px] rounded-lg px-2 py-1 outline-none"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#c7d2fe' }}
            >
              {NARRATIVE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {narrative?.structure ?? 'Classic 4-Beat'}
            </span>
          </div>
          {/* Zoom display */}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.55, z - 0.1))}
              className="w-6 h-6 flex items-center justify-center rounded text-[12px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
            >−</button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 h-6 flex items-center justify-center rounded text-[9px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
            >重置</button>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="w-6 h-6 flex items-center justify-center rounded text-[12px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
            >+</button>
          </div>

          {/* Add shot */}
          <button
            onClick={() => onAddShot()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}
          >
            + 新镜头
          </button>
        </div>
      </div>

      <TemplateSelectionPanel
        activeTemplateId={activeTemplateId}
        onSelectTemplate={onApplyTemplate}
      />

      <ScoreSummaryStrip
        scoreSummary={scoreSummary}
        canvasMode={canvasMode}
        productionDecision={productionDecision}
        onProductionAction={onProductionAction}
        stageReadiness={stageReadiness}
        onViewStageIssues={onViewStageIssues}
        onContinueRefiningStage={onContinueRefiningStage}
        onConfirmAdvanceStage={onConfirmAdvanceStage}
      />

      {insights.length > 0 && (
        <div className="px-5 pt-3">
          <button
            onClick={onToggleInsight}
            className="w-full rounded-2xl px-4 py-3 text-left transition-all"
            style={{
              background: insightOpen ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
              border: insightOpen ? '1px solid rgba(99,102,241,0.24)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: '#c7d2fe' }}>
                  💡 AI发现了 {insights.length} 个可以优化的地方
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>
                  基于当前模板、sequence 与镜头结构生成，不会自动修改你的内容。
                </p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.52)' }}>
                {insightOpen ? '收起' : '查看'}
              </span>
            </div>
          </button>
        </div>
      )}

      <AnimatePresence>
        {insightOpen && insights.length > 0 && (
          <InsightPanel
            insights={insights}
            scoreSummary={scoreSummary}
            onAction={onInsightAction}
            onClose={onToggleInsight}
          />
        )}
      </AnimatePresence>

      {/* Scrollable track */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}
      >
        <div
          className="flex flex-col gap-4 px-6 py-6"
          style={{
            minHeight: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: `${widestRow * 296 + 320}px`,
          }}
        >
          {sequenceRows.map(({ sequence, shots: sequenceShots }) => (
            (() => {
              const structureCheck = scoreSummary.breakdown.structureAnalysis.sequenceChecks.find((check) => check.sequenceId === sequence.id)
              const statusMeta = structureCheck ? SEQUENCE_STATUS_META[structureCheck.status] : null
              return (
                <div
                  key={sequence.id}
                  ref={(node) => {
                    sequenceRefs.current[sequence.id] = node
                  }}
                  className="rounded-[20px] p-4"
                  style={{
                    background: focusedSequenceId === sequence.id ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                    border: focusedSequenceId === sequence.id ? '1px solid rgba(99,102,241,0.22)' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: focusedSequenceId === sequence.id ? '0 10px 28px rgba(99,102,241,0.1)' : 'none',
                    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-white/82">{sequence.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
                          {sequence.structureId}
                        </span>
                        {statusMeta && (
                          <span
                            className="text-[9px] px-2 py-0.5 rounded-full"
                            style={{ background: statusMeta.background, border: `1px solid ${statusMeta.border}`, color: statusMeta.color }}
                          >
                            {statusMeta.label}
                          </span>
                        )}
                        {sequence.suggestedIntent && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.42)' }}>
                            {sequence.suggestedIntent}
                          </span>
                        )}
                        {sequence.cinematicSkillIds?.slice(0, 2).map((skillId) => (
                          <span key={`${sequence.id}-${skillId}`} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(221,214,254,0.12)', color: '#ddd6fe' }}>
                            {skillId}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Goal: {sequence.goal}
                      </p>
                      <div className="mt-2">
                        <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'sequence', sequence.id)} />
                      </div>
                      {structureCheck && structureCheck.issues.length > 0 && canvasMode !== 'simple' && (
                        <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {structureCheck.issues.join(' · ')}
                        </p>
                      )}
                    </div>
                <button
                  onClick={() => onAddShot(sequence.id)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#c7d2fe' }}
                >
                  + 添加到 {sequence.name}
                </button>
                  </div>

                  <div className="flex items-start gap-4">
                    <AnimatePresence>
                      {sequenceShots.map((shot) => {
                        const shotIndex = shots.findIndex((item) => item.id === shot.id)
                        return (
                          <div
                            key={shot.id}
                            ref={(node) => {
                              shotRefs.current[shot.id] = node
                            }}
                          >
                            <ShotCard
                              shot={shot}
                              index={shotIndex}
                              isActive={shot.id === currentShotId}
                              isHighlighted={focusedShotId === shot.id}
                              onSelect={() => onSwitchShot(shot.id)}
                              onRemove={() => onRemoveShot(shot.id)}
                              onUpdate={(patch) => onUpdateShot(shot.id, patch)}
                              crewMember={crewMembers?.[(shotIndex < 0 ? 0 : shotIndex) % (crewMembers?.length ?? 1)] ?? undefined}
                              canvasMode={canvasMode}
                              noteSummary={summarizeTargetNotes(notes, 'shot', shot.id)}
                            />
                          </div>
                        )
                      })}
                    </AnimatePresence>

                    <button
                      onClick={() => onAddShot(sequence.id)}
                      className="flex-shrink-0 flex flex-col items-center justify-center gap-3 transition-all"
                      style={{
                        width: 280, height: 200,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: 'rgba(255,255,255,0.2)',
                      }}
                    >
                      <span style={{ fontSize: 28 }}>+</span>
                      <span style={{ fontSize: 11 }}>添加镜头</span>
                    </button>
                  </div>
                </div>
              )
            })()
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div
        className="relative flex-shrink-0 px-5 pt-3 pb-5 flex flex-col gap-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(6,10,20,0.92)' }}
      >
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          滚轮横向滚动 · Ctrl/Cmd + 滚轮缩放 · 专业能力已收纳到底部操作栏
        </p>
        <CanvasBottomDock
          idea={idea}
          onIdeaChange={onIdeaChange}
          pro={pro}
          onPatchPro={onPatchPro}
          globalPro={globalPro}
          setGlobalPro={setGlobalPro}
          selectedStyle={selectedStyle}
          onStyleChange={onStyleChange}
          activeTemplateId={activeTemplateId}
          onApplyTemplate={onApplyTemplate}
          selectedStyleId={selectedStyleId}
          onSelectStyle={onSelectStyle}
          running={running}
          onGenerateCurrent={onGenerateCurrent}
          canvasMode={canvasMode}
          insights={insights}
          insightContext={buildInsightContext({ narrative, shots })}
          onInsightAction={onInsightAction}
          currentIntent={currentIntent}
          onIntentChange={onIntentChange}
          requestedPanel={requestedPanel}
          onRequestedPanelHandled={onRequestedPanelHandled}
          suggestionShots={suggestionShots}
          compareSuggestionId={compareSuggestionId}
          gearSuggestions={gearSuggestions}
          compareGearSuggestionId={compareGearSuggestionId}
          shots={shots}
          onGenerateSuggestions={onGenerateSuggestions}
          onGenerateGearSuggestions={onGenerateGearSuggestions}
          onApplySuggestion={onApplySuggestion}
          onApplyGearSuggestion={onApplyGearSuggestion}
          onToggleCompareSuggestion={onToggleCompareSuggestion}
          onToggleCompareGearSuggestion={onToggleCompareGearSuggestion}
          onIgnoreSuggestion={onIgnoreSuggestion}
          onIgnoreGearSuggestion={onIgnoreGearSuggestion}
          storyboardPrevis={storyboardPrevis}
          characterBible={characterBible}
          styleBible={styleBible}
          roleBibles={roleBibles}
          notes={notes}
          approvalTargets={approvalTargets}
          approvalsSummary={approvalsSummary}
          castingSuggestions={castingSuggestions}
          compareCastingSuggestionId={compareCastingSuggestionId}
          editingCastingSuggestionId={editingCastingSuggestionId}
          onGenerateCastingSuggestions={onGenerateCastingSuggestions}
          onApplyCastingSuggestion={onApplyCastingSuggestion}
          onToggleCompareCastingSuggestion={onToggleCompareCastingSuggestion}
          onIgnoreCastingSuggestion={onIgnoreCastingSuggestion}
          onStartEditCastingSuggestion={onStartEditCastingSuggestion}
          onPatchEditingCastingSuggestion={onPatchEditingCastingSuggestion}
          onApplyEditedCastingSuggestion={onApplyEditedCastingSuggestion}
          onToggleRoleBibleLock={onToggleRoleBibleLock}
          noteTargets={noteTargets}
          notesSummary={notesSummary}
          requestedNoteDraft={requestedNoteDraft}
          noteAssigneeOptions={noteAssigneeOptions}
          onCreateDirectorNote={onCreateDirectorNote}
          onReplyDirectorNote={onReplyDirectorNote}
          onUpdateDirectorNoteStatus={onUpdateDirectorNoteStatus}
          onLocateDirectorNote={onLocateDirectorNote}
          onConvertDirectorNoteToTask={onConvertDirectorNoteToTask}
          onCreateApprovalRequest={onCreateApprovalRequest}
          onApprovalDecision={onApprovalDecision}
          onLocateApprovalTarget={onLocateApprovalTarget}
          onRequestedNoteDraftHandled={onRequestedNoteDraftHandled}
          focusedStoryboardFrameId={focusedStoryboardFrameId}
          focusedRoleBibleId={focusedRoleBibleId}
          previsSourceType={previsSourceType}
          onPrevisSourceTypeChange={onPrevisSourceTypeChange}
          previsSourcePrompt={previsSourcePrompt}
          onPrevisSourcePromptChange={onPrevisSourcePromptChange}
          previsSourceImageUrl={previsSourceImageUrl}
          onPrevisSourceImageUrlChange={onPrevisSourceImageUrlChange}
          previsDuration={previsDuration}
          onPrevisDurationChange={onPrevisDurationChange}
          previsFrameCount={previsFrameCount}
          onPrevisFrameCountChange={onPrevisFrameCountChange}
          previsFrameStyle={previsFrameStyle}
          onPrevisFrameStyleChange={onPrevisFrameStyleChange}
          previsAspectRatio={previsAspectRatio}
          onPrevisAspectRatioChange={onPrevisAspectRatioChange}
          editingStoryboardFrameId={editingStoryboardFrameId}
          onEditingStoryboardFrameChange={onEditingStoryboardFrameChange}
          activeStoryboardFrame={activeStoryboardFrame}
          onSelectStoryboardFrame={onSelectStoryboardFrame}
          onDiscardStoryboardFrame={onDiscardStoryboardFrame}
          onDuplicateStoryboardFrame={onDuplicateStoryboardFrame}
          onOpenStoryboardFrameEditor={onOpenStoryboardFrameEditor}
          onPatchStoryboardFrame={onPatchStoryboardFrame}
          videoConfigFrameId={videoConfigFrameId}
          onGenerateStoryboardPrevis={onGenerateStoryboardPrevis}
          onRegenerateStoryboardFrame={onRegenerateStoryboardFrame}
          onUpdateStoryboardFramePrompt={onUpdateStoryboardFramePrompt}
          onStoryboardGenerateVideoPlaceholder={onStoryboardGenerateVideoPlaceholder}
          derivativeProvider={derivativeProvider}
          onDerivativeProviderChange={onDerivativeProviderChange}
          derivativeDuration={derivativeDuration}
          onDerivativeDurationChange={onDerivativeDurationChange}
          derivativeMovement={derivativeMovement}
          onDerivativeMovementChange={onDerivativeMovementChange}
          motionStrength={motionStrength}
          onMotionStrengthChange={onMotionStrengthChange}
          characterConsistency={characterConsistency}
          onCharacterConsistencyChange={onCharacterConsistencyChange}
          styleConsistency={styleConsistency}
          onStyleConsistencyChange={onStyleConsistencyChange}
          onCreateShotDerivativeJob={onCreateShotDerivativeJob}
          narrative={narrative}
          onApplyCinematicSkill={onApplyCinematicSkill}
          currentStage={currentStage}
        />
      </div>
    </div>
  )
}

type CanvasActionPanel = 'ai' | 'insight' | 'previs' | 'gear' | 'casting' | 'notes' | 'approval' | 'version' | 'audio' | 'camera' | 'composition' | 'perspective' | 'lighting' | 'color' | 'movement' | 'effects' | 'editing' | 'style' | 'reference'

function CanvasBottomDock({
  idea, onIdeaChange, pro, onPatchPro, globalPro, setGlobalPro, selectedStyle, onStyleChange,
  activeTemplateId, onApplyTemplate, selectedStyleId, onSelectStyle, running, onGenerateCurrent,
  suggestionShots, compareSuggestionId, gearSuggestions, compareGearSuggestionId, shots,
  onGenerateSuggestions, onGenerateGearSuggestions, onApplySuggestion, onApplyGearSuggestion,
  onToggleCompareSuggestion, onToggleCompareGearSuggestion, onIgnoreSuggestion, onIgnoreGearSuggestion,
  storyboardPrevis, characterBible, styleBible, roleBibles, castingSuggestions, compareCastingSuggestionId,
  editingCastingSuggestionId, onGenerateCastingSuggestions, onApplyCastingSuggestion, onToggleCompareCastingSuggestion,
  onIgnoreCastingSuggestion, onStartEditCastingSuggestion, onPatchEditingCastingSuggestion, onApplyEditedCastingSuggestion,
  onToggleRoleBibleLock, notes, noteTargets, notesSummary, requestedNoteDraft, noteAssigneeOptions, approvalTargets: _approvalTargets, approvalsSummary: _approvalsSummary,
  onCreateDirectorNote, onReplyDirectorNote, onUpdateDirectorNoteStatus, onLocateDirectorNote, onConvertDirectorNoteToTask, onCreateApprovalRequest: _onCreateApprovalRequest, onApprovalDecision: _onApprovalDecision, onLocateApprovalTarget: _onLocateApprovalTarget, onRequestedNoteDraftHandled,
  focusedStoryboardFrameId, focusedRoleBibleId,
  previsSourceType, onPrevisSourceTypeChange,
  previsSourcePrompt, onPrevisSourcePromptChange, previsSourceImageUrl, onPrevisSourceImageUrlChange,
  previsDuration, onPrevisDurationChange, previsFrameCount, onPrevisFrameCountChange,
  previsFrameStyle, onPrevisFrameStyleChange, previsAspectRatio, onPrevisAspectRatioChange,
  editingStoryboardFrameId, onEditingStoryboardFrameChange, activeStoryboardFrame,
  onSelectStoryboardFrame, onDiscardStoryboardFrame, onDuplicateStoryboardFrame,
  onOpenStoryboardFrameEditor, onPatchStoryboardFrame, videoConfigFrameId,
  onGenerateStoryboardPrevis, onRegenerateStoryboardFrame,
  onUpdateStoryboardFramePrompt, onStoryboardGenerateVideoPlaceholder,
  derivativeProvider, onDerivativeProviderChange, derivativeDuration, onDerivativeDurationChange,
  derivativeMovement, onDerivativeMovementChange, motionStrength, onMotionStrengthChange,
  characterConsistency, onCharacterConsistencyChange, styleConsistency, onStyleConsistencyChange,
  onCreateShotDerivativeJob, narrative, onApplyCinematicSkill, currentStage: _currentStage,
  canvasMode, insights, insightContext, onInsightAction,
  currentIntent, onIntentChange, requestedPanel, onRequestedPanelHandled,
}: {
  idea: string
  onIdeaChange: (v: string) => void
  pro: ProParams
  onPatchPro: (patch: Partial<ProParams>) => void
  globalPro: GlobalPro
  setGlobalPro: React.Dispatch<React.SetStateAction<GlobalPro>>
  selectedStyle: string
  onStyleChange: (v: string) => void
  activeTemplateId: string | null
  onApplyTemplate: (id: string) => void
  selectedStyleId: string | null
  onSelectStyle: (id: string | null) => void
  running: boolean
  onGenerateCurrent: () => void
  suggestionShots: ShotSuggestion[]
  compareSuggestionId: string | null
  gearSuggestions: ShotSuggestion[]
  compareGearSuggestionId: string | null
  shots: Shot[]
  onGenerateSuggestions: () => void
  onGenerateGearSuggestions: () => void
  onApplySuggestion: (id: string) => void
  onApplyGearSuggestion: (id: string) => void
  onToggleCompareSuggestion: (id: string) => void
  onToggleCompareGearSuggestion: (id: string) => void
  onIgnoreSuggestion: (id: string) => void
  onIgnoreGearSuggestion: (id: string) => void
  storyboardPrevis: StoryboardPrevis | null
  characterBible: CharacterBible | null
  styleBible: StyleBible | null
  previsSourceType: 'prompt' | 'image'
  onPrevisSourceTypeChange: (value: 'prompt' | 'image') => void
  previsSourcePrompt: string
  onPrevisSourcePromptChange: (value: string) => void
  previsSourceImageUrl: string
  onPrevisSourceImageUrlChange: (value: string) => void
  previsDuration: number
  onPrevisDurationChange: (value: number) => void
  previsFrameCount: (typeof PREVIS_FRAME_COUNTS)[number]
  onPrevisFrameCountChange: (value: (typeof PREVIS_FRAME_COUNTS)[number]) => void
  previsFrameStyle: (typeof PREVIS_FRAME_STYLES)[number]
  onPrevisFrameStyleChange: (value: (typeof PREVIS_FRAME_STYLES)[number]) => void
  previsAspectRatio: (typeof PREVIS_ASPECT_RATIOS)[number]
  onPrevisAspectRatioChange: (value: (typeof PREVIS_ASPECT_RATIOS)[number]) => void
  editingStoryboardFrameId: string | null
  onEditingStoryboardFrameChange: (value: string | null) => void
  activeStoryboardFrame: StoryboardFrame | null
  onSelectStoryboardFrame: (frameId: string) => void
  onDiscardStoryboardFrame: (frameId: string) => void
  onDuplicateStoryboardFrame: (frameId: string) => void
  onOpenStoryboardFrameEditor: (frameId: string, panel?: CanvasActionPanel) => void
  onPatchStoryboardFrame: (frameId: string, patch: Partial<StoryboardFrame>) => void
  videoConfigFrameId: string | null
  onGenerateStoryboardPrevis: () => void
  onRegenerateStoryboardFrame: (frameId: string) => void
  onUpdateStoryboardFramePrompt: (frameId: string, value: string) => void
  onStoryboardGenerateVideoPlaceholder: (frameId: string) => void
  derivativeProvider: (typeof DERIVATIVE_PROVIDERS)[number]
  onDerivativeProviderChange: (value: (typeof DERIVATIVE_PROVIDERS)[number]) => void
  derivativeDuration: (typeof DERIVATIVE_DURATIONS)[number]
  onDerivativeDurationChange: (value: (typeof DERIVATIVE_DURATIONS)[number]) => void
  derivativeMovement: string
  onDerivativeMovementChange: (value: string) => void
  motionStrength: number
  onMotionStrengthChange: (value: number) => void
  characterConsistency: number
  onCharacterConsistencyChange: (value: number) => void
  styleConsistency: number
  onStyleConsistencyChange: (value: number) => void
  onCreateShotDerivativeJob: (frameId: string) => void
  narrative: Narrative | null
  onApplyCinematicSkill: (suggestion: ShotSuggestion) => void
  canvasMode: CanvasMode
  insights: NarrativeInsight[]
  insightContext: InsightContext
  onInsightAction: (insight: NarrativeInsight) => void
  currentIntent?: string
  onIntentChange: (intent: string) => void
  requestedPanel: CanvasActionPanel | null
  onRequestedPanelHandled: () => void
  roleBibles: RoleBible[]
  castingSuggestions: CastingSuggestion[]
  compareCastingSuggestionId: string | null
  editingCastingSuggestionId: string | null
  onGenerateCastingSuggestions: () => void
  onApplyCastingSuggestion: (id: string) => void
  onToggleCompareCastingSuggestion: (id: string) => void
  onIgnoreCastingSuggestion: (id: string) => void
  onStartEditCastingSuggestion: (id: string | null) => void
  onPatchEditingCastingSuggestion: (patch: Partial<RoleBible>) => void
  onApplyEditedCastingSuggestion: () => void
  onToggleRoleBibleLock: (id: string) => void
  notes: DirectorNote[]
  noteTargets: Array<{ value: string; label: string; targetType: DirectorNoteTargetType; targetId: string }>
  notesSummary: { unresolvedCount: number; blockerCount: number; summary: string }
  requestedNoteDraft: DirectorNoteDraft | null
  noteAssigneeOptions: Array<{ id: string; label: string }>
  approvalTargets: ApprovalTargetOption[]
  approvalsSummary: { unresolvedCount: number; clientChangeRequestCount: number; summary: string }
  onCreateDirectorNote: (draft: DirectorNoteDraft & { content: string; category: DirectorNoteCategory; priority: DirectorNotePriority; assignedTo?: string }) => DirectorNote | null
  onReplyDirectorNote: (noteId: string, content: string) => void
  onUpdateDirectorNoteStatus: (noteId: string, status: DirectorNoteStatus) => void
  onLocateDirectorNote: (note: DirectorNote) => void
  onConvertDirectorNoteToTask: (noteId: string) => void
  onCreateApprovalRequest: (draft: { targetType: ApprovalTargetType; targetId: string; title: string; description?: string; requiredRoles: ApprovalRole[] }) => ApprovalRequest | null
  onApprovalDecision: (draft: { approvalId: string; role: ApprovalRole; status: ApprovalDecision['status']; comment: string; followUp: 'note' | 'task' | 'comment'; assignedTo?: string }) => ApprovalRequest | null
  onLocateApprovalTarget: (targetType: ApprovalTargetType, targetId: string) => void
  onRequestedNoteDraftHandled: () => void
  focusedStoryboardFrameId: string | null
  focusedRoleBibleId: string | null
  currentStage: string
}) {
  const approvals = useApprovalStore((s) => s.approvals)
  const [openPanel, setOpenPanel] = useState<CanvasActionPanel | null>(null)
  const [compareSkillSuggestionId, setCompareSkillSuggestionId] = useState<string | null>(null)
  const [ignoredSkillSuggestionIds, setIgnoredSkillSuggestionIds] = useState<string[]>([])
  const [noteFilter, setNoteFilter] = useState<'all' | 'open' | 'high' | 'blocker' | 'mine'>('all')
  const [noteDraft, setNoteDraft] = useState<{ targetValue: string; category: DirectorNoteCategory; priority: DirectorNotePriority; content: string; assignedTo: string }>({
    targetValue: noteTargets[0]?.value ?? 'project:creator-city',
    category: 'creative',
    priority: 'medium',
    content: '',
    assignedTo: '',
  })
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const activeCompareSuggestion = suggestionShots.find((suggestion) => suggestion.id === compareSuggestionId) ?? null
  const activeCompareGearSuggestion = gearSuggestions.find((suggestion) => suggestion.id === compareGearSuggestionId) ?? null
  const activeCompareCastingSuggestion = castingSuggestions.find((suggestion) => suggestion.id === compareCastingSuggestionId) ?? null
  const editingCastingSuggestion = editingCastingSuggestionId
    ? castingSuggestions.find((suggestion) => suggestion.id === editingCastingSuggestionId) ?? null
    : null
  const inferredCurrentShotId = suggestionShots[0]?.shotId ?? gearSuggestions[0]?.shotId ?? shots[0]?.id
  const activeRegistryShot = useMemo(
    () => (activeStoryboardFrame?.linkedShotId ? shots.find((shot) => shot.id === activeStoryboardFrame.linkedShotId) : null)
      ?? shots.find((shot) => shot.id === inferredCurrentShotId)
      ?? shots[0]
      ?? null,
    [activeStoryboardFrame?.linkedShotId, inferredCurrentShotId, shots]
  )
  const cinematicSkillSuggestions = useMemo(() => {
    const panelMap: Record<string, 'camera' | 'composition' | 'perspective' | 'movement' | 'effects' | 'color' | 'editing'> = {
      camera: 'camera',
      composition: 'composition',
      perspective: 'perspective',
      movement: 'movement',
      effects: 'effects',
      color: 'color',
      editing: 'editing',
    }
    const skillPanel = openPanel ? panelMap[openPanel] : undefined
    if (!skillPanel || !activeRegistryShot) return []
    return buildCinematicSkillSuggestions({
      panel: skillPanel,
      shot: activeRegistryShot,
      narrative,
      projectTemplate: activeTemplateId ? PROJECT_TEMPLATE_MAP[activeTemplateId] : undefined,
    }).filter((suggestion) => !ignoredSkillSuggestionIds.includes(suggestion.id))
  }, [activeRegistryShot, activeTemplateId, ignoredSkillSuggestionIds, narrative, openPanel])
  const activeCompareSkillSuggestion = cinematicSkillSuggestions.find((suggestion) => suggestion.id === compareSkillSuggestionId) ?? null
  const suggestionContext = suggestionShots[0]?.context
  const visibleStoryboardFrames = storyboardPrevis?.frames.filter((frame) => frame.status !== 'discarded') ?? []
  const discardedStoryboardFrames = storyboardPrevis?.frames.filter((frame) => frame.status === 'discarded') ?? []
  const filteredNotes = notes.filter((note) => {
    if (noteFilter === 'all') return true
    if (noteFilter === 'open') return note.status === 'open' || note.status === 'in-progress'
    if (noteFilter === 'high') return (note.status === 'open' || note.status === 'in-progress') && (note.priority === 'high' || note.priority === 'blocker')
    if (noteFilter === 'blocker') return (note.status === 'open' || note.status === 'in-progress') && note.priority === 'blocker'
    if (noteFilter === 'mine') return note.assignedTo === noteAssigneeOptions[0]?.id
    return true
  })
  const togglePanel = useCallback((panel: CanvasActionPanel) => {
    setOpenPanel((prev) => {
      const next = prev === panel ? null : panel
      if (next === 'ai' && suggestionShots.length === 0) onGenerateSuggestions()
      if (next === 'gear' && gearSuggestions.length === 0) onGenerateGearSuggestions()
      if (next === 'casting' && castingSuggestions.length === 0) onGenerateCastingSuggestions()
      setCompareSkillSuggestionId(null)
      return next
    })
  }, [castingSuggestions.length, gearSuggestions.length, onGenerateCastingSuggestions, onGenerateGearSuggestions, onGenerateSuggestions, suggestionShots.length])

  useEffect(() => {
    if (!requestedPanel) return
    setOpenPanel(requestedPanel)
    if (requestedPanel === 'ai' && suggestionShots.length === 0 && !compareSuggestionId) onGenerateSuggestions()
    if (requestedPanel === 'gear' && gearSuggestions.length === 0 && !compareGearSuggestionId) onGenerateGearSuggestions()
    if (requestedPanel === 'casting' && castingSuggestions.length === 0 && !compareCastingSuggestionId) onGenerateCastingSuggestions()
    onRequestedPanelHandled()
  }, [requestedPanel, onGenerateSuggestions, onGenerateGearSuggestions, onGenerateCastingSuggestions, onRequestedPanelHandled, suggestionShots.length, compareSuggestionId, gearSuggestions.length, compareGearSuggestionId, castingSuggestions.length, compareCastingSuggestionId])

  useEffect(() => {
    if (!requestedNoteDraft) return
    setOpenPanel('notes')
    setNoteDraft((prev) => ({
      ...prev,
      targetValue: `${requestedNoteDraft.targetType}:${requestedNoteDraft.targetId}`,
      category: requestedNoteDraft.category ?? prev.category,
      priority: requestedNoteDraft.priority ?? prev.priority,
      content: requestedNoteDraft.content ?? prev.content,
      assignedTo: requestedNoteDraft.assignedTo ?? prev.assignedTo,
    }))
    onRequestedNoteDraftHandled()
  }, [onRequestedNoteDraftHandled, requestedNoteDraft])

  useEffect(() => {
    if (openPanel !== 'notes') return
    const preferredValue = activeStoryboardFrame
      ? `storyboard-frame:${activeStoryboardFrame.id}`
      : inferredCurrentShotId
        ? `shot:${inferredCurrentShotId}`
        : noteDraft.targetValue
    if (noteDraft.targetValue !== preferredValue && noteDraft.content.trim().length === 0) {
      setNoteDraft((prev) => ({ ...prev, targetValue: preferredValue }))
    }
  }, [activeStoryboardFrame, inferredCurrentShotId, noteDraft.content, noteDraft.targetValue, openPanel])

  const renderSkillRegistry = useCallback((accent: string) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: `${accent}18`, color: accent }}>
          {cinematicSkillSuggestions.length} 条电影语言建议
        </span>
        {activeRegistryShot && (
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            当前镜头：{activeRegistryShot.label}
          </span>
        )}
      </div>
      {cinematicSkillSuggestions.length === 0 ? (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.42)' }}>当前上下文还没有合适的电影语言建议，先补充镜头意图或段落目标会更准确。</p>
        </div>
      ) : cinematicSkillSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[12px] font-semibold text-white/85">{suggestion.title}</p>
                {suggestion.cinematicSkillCategory && (
                  <span className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: `${accent}14`, color: accent }}>
                    {suggestion.cinematicSkillCategory}
                  </span>
                )}
              </div>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{suggestion.description ?? suggestion.styleNote}</p>
              {suggestion.fitsSequence && (
                <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(199,210,254,0.74)' }}>
                  {suggestion.fitsSequence}
                </p>
              )}
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.42)' }}>
              {suggestion.applyTarget === 'sequence' ? '段落级应用' : '镜头级应用'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>适合什么时候用</p>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.58)' }}>{suggestion.useWhen ?? '当前段落需要更明确的电影语言时。'}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>不适合什么时候用</p>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.58)' }}>{suggestion.avoidWhen ?? '当前段落已经足够明确时。'}</p>
            </div>
          </div>
          {suggestion.compareFields && (
            <div className="flex flex-wrap gap-1.5">
              {suggestion.compareFields.slice(0, 5).map((field) => (
                <span key={`${suggestion.id}-${field.label}`} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: `${accent}10`, color: 'rgba(255,255,255,0.62)', border: `1px solid ${accent}24` }}>
                  {field.label}: {field.suggested}
                </span>
              ))}
            </div>
          )}
          {suggestion.externalAdapters && suggestion.externalAdapters.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>可用外部执行器</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestion.externalAdapters.map((adapter) => (
                  <span key={`${suggestion.id}-${adapter.name}`} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.56)' }}>
                    {adapter.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] leading-[1.6]" style={{ color: 'rgba(167,243,208,0.82)' }}>
            Why: {suggestion.reasoning}
          </p>
          {suggestion.expectedEffect && (
            <p className="text-[10px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Effect: {suggestion.expectedEffect}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                onApplyCinematicSkill(suggestion)
                setIgnoredSkillSuggestionIds((prev) => prev.includes(suggestion.id) ? prev : [...prev, suggestion.id])
                setCompareSkillSuggestionId((prev) => (prev === suggestion.id ? null : prev))
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: `${accent}18`, border: `1px solid ${accent}40`, color: accent }}
            >
              应用
            </button>
            <button
              onClick={() => setCompareSkillSuggestionId((prev) => (prev === suggestion.id ? null : suggestion.id))}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
            >
              对比
            </button>
            <button
              onClick={() => {
                setIgnoredSkillSuggestionIds((prev) => prev.includes(suggestion.id) ? prev : [...prev, suggestion.id])
                setCompareSkillSuggestionId((prev) => (prev === suggestion.id ? null : prev))
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}
            >
              忽略
            </button>
          </div>
        </div>
      ))}
      <AnimatePresence>
        {activeCompareSkillSuggestion && (
          <ComparePanel
            suggestion={activeCompareSkillSuggestion}
            onApply={() => {
              onApplyCinematicSkill(activeCompareSkillSuggestion)
              setIgnoredSkillSuggestionIds((prev) => prev.includes(activeCompareSkillSuggestion.id) ? prev : [...prev, activeCompareSkillSuggestion.id])
              setCompareSkillSuggestionId(null)
            }}
            onClose={() => setCompareSkillSuggestionId(null)}
            canvasMode={canvasMode}
          />
        )}
      </AnimatePresence>
    </div>
  ), [activeCompareSkillSuggestion, activeRegistryShot, canvasMode, cinematicSkillSuggestions, onApplyCinematicSkill])

  return (
    <div className="relative">
      <AnimatePresence>
        {openPanel && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 bottom-full mb-3 z-30"
          >
            <div
              className="mx-auto max-w-4xl rounded-3xl overflow-hidden"
              style={{ background: 'rgba(10,15,26,0.84)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 72px rgba(0,0,0,0.42)', backdropFilter: 'blur(24px)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-[12px] font-semibold text-white/85">
                    {{
                      ai: 'AI 建议面板',
                      insight: 'AI 创作分析',
                      previs: '分镜预演',
                      gear: '器材签名建议',
                      casting: '选角与角色设定',
                      notes: '导演批注',
                      approval: '确认工作流',
                      version: '版本历史',
                      audio: '声音台入口',
                      camera: '镜头语言技能',
                      composition: '构图技能',
                      perspective: '视角技能',
                      lighting: '光线控制',
                      color: '色彩语言技能',
                      movement: '动作语言技能',
                      effects: '特效语言技能',
                      editing: '剪辑逻辑技能',
                      style: '风格控制',
                      reference: '参考与模型',
                    }[openPanel]}
                  </p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {openPanel === 'ai'
                      ? 'AI 只提供备选方案，应用与否始终由你决定。'
                      : openPanel === 'insight'
                        ? '像导演顾问一样指出问题与优化方向，不会自动改你的作品。'
                        : openPanel === 'previs'
                          ? '先确认分镜，再决定是否进入图生视频，避免人物和风格漂移。'
                        : openPanel === 'gear'
                          ? '器材只是创作语言建议，只有你点击应用才会写入当前镜头。'
                          : openPanel === 'casting'
                            ? 'AI 只提供角色方向与一致性方案，锁定与否始终由你决定。'
                            : openPanel === 'notes'
                              ? '批注绑定到具体对象，AI 只做摘要和优先级提示，不会自动改作品。'
                              : openPanel === 'approval'
                                ? '确认权永远属于人。系统只帮你追踪角色、版本和修改意见，不会替任何角色做确认。'
                              : openPanel === 'version'
                                ? '版本是专业创作的安全网，恢复和对比都需要你亲自确认。'
                                : openPanel === 'audio'
                                  ? '声音制作是独立工作区。系统只给声音候选和同步风险提示，不会替你锁定配音、音乐或混音。'
                                : openPanel === 'camera' || openPanel === 'composition' || openPanel === 'perspective' || openPanel === 'movement' || openPanel === 'effects' || openPanel === 'color' || openPanel === 'editing'
                                  ? '你选择的是电影语言本身，外部插件/API 只是执行器映射，系统不会自动替你应用。'
                        : '浮层式参数操作，不打扰主画布。'}
                  </p>
                </div>
                <button
                  onClick={() => setOpenPanel(null)}
                  className="w-8 h-8 rounded-full text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}
                >
                  ✕
                </button>
              </div>

              <div className="max-h-[360px] overflow-y-auto px-4 py-4">
                {openPanel === 'ai' && (
                  <div className="flex flex-col gap-3">
                    {suggestionContext && (
                      <div
                        className="rounded-2xl p-3.5 grid gap-2 md:grid-cols-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>当前段落</p>
                          <p className="text-[11px] font-semibold text-white/82 mt-1">{suggestionContext.sequenceName ?? '未命名段落'}</p>
                        </div>
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>段落目标</p>
                          <p className="text-[10px] leading-[1.5] text-white/62 mt-1">{suggestionContext.sequenceGoal ?? '待定义'}</p>
                        </div>
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>推荐风格</p>
                          <p className="text-[10px] text-white/62 mt-1">{suggestionContext.recommendedStyle ?? '当前项目风格'}</p>
                        </div>
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>推荐节奏</p>
                          <p className="text-[10px] text-white/62 mt-1">{suggestionContext.recommendedPacing ?? '按当前段落推进'}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
                        {suggestionShots.length} 条建议
                      </span>
                      <button
                        onClick={onGenerateSuggestions}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.24)', color: '#6ee7b7' }}
                      >
                        刷新建议
                      </button>
                    </div>
                    {suggestionShots.map((suggestion) => {
                      const current = shots.find((shot) => shot.id === suggestion.shotId)
                      const suggestedParams = summarizeSuggestionParams(suggestion.suggestedShot.presetParams ?? {})
                      const currentParams = summarizeSuggestionParams(current?.presetParams ?? {})

                      return (
                        <div
                          key={suggestion.id}
                          className="rounded-2xl p-4 flex flex-col gap-3"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-semibold text-white/85">{suggestion.shotLabel} · {suggestion.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-medium"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.42)' }}
                                >
                                  {suggestion.intent}
                                </span>
                              </div>
                              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.35)' }}>{suggestion.styleNote}</p>
                              {canvasMode !== 'simple' && (
                                <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(167,243,208,0.82)' }}>
                                  Why: {suggestion.reasoning}
                                </p>
                              )}
                              {suggestion.fitsSequence && (
                                <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(199,210,254,0.75)' }}>
                                  Fits: {suggestion.fitsSequence}
                                </p>
                              )}
                              {suggestion.expectedEffect && (
                                <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                  Effect: {suggestion.expectedEffect}
                                </p>
                              )}
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                              {suggestion.suggestedShot.style}
                            </span>
                          </div>

                          <div className={`grid gap-2 ${canvasMode === 'simple' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-5'}`}>
                            {suggestedParams.slice(0, canvasMode === 'simple' ? 3 : 5).map((item) => (
                              <div
                                key={`${suggestion.id}-${item.label}`}
                                className="rounded-xl px-2.5 py-2"
                                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.16)' }}
                              >
                                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{item.label}</p>
                                <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#c7d2fe' }}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                          {current && canvasMode === 'pro' && (
                            <div className="flex flex-wrap gap-1.5">
                              {currentParams.map((item) => (
                                <span key={`current-${suggestion.id}-${item.label}`} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.42)' }}>
                                  当前: {item.label} {item.value}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => onApplySuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                            >
                              应用
                            </button>
                            <button
                              onClick={() => onToggleCompareSuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                            >
                              对比
                            </button>
                            <button
                              onClick={() => onIgnoreSuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}
                            >
                              忽略
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    <AnimatePresence>
                      {activeCompareSuggestion && (
                        <ComparePanel
                          suggestion={activeCompareSuggestion}
                          onApply={onApplySuggestion}
                          onClose={() => onToggleCompareSuggestion(activeCompareSuggestion.id)}
                          canvasMode={canvasMode}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {openPanel === 'insight' && (
                  <div className="flex flex-col gap-3">
                    <div
                      className="rounded-2xl p-3.5 grid gap-2 md:grid-cols-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>模板</p>
                        <p className="text-[11px] font-semibold text-white/82 mt-1">{insightContext.templateId ?? '默认结构'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>叙事类型</p>
                        <p className="text-[10px] text-white/62 mt-1">{insightContext.narrativeType ?? 'commercial'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>推荐风格</p>
                        <p className="text-[10px] text-white/62 mt-1">{insightContext.recommendedStyle ?? '当前项目风格'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>推荐节奏</p>
                        <p className="text-[10px] text-white/62 mt-1">{insightContext.recommendedPacing ?? '按当前项目推进'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#c7d2fe' }}>
                        {insights.length} 条结构化洞察
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        查看问题，不会自动改动内容
                      </span>
                    </div>
                    {insights.map((insight) => (
                      <div
                        key={insight.id}
                        className="rounded-2xl p-4 flex flex-col gap-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold"
                              style={{
                                background: `${INSIGHT_LEVEL_META[insight.level].accent}14`,
                                border: `1px solid ${INSIGHT_LEVEL_META[insight.level].accent}30`,
                                color: INSIGHT_LEVEL_META[insight.level].accent,
                              }}
                            >
                              {INSIGHT_LEVEL_META[insight.level].label}
                            </span>
                            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.24)' }}>{insight.type}</span>
                          </div>
                          <p className="text-[12px] font-semibold text-white/85">{insight.title}</p>
                          <p className="text-[10px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                            {insight.message}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onInsightAction(insight)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                          >
                            {insight.suggestedAction.label}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {openPanel === 'previs' && (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-2xl p-3.5 grid gap-3 md:grid-cols-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="md:col-span-2">
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>输入来源</p>
                        <div className="flex gap-2 mt-1.5">
                          {(['prompt', 'image'] as const).map((type) => {
                            const active = previsSourceType === type
                            return (
                              <button
                                key={type}
                                onClick={() => onPrevisSourceTypeChange(type)}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
                                style={{
                                  background: active ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                                  border: active ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(255,255,255,0.07)',
                                  color: active ? '#c7d2fe' : 'rgba(255,255,255,0.58)',
                                }}
                              >
                                {type === 'prompt' ? '从提示词生成' : '从参考图生成'}
                              </button>
                            )
                          })}
                        </div>
                        {previsSourceType === 'prompt' ? (
                          <textarea
                            value={previsSourcePrompt}
                            onChange={(e) => onPrevisSourcePromptChange(e.target.value)}
                            placeholder="输入用于分镜预演的核心提示词，默认会参考当前 shot 的 idea。"
                            rows={3}
                            className="w-full rounded-xl px-3 py-2 mt-2 text-[11px] outline-none resize-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}
                          />
                        ) : (
                          <input
                            value={previsSourceImageUrl}
                            onChange={(e) => onPrevisSourceImageUrlChange(e.target.value)}
                            placeholder="粘贴参考图 URL，用于建立人物与风格一致性。"
                            className="w-full rounded-xl px-3 py-2 mt-2 text-[11px] outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>duration</p>
                        <select
                          value={previsDuration}
                          onChange={(e) => onPrevisDurationChange(Number(e.target.value))}
                          className="w-full text-[11px] rounded-xl px-3 py-2 mt-1.5 outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                        >
                          {[10, 15, 20].map((value) => <option key={value} value={value}>{value}s</option>)}
                        </select>
                        <p className="text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>frame count</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {PREVIS_FRAME_COUNTS.map((count) => (
                            <button
                              key={count}
                              onClick={() => onPrevisFrameCountChange(count)}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{
                                background: previsFrameCount === count ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                                border: previsFrameCount === count ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(255,255,255,0.07)',
                                color: previsFrameCount === count ? '#c7d2fe' : 'rgba(255,255,255,0.58)',
                              }}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>frame style</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {PREVIS_FRAME_STYLES.map((style) => (
                            <button
                              key={style}
                              onClick={() => onPrevisFrameStyleChange(style)}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{
                                background: previsFrameStyle === style ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                                border: previsFrameStyle === style ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(255,255,255,0.07)',
                                color: previsFrameStyle === style ? '#c7d2fe' : 'rgba(255,255,255,0.58)',
                              }}
                            >
                              {style === 'comic' ? '漫画分镜' : style === 'storyboard' ? 'storyboard' : 'cinematic'}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>aspect ratio</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {PREVIS_ASPECT_RATIOS.map((ratio) => (
                            <button
                              key={ratio}
                              onClick={() => onPrevisAspectRatioChange(ratio)}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{
                                background: previsAspectRatio === ratio ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                                border: previsAspectRatio === ratio ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(255,255,255,0.07)',
                                color: previsAspectRatio === ratio ? '#c7d2fe' : 'rgba(255,255,255,0.58)',
                              }}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-2 flex-wrap">
                        {characterBible && (
                          <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
                            Character Bible · {characterBible.name}
                          </span>
                        )}
                        {styleBible && (
                          <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
                            Style Bible · {styleBible.name}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={onGenerateStoryboardPrevis}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                        >
                          生成分镜预演
                        </button>
                        <button
                          onClick={onGenerateStoryboardPrevis}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}
                        >
                          快速生成草案
                        </button>
                      </div>
                    </div>

                    {storyboardPrevis && (
                      <div className="flex flex-col gap-3">
                        <div
                          className="rounded-2xl p-3.5 grid gap-2 md:grid-cols-3"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>预演状态</p>
                            <p className="text-[11px] font-semibold text-white/82 mt-1">{storyboardPrevis.status}</p>
                          </div>
                          <div>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>已保留帧</p>
                            <p className="text-[11px] font-semibold text-white/82 mt-1">
                              {storyboardPrevis.frames.filter((frame) => frame.status === 'selected').length} / {storyboardPrevis.frames.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>约束</p>
                            <p className="text-[10px] text-white/62 mt-1">先挑选需要的单帧，再决定是否衍生视频，不会自动批量生成。</p>
                          </div>
                        </div>

                        <StoryboardAdapterPanel storyboardPrevis={storyboardPrevis} />

                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {visibleStoryboardFrames.map((frame) => (
                            <div
                              key={frame.id}
                              className="flex-shrink-0 w-[270px] rounded-2xl p-3"
                              style={{
                                background: activeStoryboardFrame?.id === frame.id || focusedStoryboardFrameId === frame.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                                border: activeStoryboardFrame?.id === frame.id || focusedStoryboardFrameId === frame.id ? '1px solid rgba(99,102,241,0.26)' : '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: storyboardPrevis.aspectRatio.replace(':', ' / ') }}>
                                {frame.imageUrl ? (
                                  <Image
                                    src={frame.imageUrl}
                                    alt={frame.description}
                                    fill
                                    unoptimized
                                    sizes="270px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <span style={{ fontSize: 28, opacity: 0.2 }}>🖼️</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2 mt-3">
                                <span className="text-[10px] font-semibold text-white/82">{frame.timecode}</span>
                                <span
                                  className="px-2 py-1 rounded-lg text-[9px]"
                                  style={{
                                    background: frame.status === 'selected' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                                    color: frame.status === 'selected' ? '#a7f3d0' : 'rgba(255,255,255,0.48)',
                                  }}
                                >
                                  {frame.status}
                                </span>
                              </div>

                              <p className="text-[10px] mt-2 leading-[1.6] text-white/78">{frame.description}</p>
                              <div className="mt-2">
                                <NoteBadge summary={summarizeTargetNotes(notes, 'storyboard-frame', frame.id)} />
                              </div>
                              <div className="mt-1">
                                <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'storyboard-frame', frame.id)} />
                              </div>
                              <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.34)' }}>
                                {frame.intent} · {frame.shotType} · {frame.movement}
                              </p>
                              {!!frame.cameraModel && (
                                <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                  {[frame.cameraModel, frame.lensModel].filter(Boolean).join(' · ')}
                                </p>
                              )}

                              {editingStoryboardFrameId === frame.id && (
                                <textarea
                                  value={frame.imagePrompt}
                                  onChange={(e) => onUpdateStoryboardFramePrompt(frame.id, e.target.value)}
                                  rows={4}
                                  className="w-full rounded-xl px-3 py-2 mt-3 text-[10px] outline-none resize-none"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)' }}
                                />
                              )}

                              {videoConfigFrameId === frame.id && (
                                <div className="mt-3 rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    <select
                                      value={derivativeProvider}
                                      onChange={(e) => onDerivativeProviderChange(e.target.value as (typeof DERIVATIVE_PROVIDERS)[number])}
                                      className="w-full rounded-lg px-2.5 py-2 text-[10px] outline-none"
                                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
                                    >
                                      {DERIVATIVE_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                                    </select>
                                    <select
                                      value={derivativeDuration}
                                      onChange={(e) => onDerivativeDurationChange(Number(e.target.value) as (typeof DERIVATIVE_DURATIONS)[number])}
                                      className="w-full rounded-lg px-2.5 py-2 text-[10px] outline-none"
                                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
                                    >
                                      {DERIVATIVE_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
                                    </select>
                                  </div>
                                  <input
                                    value={derivativeMovement}
                                    onChange={(e) => onDerivativeMovementChange(e.target.value)}
                                    placeholder="输入单帧衍生的运动说明"
                                    className="w-full rounded-lg px-2.5 py-2 text-[10px] outline-none"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
                                  />
                                  <SliderRow label="Motion Strength" value={motionStrength} min={0} max={100} onChange={onMotionStrengthChange} accent="#93c5fd" />
                                  <SliderRow label="Character Consistency" value={characterConsistency} min={0} max={100} onChange={onCharacterConsistencyChange} accent="#a7f3d0" />
                                  <SliderRow label="Style Consistency" value={styleConsistency} min={0} max={100} onChange={onStyleConsistencyChange} accent="#fbbf24" />
                                  <button
                                    onClick={() => onCreateShotDerivativeJob(frame.id)}
                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                    style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                                  >
                                    生成此镜头
                                  </button>
                                </div>
                              )}

                              <div className="flex gap-2 flex-wrap mt-3">
                                <button
                                  onClick={() => onSelectStoryboardFrame(frame.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                                >
                                  {frame.status === 'selected' ? '已保留' : '保留'}
                                </button>
                                <button
                                  onClick={() => onDiscardStoryboardFrame(frame.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}
                                >
                                  删除
                                </button>
                                <button
                                  onClick={() => onDuplicateStoryboardFrame(frame.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                                >
                                  复制
                                </button>
                                <button
                                  onClick={() => onOpenStoryboardFrameEditor(frame.id, 'camera')}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                                >
                                  编辑镜头
                                </button>
                                <button
                                  onClick={() => onStoryboardGenerateVideoPlaceholder(frame.id)}
                                  disabled={frame.status !== 'selected'}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40"
                                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#a7f3d0' }}
                                >
                                  生成视频
                                </button>
                                <button
                                  onClick={() => onEditingStoryboardFrameChange(editingStoryboardFrameId === frame.id ? null : frame.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                                >
                                  编辑提示词
                                </button>
                                <button
                                  onClick={() => onRegenerateStoryboardFrame(frame.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                                >
                                  重生成
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {discardedStoryboardFrames.length > 0 && (
                          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[10px] font-semibold text-white/74">已删除候选 {discardedStoryboardFrames.length}</p>
                            <div className="flex gap-2 flex-wrap mt-2">
                              {discardedStoryboardFrames.map((frame) => (
                                <button
                                  key={`discarded-${frame.id}`}
                                  onClick={() => onPatchStoryboardFrame(frame.id, { status: 'draft' })}
                                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.52)' }}
                                >
                                  恢复 {frame.timecode}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {openPanel === 'gear' && (
                  <div className="flex flex-col gap-3">
                    {activeStoryboardFrame ? (
                      <div className="rounded-2xl p-4 grid gap-3 md:grid-cols-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-semibold text-white/82">正在编辑分镜单帧 · {activeStoryboardFrame.timecode}</p>
                          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>器材签名只作用于当前单帧，不会自动影响其他 frame 或 timeline。</p>
                        </div>
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>摄影机</p>
                          <select
                            value={activeStoryboardFrame.cameraModel ?? ''}
                            onChange={(e) => {
                              const selected = CAMERA_SIGNATURES.find((item) => item.model === e.target.value)
                              onPatchStoryboardFrame(activeStoryboardFrame.id, {
                                cameraBrand: selected?.brand,
                                cameraModel: selected?.model || undefined,
                              })
                            }}
                            className="w-full rounded-xl px-3 py-2 mt-1.5 text-[11px] outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                          >
                            <option value="">未指定</option>
                            {CAMERA_SIGNATURES.map((item) => <option key={item.model} value={item.model}>{item.brand} {item.model}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>镜头</p>
                          <select
                            value={activeStoryboardFrame.lensModel ?? ''}
                            onChange={(e) => {
                              const selected = LENS_SIGNATURES.find((item) => item.model === e.target.value)
                              onPatchStoryboardFrame(activeStoryboardFrame.id, {
                                lensBrand: selected?.brand,
                                lensModel: selected?.model || undefined,
                              })
                            }}
                            className="w-full rounded-xl px-3 py-2 mt-1.5 text-[11px] outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                          >
                            <option value="">未指定</option>
                            {LENS_SIGNATURES.map((item) => <option key={item.model} value={item.model}>{item.brand} {item.model}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div
                      className="rounded-2xl p-3.5 grid gap-2 md:grid-cols-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>当前段落</p>
                        <p className="text-[11px] font-semibold text-white/82 mt-1">{suggestionContext?.sequenceName ?? insightContext.sequences[0]?.name ?? '当前段落'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>段落目标</p>
                        <p className="text-[10px] text-white/62 mt-1">{suggestionContext?.sequenceGoal ?? insightContext.sequences[0]?.goal ?? '待定义'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>推荐风格</p>
                        <p className="text-[10px] text-white/62 mt-1">{insightContext.recommendedStyle ?? '当前项目风格'}</p>
                      </div>
                      <div>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>当前器材</p>
                        <p className="text-[10px] text-white/62 mt-1">
                          {[shots.find((shot) => shot.id === gearSuggestions[0]?.shotId)?.cameraModel, shots.find((shot) => shot.id === gearSuggestions[0]?.shotId)?.lensModel].filter(Boolean).join(' · ') || '尚未指定'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.12)', color: '#fde68a' }}>
                        {gearSuggestions.length} 组器材建议
                      </span>
                      <button
                        onClick={onGenerateGearSuggestions}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.24)', color: '#fde68a' }}
                      >
                        刷新器材建议
                      </button>
                    </div>

                    {gearSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="rounded-2xl p-4 flex flex-col gap-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-white/85">{suggestion.title}</p>
                            <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {suggestion.styleNote}
                            </p>
                            <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(253,230,138,0.88)' }}>
                              Why: {suggestion.reasoning}
                            </p>
                            {suggestion.expectedEffect && (
                              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                Effect: {suggestion.expectedEffect}
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.14)', color: '#fde68a' }}>
                            器材签名
                          </span>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>特征说明</p>
                            <p className="text-[10px] mt-1 leading-[1.6] text-white/65">{suggestion.characteristics?.join(' · ') || '强调当前段落的影像气质。'}</p>
                          </div>
                          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Best For</p>
                            <p className="text-[10px] mt-1 leading-[1.6] text-white/65">{suggestion.bestFor?.join(' · ') || suggestion.fitsSequence}</p>
                          </div>
                          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Look Tags</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(suggestion.lookTags ?? []).map((tag) => (
                                <span key={`${suggestion.id}-${tag}`} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(251,191,36,0.08)', color: '#fde68a' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => onApplyGearSuggestion(suggestion.id)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                          >
                            应用
                          </button>
                          <button
                            onClick={() => onToggleCompareGearSuggestion(suggestion.id)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                          >
                            对比
                          </button>
                          <button
                            onClick={() => onIgnoreGearSuggestion(suggestion.id)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}
                          >
                            忽略
                          </button>
                          <button
                            onClick={() => setOpenPanel('camera')}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', color: '#fde68a' }}
                          >
                            展开细调
                          </button>
                        </div>
                      </div>
                    ))}

                    <AnimatePresence>
                      {activeCompareGearSuggestion && (
                        <ComparePanel
                          suggestion={activeCompareGearSuggestion}
                          onApply={onApplyGearSuggestion}
                          onClose={() => onToggleCompareGearSuggestion(activeCompareGearSuggestion.id)}
                          canvasMode={canvasMode}
                        />
                      )}
                    </AnimatePresence>
                      </>
                    )}
                  </div>
                )}

                {openPanel === 'casting' && (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-2xl p-3.5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">当前角色列表</p>
                        <div className="flex flex-col gap-2 mt-2">
                          {roleBibles.length === 0 ? (
                            <p className="text-[10px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                              还没有锁定角色。建议先锁定一位核心角色，再进入分镜和视频衍生，以提升长视频人物一致性。
                            </p>
                          ) : roleBibles.map((role) => {
                            const locked = role.status === 'locked'
                            return (
                              <div
                                key={role.id}
                                className="rounded-xl px-3 py-3 flex items-start justify-between gap-3"
                                style={{ background: focusedRoleBibleId === role.id ? 'rgba(99,102,241,0.08)' : locked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: focusedRoleBibleId === role.id ? '1px solid rgba(99,102,241,0.24)' : locked ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,255,255,0.05)' }}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[11px] font-semibold text-white/84">{role.name}</p>
                                    <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: locked ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.05)', color: locked ? '#a7f3d0' : 'rgba(255,255,255,0.46)' }}>
                                      {locked ? 'locked' : 'draft'}
                                    </span>
                                  </div>
                                  <div className="mt-1">
                                    <NoteBadge summary={summarizeTargetNotes(notes, 'role-bible', role.id)} />
                                  </div>
                                  <div className="mt-1">
                                    <ApprovalBadge summary={summarizeTargetApprovals(approvals, 'role-bible', role.id)} />
                                  </div>
                                  <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>{role.roleType} · {role.performanceStyle.actingStyle}</p>
                                  <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                    consistencyKey: {role.consistencyKey}
                                  </p>
                                  {role.referenceImageUrl && (
                                    <p className="text-[9px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                      reference: {role.referenceImageUrl}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => onToggleRoleBibleLock(role.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold"
                                  style={{ background: locked ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.12)', border: locked ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,185,129,0.2)', color: locked ? 'rgba(255,255,255,0.62)' : '#a7f3d0' }}
                                >
                                  {locked ? '解锁角色' : '锁定角色'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-semibold text-white/82">角色一致性提示</p>
                        <p className="text-[9px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                          {roleBibles.some((role) => role.status === 'locked')
                            ? '已存在锁定角色，新的分镜预演和视频镜头会优先继承这位角色的一致性信息。'
                            : '目前还没有锁定角色。系统仍允许你继续生成分镜，但会在后续审片与阶段判断中提示一致性风险。'}
                        </p>
                        <button
                          onClick={onGenerateCastingSuggestions}
                          className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                        >
                          刷新角色建议
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(249,168,212,0.12)', color: '#f9a8d4' }}>
                        {castingSuggestions.length} 条选角建议
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>AI 只给方向，不会自动覆盖已锁定角色。</span>
                    </div>

                    {castingSuggestions.map((suggestion) => {
                      const role = suggestion.suggestedRoleBible
                      const isEditing = editingCastingSuggestion?.id === suggestion.id
                      return (
                        <div
                          key={suggestion.id}
                          className="rounded-2xl p-4 flex flex-col gap-3"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-white/85">{suggestion.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.54)' }}>
                                  {suggestion.roleType}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: 'rgba(99,102,241,0.12)', color: '#c7d2fe' }}>
                                  {role.performanceStyle.actingStyle}
                                </span>
                              </div>
                              <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                性格: {suggestion.personality}
                              </p>
                              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                外观方向: {suggestion.appearanceDirection}
                              </p>
                              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                表演气质: {suggestion.performanceDirection}
                              </p>
                              <p className="text-[10px] mt-2 leading-[1.6]" style={{ color: 'rgba(249,168,212,0.82)' }}>
                                Why: {suggestion.reasoning}
                              </p>
                              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                Effect: {suggestion.expectedEffect}
                              </p>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,168,212,0.12)', color: '#f9a8d4' }}>
                              {role.appearance.ageRange}
                            </span>
                          </div>

                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>外观</p>
                              <p className="text-[10px] mt-1 leading-[1.6] text-white/65">{role.appearance.hair} · {role.appearance.bodyType ?? '自然平衡'}</p>
                            </div>
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>服装方向</p>
                              <p className="text-[10px] mt-1 leading-[1.6] text-white/65">{suggestion.wardrobeDirection}</p>
                            </div>
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>一致性键</p>
                              <p className="text-[10px] mt-1 leading-[1.6] text-white/65">{role.consistencyKey}</p>
                            </div>
                          </div>

                          {activeCompareCastingSuggestion?.id === suggestion.id && (
                            <div className="rounded-xl p-3 grid gap-3 md:grid-cols-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>当前角色</p>
                                {roleBibles[0] ? (
                                  <>
                                    <p className="text-[11px] mt-1 font-semibold text-white/82">{roleBibles[0].name}</p>
                                    <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                      {roleBibles[0].personality} · {roleBibles[0].appearance.wardrobe}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-[10px] mt-1 text-white/42">当前还没有角色设定</p>
                                )}
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>AI 建议角色</p>
                                <p className="text-[11px] mt-1 font-semibold text-white/82">{role.name}</p>
                                <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                  {role.personality} · {role.appearance.wardrobe}
                                </p>
                              </div>
                            </div>
                          )}

                          {isEditing && (
                            <div className="grid gap-2 md:grid-cols-2">
                              <input
                                value={role.name}
                                onChange={(e) => onPatchEditingCastingSuggestion({ name: e.target.value })}
                                className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                              />
                              <input
                                value={role.appearance.wardrobe}
                                onChange={(e) => onPatchEditingCastingSuggestion({ appearance: { ...role.appearance, wardrobe: e.target.value } })}
                                className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                              />
                            </div>
                          )}

                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => onApplyCastingSuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                            >
                              应用
                            </button>
                            <button
                              onClick={() => onToggleCompareCastingSuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                            >
                              对比
                            </button>
                            <button
                              onClick={() => onIgnoreCastingSuggestion(suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}
                            >
                              忽略
                            </button>
                            <button
                              onClick={() => onStartEditCastingSuggestion(isEditing ? null : suggestion.id)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                              style={{ background: 'rgba(249,168,212,0.08)', border: '1px solid rgba(249,168,212,0.18)', color: '#f9a8d4' }}
                            >
                              {isEditing ? '取消编辑' : '编辑后应用'}
                            </button>
                            {isEditing && (
                              <button
                                onClick={onApplyEditedCastingSuggestion}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#a7f3d0' }}
                              >
                                应用编辑版本
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {openPanel === 'notes' && (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-2xl p-3.5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">AI 批注摘要</p>
                        <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                          当前有 {notesSummary.unresolvedCount} 条未解决批注，其中 {notesSummary.blockerCount} 条为 blocker。
                        </p>
                        <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(251,191,36,0.82)' }}>
                          {notesSummary.summary}
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-semibold text-white/82">筛选</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[
                            { id: 'all', label: '全部' },
                            { id: 'open', label: '未解决' },
                            { id: 'high', label: '高优先级' },
                            { id: 'blocker', label: 'blocker' },
                            { id: 'mine', label: '我的任务' },
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setNoteFilter(item.id as typeof noteFilter)}
                              className="px-2.5 py-1 rounded-lg text-[9px] font-semibold"
                              style={{ background: noteFilter === item.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)', border: noteFilter === item.id ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(255,255,255,0.06)', color: noteFilter === item.id ? '#c7d2fe' : 'rgba(255,255,255,0.52)' }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[10px] font-semibold text-white/82">新增导演批注</p>
                      <div className="grid gap-2 mt-3 md:grid-cols-2">
                        <select
                          value={noteDraft.targetValue}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, targetValue: e.target.value }))}
                          className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                        >
                          {noteTargets.map((target) => (
                            <option key={target.value} value={target.value}>{target.label}</option>
                          ))}
                        </select>
                        <select
                          value={noteDraft.category}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, category: e.target.value as DirectorNoteCategory }))}
                          className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                        >
                          {NOTE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <select
                          value={noteDraft.priority}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, priority: e.target.value as DirectorNotePriority }))}
                          className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                        >
                          {NOTE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                        <select
                          value={noteDraft.assignedTo}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, assignedTo: e.target.value }))}
                          className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                        >
                          <option value="">暂不指定</option>
                          {noteAssigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </div>
                      <textarea
                        value={noteDraft.content}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, content: e.target.value }))}
                        placeholder="写下导演批注，例如：这个镜头需要更明确的角色动机，或者当前转场会削弱品牌主张。"
                        rows={3}
                        className="w-full rounded-2xl px-4 py-3 mt-3 text-[12px] outline-none resize-none"
                        style={{ background: 'rgba(7,11,20,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)' }}
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            const [targetType, targetId] = noteDraft.targetValue.split(':')
                            if (!targetType || !targetId) return
                            const created = onCreateDirectorNote({
                              targetType: targetType as DirectorNoteTargetType,
                              targetId,
                              category: noteDraft.category,
                              priority: noteDraft.priority,
                              content: noteDraft.content,
                              assignedTo: noteDraft.assignedTo || undefined,
                            })
                            if (!created) return
                            setNoteDraft((prev) => ({ ...prev, content: '', priority: 'medium' }))
                          }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                        >
                          保存批注
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {filteredNotes.length === 0 ? (
                        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.42)' }}>当前筛选下还没有批注。</p>
                        </div>
                      ) : filteredNotes.map((note) => {
                        const priorityMeta = NOTE_PRIORITY_META[note.priority]
                        const statusMeta = NOTE_STATUS_META[note.status]
                        const targetLabel = noteTargets.find((target) => target.targetType === note.targetType && target.targetId === note.targetId)?.label ?? `${note.targetType} · ${note.targetId}`
                        return (
                          <div key={note.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: priorityMeta.background, color: priorityMeta.color }}>{note.priority}</span>
                                  <span className="px-2 py-0.5 rounded-lg text-[9px]" style={{ background: statusMeta.background, color: statusMeta.color }}>{note.status}</span>
                                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{note.category}</span>
                                </div>
                                <p className="text-[10px] mt-2 font-semibold text-white/82">{targetLabel}</p>
                                <p className="text-[10px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>{note.content}</p>
                                <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                  by {note.createdBy} · assigned to {note.assignedTo || '未指定'} · {new Date(note.createdAt).toLocaleString()}
                                </p>
                                {note.aiSummary && (
                                  <p className="text-[9px] mt-2 leading-[1.6]" style={{ color: 'rgba(251,191,36,0.82)' }}>
                                    AI: {note.aiSummary}
                                  </p>
                                )}
                              </div>
                              <NoteBadge summary={summarizeTargetNotes(notes, note.targetType, note.targetId)} />
                            </div>

                            <div className="flex gap-2 flex-wrap mt-3">
                              <button onClick={() => onLocateDirectorNote(note)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>
                                定位到对象
                              </button>
                              <button onClick={() => onUpdateDirectorNoteStatus(note.id, 'resolved')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>
                                标记解决
                              </button>
                              <button onClick={() => onUpdateDirectorNoteStatus(note.id, 'dismissed')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}>
                                忽略
                              </button>
                              <button onClick={() => onConvertDirectorNoteToTask(note.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}>
                                转成任务
                              </button>
                            </div>

                            <div className="mt-3 flex flex-col gap-2">
                              {note.replies.map((reply) => (
                                <div key={reply.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{reply.authorId} · {new Date(reply.createdAt).toLocaleString()}</p>
                                  <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{reply.content}</p>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  value={replyDrafts[note.id] ?? ''}
                                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [note.id]: e.target.value }))}
                                  placeholder="回复这条批注…"
                                  className="flex-1 rounded-xl px-3 py-2 text-[10px] outline-none"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                                />
                                <button
                                  onClick={() => {
                                    onReplyDirectorNote(note.id, replyDrafts[note.id] ?? '')
                                    setReplyDrafts((prev) => ({ ...prev, [note.id]: '' }))
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}
                                >
                                  回复
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {openPanel === 'audio' && (
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[11px] font-semibold text-white/84">Audio Desk</p>
                    <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      声音台用于管理台词、配音候选、口型同步、OST、音效和声画同步审查。它和主画布解耦，避免把声音参数堆回镜头面板。
                    </p>
                    <div className="grid gap-2 mt-4 md:grid-cols-2">
                      <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-semibold text-white/82">当前进度</p>
                        <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.36)' }}>声音台会把台词、voice take、lip sync、配乐和音效拆开处理，先审再用，不自动混成最终成片。</p>
                      </div>
                      <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-semibold text-white/82">工作原则</p>
                        <p className="text-[9px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.36)' }}>AI 只能生成候选与风险提示。真正的试听、选择、送入剪辑台和交付前确认，都必须由你手动决定。</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setOpenPanel(null)
                          onRequestedPanelHandled()
                          window.requestAnimationFrame(() => {
                            const event = new CustomEvent('creator-city-open-audio')
                            window.dispatchEvent(event)
                          })
                        }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                      >
                        打开声音台
                      </button>
                    </div>
                  </div>
                )}

                {openPanel === 'composition' && renderSkillRegistry('#f9a8d4')}

                {openPanel === 'perspective' && renderSkillRegistry('#93c5fd')}

                {openPanel === 'camera' && (
                  <div className="flex flex-col gap-4">
                    {renderSkillRegistry('#a5b4fc')}
                    <div className="grid gap-4 md:grid-cols-2">
                      <ChipSelect
                        label="景别"
                        options={[...SHOT_FRAMES]}
                        value={activeStoryboardFrame?.shotType ?? pro.framing}
                        onChange={(v) => activeStoryboardFrame ? onPatchStoryboardFrame(activeStoryboardFrame.id, { shotType: v }) : onPatchPro({ framing: v })}
                      />
                      {canvasMode !== 'simple' && (
                        <ChipSelect label="片段时长" options={DURATIONS} value={pro.duration} onChange={(v) => onPatchPro({ duration: v })} />
                      )}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>角度</span>
                        <select
                          value={activeStoryboardFrame?.angle ?? pro.angle}
                          onChange={(e) => activeStoryboardFrame ? onPatchStoryboardFrame(activeStoryboardFrame.id, { angle: e.target.value }) : onPatchPro({ angle: e.target.value })}
                          className="w-full text-[11px] rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe' }}
                        >
                          {ANGLES.map((angle) => <option key={angle} value={angle}>{angle}</option>)}
                        </select>
                      </div>
                      {canvasMode !== 'simple' && !activeStoryboardFrame && (
                        <div className="md:col-span-2">
                          <FocalStrip value={pro.focalLength} onChange={(v) => onPatchPro({ focalLength: v })} />
                        </div>
                      )}
                      {activeStoryboardFrame && (
                        <div className="md:col-span-2">
                          <SliderRow label="焦距" value={activeStoryboardFrame.focalLength} min={18} max={135} unit="mm" onChange={(v) => onPatchStoryboardFrame(activeStoryboardFrame.id, { focalLength: v })} accent="#a5b4fc" />
                        </div>
                      )}
                      {canvasMode === 'pro' && (
                        <div className="md:col-span-2">
                          <ApertureDial value={pro.aperture} onChange={(v) => onPatchPro({ aperture: v })} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {openPanel === 'lighting' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChipSelect label="光源类型" options={[...LIGHTING_TYPES]} value={activeStoryboardFrame?.lighting ?? pro.lightingType} onChange={(v) => activeStoryboardFrame ? onPatchStoryboardFrame(activeStoryboardFrame.id, { lighting: v }) : onPatchPro({ lightingType: v })} />
                    {canvasMode !== 'simple' && (
                      <ChipSelect label="灯位" options={[...LIGHTING_POSITIONS]} value={pro.lightingPosition} onChange={(v) => onPatchPro({ lightingPosition: v })} />
                    )}
                    {!activeStoryboardFrame && (
                    <div className="md:col-span-2">
                      <SliderRow label="光照强度" value={pro.lightingIntensity} min={0} max={100} unit="%" onChange={(v) => onPatchPro({ lightingIntensity: v })} accent="#fbbf24" />
                    </div>
                    )}
                  </div>
                )}

                {openPanel === 'color' && (
                  <div className="flex flex-col gap-4">
                    {renderSkillRegistry('#c084fc')}
                    <ChipSelect label="色彩 LUT" options={[...COLOR_LUTS]} value={activeStoryboardFrame?.colorGrade ?? pro.colorLUT} onChange={(v) => activeStoryboardFrame ? onPatchStoryboardFrame(activeStoryboardFrame.id, { colorGrade: v }) : onPatchPro({ colorLUT: v })} />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>色温</span>
                        <span className="text-[11px] font-semibold" style={{ color: '#fde68a' }}>{pro.colorTemp}K</span>
                      </div>
                      <input
                        type="range"
                        min={2000}
                        max={8000}
                        step={100}
                        value={pro.colorTemp}
                        onChange={(e) => onPatchPro({ colorTemp: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    {canvasMode !== 'simple' && (
                      <>
                        <SliderRow label="对比度" value={pro.contrast} min={0} max={100} onChange={(v) => onPatchPro({ contrast: v })} accent="#e2e8f0" />
                        <SliderRow label="饱和度" value={pro.saturation} min={0} max={100} onChange={(v) => onPatchPro({ saturation: v })} accent="#c084fc" />
                      </>
                    )}
                    {canvasMode === 'pro' && (
                      <>
                        <SliderRow label="高光" value={pro.highlights} min={0} max={100} onChange={(v) => onPatchPro({ highlights: v })} accent="#fde68a" />
                        <SliderRow label="阴影" value={pro.shadows} min={0} max={100} onChange={(v) => onPatchPro({ shadows: v })} accent="#818cf8" />
                      </>
                    )}
                  </div>
                )}

                {openPanel === 'movement' && (
                  <div className="flex flex-col gap-4">
                    {renderSkillRegistry('#67e8f9')}
                    <GroupedSelect label="运镜方式" groups={MOVEMENT_GROUPS} value={activeStoryboardFrame?.movement ?? pro.movement} onChange={(v) => activeStoryboardFrame ? onPatchStoryboardFrame(activeStoryboardFrame.id, { movement: v }) : onPatchPro({ movement: v })} />
                    {canvasMode !== 'simple' && (
                      <ChipSelect label="播放速度" options={[...SPEEDS]} value={pro.speed} onChange={(v) => onPatchPro({ speed: v })} />
                    )}
                    {canvasMode === 'pro' && (
                      <SliderRow label="AI 介入强度" value={pro.aiStrength} min={0} max={100} onChange={(v) => onPatchPro({ aiStrength: v })} />
                    )}
                  </div>
                )}

                {openPanel === 'effects' && renderSkillRegistry('#fde68a')}

                {openPanel === 'editing' && renderSkillRegistry('#ddd6fe')}

                {openPanel === 'style' && (
                  <div className="flex flex-col gap-4">
                    <ChipSelect label="项目风格" options={STYLES} value={selectedStyle} onChange={onStyleChange} />
                    <ChipSelect label="创作意图" options={[...SHOT_INTENTS]} value={currentIntent || SHOT_INTENTS[0]} onChange={onIntentChange} />
                    {canvasMode !== 'simple' && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>风格资产</span>
                      <div className="grid gap-2 md:grid-cols-2">
                        {BUILTIN_STYLES.map((asset) => {
                          const active = selectedStyleId === asset.id
                          return (
                            <button
                              key={asset.id}
                              onClick={() => onSelectStyle(active ? null : asset.id)}
                              className="flex items-center gap-2.5 px-3 py-3 rounded-2xl text-left transition-all"
                              style={{ background: active ? `${asset.accentColor}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? `${asset.accentColor}45` : 'rgba(255,255,255,0.05)'}` }}
                            >
                              <span className="text-base leading-none">{asset.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold" style={{ color: active ? asset.accentColor : 'rgba(255,255,255,0.7)' }}>{asset.name}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{asset.description}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {openPanel === 'reference' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>模板参考</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {TEMPLATES.map((tpl) => {
                          const active = activeTemplateId === tpl.id
                          const accent = CATEGORY_COLORS[tpl.category] ?? '#6366f1'
                          return (
                            <button
                              key={tpl.id}
                              onClick={() => onApplyTemplate(tpl.id)}
                              className="flex flex-col items-start gap-1 rounded-2xl px-3 py-3 text-left transition-all"
                              style={{ background: active ? `${accent}18` : 'rgba(255,255,255,0.03)', border: active ? `1px solid ${accent}50` : '1px solid rgba(255,255,255,0.05)' }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{tpl.icon}</span>
                                <span className="text-[11px] font-semibold" style={{ color: active ? accent : 'rgba(255,255,255,0.65)' }}>{tpl.name}</span>
                              </div>
                              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{tpl.shots.length} 镜头</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {canvasMode !== 'simple' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <ModelSelector
                        imageModel={pro.imageModel}
                        videoModel={pro.videoModel}
                        onImageModel={(v) => onPatchPro({ imageModel: v })}
                        onVideoModel={(v) => onPatchPro({ videoModel: v })}
                      />
                      {canvasMode === 'pro' && (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>全局图像模型</span>
                          <select
                            value={globalPro.modelConfig.imageModel}
                            onChange={(e) => setGlobalPro((g) => ({ ...g, modelConfig: { ...g.modelConfig, imageModel: e.target.value } }))}
                            className="w-full text-[11px] rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}
                          >
                            {GLOBAL_IMAGE_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>全局视频模型</span>
                          <select
                            value={globalPro.modelConfig.videoModel}
                            onChange={(e) => setGlobalPro((g) => ({ ...g, modelConfig: { ...g.modelConfig, videoModel: e.target.value } }))}
                            className="w-full text-[11px] rounded-xl px-3 py-2 outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}
                          >
                            {GLOBAL_VIDEO_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
                          </select>
                        </div>
                      </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="rounded-[28px] p-3 md:p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 12px 48px rgba(0,0,0,0.22)' }}
      >
        <div className="flex flex-col gap-3">
          <textarea
            value={idea}
            onChange={(e) => onIdeaChange(e.target.value)}
            placeholder="在这里继续描述当前镜头，底部操作栏负责所有专业控制…"
            rows={2}
            className="w-full rounded-2xl px-4 py-3 text-[13px] text-white/90 placeholder-gray-500 outline-none resize-none"
            style={{ background: 'rgba(7,11,20,0.9)', border: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.6 }}
          />

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'rgba(255,255,255,0.24)' }}>
                Inspector Triggers
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                { id: 'ai', label: 'AI建议', accent: '#6ee7b7', icon: '✦' },
                { id: 'insight', label: 'AI洞察', accent: '#c7d2fe', icon: '◌' },
                { id: 'previs', label: '分镜预演', accent: '#93c5fd', icon: '▥' },
                { id: 'audio', label: '声音', accent: '#38bdf8', icon: '♫' },
                { id: 'gear', label: '器材', accent: '#fde68a', icon: '◍' },
                { id: 'casting', label: '选角', accent: '#f9a8d4', icon: '◔' },
                { id: 'notes', label: '批注', accent: '#fb7185', icon: '✎' },
                { id: 'approval', label: '确认', accent: '#34d399', icon: '✓' },
                { id: 'camera', label: '镜头', accent: '#a5b4fc', icon: '◎' },
                { id: 'composition', label: '构图', accent: '#f9a8d4', icon: '▣' },
                { id: 'perspective', label: '视角', accent: '#93c5fd', icon: '◫' },
                { id: 'color', label: '色彩', accent: '#c084fc', icon: '◈' },
                { id: 'movement', label: '动作', accent: '#67e8f9', icon: '↗' },
                { id: 'effects', label: '特效', accent: '#fde68a', icon: '✺' },
                { id: 'editing', label: '剪辑', accent: '#ddd6fe', icon: '⫶' },
                { id: 'lighting', label: '光线', accent: '#fbbf24', icon: '◐' },
                { id: 'style', label: '风格', accent: '#f9a8d4', icon: '◇' },
                { id: 'reference', label: '参考', accent: '#fda4af', icon: '⌘' },
              ].map((item) => {
                const active = openPanel === item.id
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => togglePanel(item.id as CanvasActionPanel)}
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-2 rounded-2xl text-[11px] font-semibold transition-all"
                    style={{
                      background: active ? `${item.accent}16` : 'rgba(255,255,255,0.035)',
                      border: `1px solid ${active ? `${item.accent}70` : 'rgba(255,255,255,0.07)'}`,
                      color: active ? item.accent : 'rgba(255,255,255,0.54)',
                      boxShadow: active ? `0 0 0 1px ${item.accent}22 inset, 0 8px 18px rgba(0,0,0,0.18)` : 'none',
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] opacity-80">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
            </div>

            <button
              onClick={onGenerateCurrent}
              disabled={running || !idea.trim()}
              className="px-4 py-2.5 rounded-2xl text-[12px] font-semibold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
            >
              {running ? '生成中…' : '生成当前镜头'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components for RightPanel ─────────────────────────────────────

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
      {children}
    </span>
  )
}

function SliderRow({ label, value, min, max, unit = '', onChange, accent = '#a5b4fc' }: {
  label: string; value: number; min: number; max: number
  unit?: string; onChange: (v: number) => void; accent?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: accent }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: accent }}
      />
    </div>
  )
}

function GroupedSelect({ label, groups, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
  groups: { label: string; options: readonly string[] }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[10px] rounded-md px-2 py-1.5 outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
      >
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function FocalStrip({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>焦距</span>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-bold tabular-nums" style={{ color: '#a5b4fc' }}>{value}mm</span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{FOCAL_LENS_CHARS[value]}</span>
        </div>
      </div>
      <div
        ref={stripRef}
        className="flex gap-1 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {FOCAL_LENGTHS.map((mm) => (
          <button
            key={mm}
            onClick={() => onChange(mm)}
            className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all"
            style={{
              background: value === mm ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              border:     value === mm ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.07)',
              minWidth: 36,
            }}
          >
            <span className="text-[10px] font-bold" style={{ color: value === mm ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>{mm}</span>
            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.18)' }}>mm</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ApertureDial({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const idx = APERTURES.indexOf(value as typeof APERTURES[number])
  const pct = ((idx < 0 ? 4 : idx) / (APERTURES.length - 1)) * 100
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>光圈</span>
        <span className="text-[11px] font-bold" style={{ color: '#34d399' }}>{value}</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #6366f1)' }}
        />
        <input
          type="range" min={0} max={APERTURES.length - 1}
          value={idx < 0 ? 4 : idx}
          onChange={(e) => onChange(APERTURES[Number(e.target.value)] ?? APERTURES[4]!)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '100%' }}
        />
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <span>{APERTURES[0]}</span><span style={{ color: 'rgba(255,255,255,0.12)' }}>浅景深 ← → 深景深</span><span>{APERTURES[APERTURES.length - 1]}</span>
      </div>
    </div>
  )
}

// ─── Right Panel (Camera / Lighting / Color tabs) ──────────────────────────────

type RightTab = 'camera' | 'lighting' | 'color' | 'model'

function RightPanel({ pro, setPro, globalPro, setGlobalPro, running, idea, onGenerate }: {
  pro: ProParams; setPro: React.Dispatch<React.SetStateAction<ProParams>>
  globalPro: GlobalPro; setGlobalPro: React.Dispatch<React.SetStateAction<GlobalPro>>
  running: boolean; idea: string; onGenerate: () => void
}) {
  const [tab, setTab] = useState<RightTab>('camera')

  const set = useCallback(<K extends keyof ProParams>(key: K, val: ProParams[K]) => {
    setPro((p) => ({ ...p, [key]: val }))
  }, [setPro])

  const applyPreset = useCallback((presetId: string) => {
    const preset = CAMERA_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setPro((p) => ({ ...p, ...preset.params }))
  }, [setPro])

  const TABS: { id: RightTab; label: string }[] = [
    { id: 'camera',   label: '摄影' },
    { id: 'lighting', label: '灯光' },
    { id: 'color',    label: '色彩' },
    { id: 'model',    label: '模型' },
  ]

  return (
    <aside
      className="flex-shrink-0 flex flex-col"
      style={{ width: 284, background: '#070b14', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>控制面板</p>
          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>PRO</span>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1 mb-3">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className="flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(255,255,255,0.07)`,
              }}
              title={preset.desc}
            >
              <span style={{ fontSize: 14 }}>{preset.icon}</span>
              <span className="text-[8px] font-semibold" style={{ color: preset.accent }}>{preset.label}</span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 text-[10px] font-semibold transition-all"
              style={{
                color: tab === t.id ? '#a5b4fc' : 'rgba(255,255,255,0.28)',
                borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* ── Camera tab ──────────────────────────────────────────────────────── */}
        {tab === 'camera' && (
          <>
            {/* Shot frame + angle */}
            <div className="flex flex-col gap-3">
              <PanelLabel>景别 · 角度</PanelLabel>
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="text-[9px] mb-1 block" style={{ color: 'rgba(255,255,255,0.28)' }}>景别</span>
                  <select
                    value={pro.framing}
                    onChange={(e) => set('framing', e.target.value)}
                    className="w-full text-[10px] rounded-md px-2 py-1.5 outline-none"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                  >
                    {SHOT_FRAMES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <span className="text-[9px] mb-1 block" style={{ color: 'rgba(255,255,255,0.28)' }}>角度</span>
                  <select
                    value={pro.angle}
                    onChange={(e) => set('angle', e.target.value)}
                    className="w-full text-[10px] rounded-md px-2 py-1.5 outline-none"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                  >
                    {ANGLES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Movement (grouped dropdown) */}
            <GroupedSelect
              label="运镜方式"
              groups={MOVEMENT_GROUPS}
              value={pro.movement}
              onChange={(v) => set('movement', v)}
            />

            {/* Focal strip */}
            <FocalStrip value={pro.focalLength} onChange={(v) => set('focalLength', v)} />

            {/* Aperture dial */}
            <ApertureDial value={pro.aperture} onChange={(v) => set('aperture', v)} />

            {/* Speed */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>播放速度</span>
              <div className="flex gap-1 flex-wrap">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => set('speed', s)}
                    className="px-2 py-1 rounded-md text-[10px] transition-all"
                    style={{
                      background: pro.speed === s ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.04)',
                      border:     pro.speed === s ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      color:      pro.speed === s ? '#fca5a5' : 'rgba(255,255,255,0.38)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* AI strength */}
            <SliderRow label="AI 介入强度" value={pro.aiStrength} min={0} max={100} onChange={(v) => set('aiStrength', v)} />
          </>
        )}

        {/* ── Lighting tab ─────────────────────────────────────────────────────── */}
        {tab === 'lighting' && (
          <>
            <PanelLabel>灯光方案</PanelLabel>

            {/* Lighting type */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>光源类型</span>
              <div className="grid grid-cols-2 gap-1">
                {LIGHTING_TYPES.map((lt) => (
                  <button
                    key={lt}
                    onClick={() => set('lightingType', lt)}
                    className="py-1.5 px-2 rounded-lg text-[10px] text-left transition-all"
                    style={{
                      background: pro.lightingType === lt ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.03)',
                      border:     pro.lightingType === lt ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      color:      pro.lightingType === lt ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {lt}
                  </button>
                ))}
              </div>
            </div>

            {/* Position chips */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>灯位</span>
              <div className="flex flex-wrap gap-1">
                {LIGHTING_POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => set('lightingPosition', pos)}
                    className="px-2 py-1 rounded-md text-[10px] transition-all"
                    style={{
                      background: pro.lightingPosition === pos ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)',
                      border:     pro.lightingPosition === pos ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.07)',
                      color:      pro.lightingPosition === pos ? '#fbbf24' : 'rgba(255,255,255,0.38)',
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity slider */}
            <SliderRow
              label="光照强度"
              value={pro.lightingIntensity}
              min={0} max={100} unit="%"
              onChange={(v) => set('lightingIntensity', v)}
              accent="#fbbf24"
            />
          </>
        )}

        {/* ── Color tab ───────────────────────────────────────────────────────── */}
        {tab === 'color' && (
          <>
            <PanelLabel>色彩系统</PanelLabel>

            {/* LUT */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>色彩 LUT</span>
              <div className="grid grid-cols-2 gap-1">
                {COLOR_LUTS.map((lut) => (
                  <button
                    key={lut}
                    onClick={() => set('colorLUT', lut)}
                    className="py-1.5 px-2 rounded-lg text-[10px] text-left transition-all truncate"
                    style={{
                      background: pro.colorLUT === lut ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
                      border:     pro.colorLUT === lut ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      color:      pro.colorLUT === lut ? '#c084fc' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {lut}
                  </button>
                ))}
              </div>
            </div>

            {/* Color temperature */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>色温</span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: pro.colorTemp < 4000 ? '#fb923c' : pro.colorTemp > 6000 ? '#93c5fd' : '#fde68a' }}>
                  {pro.colorTemp}K
                </span>
              </div>
              <div
                className="relative h-2 rounded-full"
                style={{ background: 'linear-gradient(90deg, #fb923c 0%, #fde68a 40%, #fff 55%, #bfdbfe 75%, #93c5fd 100%)' }}
              >
                <input
                  type="range" min={2000} max={8000} step={100} value={pro.colorTemp}
                  onChange={(e) => set('colorTemp', Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  style={{ height: '100%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{ left: `${((pro.colorTemp - 2000) / 6000) * 100}%`, transform: 'translate(-50%, -50%)', background: '#1e1e2e' }}
                />
              </div>
              <div className="flex justify-between text-[8px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                <span>2000K 暖</span><span>8000K 冷</span>
              </div>
            </div>

            {/* Tone sliders */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>色调调整</span>
              <SliderRow label="对比度" value={pro.contrast}   min={0} max={100} onChange={(v) => set('contrast', v)}   accent="#e2e8f0" />
              <SliderRow label="饱和度" value={pro.saturation} min={0} max={100} onChange={(v) => set('saturation', v)} accent="#c084fc" />
              <SliderRow label="高光"   value={pro.highlights} min={0} max={100} onChange={(v) => set('highlights', v)} accent="#fde68a" />
              <SliderRow label="阴影"   value={pro.shadows}    min={0} max={100} onChange={(v) => set('shadows', v)}    accent="#818cf8" />
            </div>
          </>
        )}

        {/* ── Model tab ────────────────────────────────────────────────────────── */}
        {tab === 'model' && (
          <>
            <PanelLabel>模型选择</PanelLabel>

            {/* Text model */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>文本模型</span>
              <div className="flex gap-1">
                {TEXT_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => set('textModel', m)}
                    className="flex-1 py-2 rounded-lg text-[10px] font-medium transition-all"
                    style={{
                      background: pro.textModel === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: pro.textModel === m ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      color: pro.textModel === m ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Image model */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>图像模型</span>
              <select
                value={pro.imageModel}
                onChange={(e) => set('imageModel', e.target.value)}
                className="w-full text-[10px] rounded-md px-2 py-1.5 outline-none"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
              >
                {IMAGE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Video model */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>视频模型</span>
              <select
                value={pro.videoModel}
                onChange={(e) => set('videoModel', e.target.value)}
                className="w-full text-[10px] rounded-md px-2 py-1.5 outline-none"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}
              >
                {VIDEO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <ChipSelect label="片段时长" options={DURATIONS} value={pro.duration} onChange={(v) => set('duration', v)} compact />

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

            <PanelLabel>全局模型路由</PanelLabel>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>全局图像</span>
                <select
                  value={globalPro.modelConfig.imageModel}
                  onChange={(e) => setGlobalPro((g) => ({ ...g, modelConfig: { ...g.modelConfig, imageModel: e.target.value } }))}
                  className="text-[10px] rounded-md px-2 py-1 outline-none"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}
                >
                  {GLOBAL_IMAGE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>全局视频</span>
                <select
                  value={globalPro.modelConfig.videoModel}
                  onChange={(e) => setGlobalPro((g) => ({ ...g, modelConfig: { ...g.modelConfig, videoModel: e.target.value } }))}
                  className="text-[10px] rounded-md px-2 py-1 outline-none"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}
                >
                  {GLOBAL_VIDEO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom: generate */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onGenerate}
          disabled={!idea.trim() || running}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background: running ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
          }}
        >
          {running ? '生成中…' : '🎬 生成当前镜头'}
        </button>
      </div>
    </aside>
  )
}

// ─── Left Panel (AI & resources) ──────────────────────────────────────────────

function LeftPanel({
  idea, running, autoRunning, orchRunning, commercialRunning,
  onAutoDirector, onDirector, onCommercialMode, onOrchestrate, onAutoCrew,
  onShowPublish, globalPro, aiTasks, aiSynced, crewMembers, crewSynced, crewRunning,
  onRemoveCrewMember, onReplaceCrewMember,
  pricing, priceDuration, setPriceDuration, priceQuality, setPriceQuality,
  orchPhase, autoPhase, commercialPhase, commercialMode, canvasMode, onCanvasModeChange, currentIntent,
}: {
  idea: string
  running: boolean; autoRunning: boolean; orchRunning: boolean; commercialRunning: boolean
  onAutoDirector: () => void; onDirector: () => void
  onCommercialMode: () => void; onOrchestrate: () => void; onAutoCrew: () => void
  onShowPublish: () => void; globalPro: GlobalPro
  aiTasks: DirectorTask[] | null; aiSynced: boolean
  crewMembers: CrewMember[] | null; crewSynced: boolean; crewRunning: boolean
  onRemoveCrewMember: (uid: string) => void; onReplaceCrewMember: (uid: string, role: string) => void
  pricing: PricingResult | null; priceDuration: number; setPriceDuration: (v: number) => void
  priceQuality: QualityLevel; setPriceQuality: (v: QualityLevel) => void
  orchPhase: PipelinePhase; autoPhase: string; commercialPhase: string
  commercialMode: boolean
  canvasMode: CanvasMode
  onCanvasModeChange: (mode: CanvasMode) => void
  currentIntent?: string
}) {
  return (
    <aside className="relative flex-shrink-0 flex flex-col" style={{ width: 260, background: '#070b14', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Loading overlays */}
      <AnimatePresence>
        {(commercialRunning || autoRunning) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4"
            style={{ background: 'rgba(7,11,20,0.95)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} className="text-4xl">
              {commercialRunning ? '📢' : '🎬'}
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{commercialRunning ? '商业项目生成中…' : '导演正在工作'}</p>
              <p className="text-[11px] mt-1" style={{ color: commercialRunning ? '#fbbf24' : '#a5b4fc' }}>
                {commercialRunning ? commercialPhase : autoPhase}
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: commercialRunning ? '#f59e0b' : '#6366f1' }}
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orchRunning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6"
            style={{ background: 'rgba(7,11,20,0.97)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-4xl">⚡</motion.div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">AI 正在生成项目</p>
              <p className="text-[11px] mt-1" style={{ color: '#a5b4fc' }}>{orchPhase ? `${orchPhase}…` : '准备中…'}</p>
            </div>
            <div className="flex flex-col gap-2 w-[190px]">
              {PIPELINE_STEPS.map((step, i) => {
                const activeIdx = PIPELINE_STEPS.findIndex((s) => s.phase === orchPhase)
                const done = i < activeIdx; const active = i === activeIdx
                return (
                  <div key={step.phase} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: done ? 'rgba(16,185,129,0.25)' : active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)', border: done ? '1px solid #34d399' : active ? '1px solid #a5b4fc' : '1px solid rgba(255,255,255,0.1)' }}>
                      {done ? <span className="text-[10px]" style={{ color: '#34d399' }}>✓</span>
                        : active ? <motion.div className="w-2 h-2 rounded-full" style={{ background: '#a5b4fc' }} animate={{ scale: [0.6, 1.2, 0.6] }} transition={{ duration: 0.9, repeat: Infinity }} />
                        : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />}
                    </div>
                    <span className="text-xs">{step.icon}</span>
                    <span className="text-[11px] transition-colors" style={{ color: done ? '#34d399' : active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)', fontWeight: active ? 600 : 400 }}>{step.label}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 className="text-[13px] font-bold text-white tracking-tight">AI 导演工作台</h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Pro Canvas</p>
        </div>
        <ExportMenu globalPro={globalPro} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4">
        <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>Canvas Mode</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.14)', color: '#a5b4fc' }}>
              {CANVAS_MODE_META[canvasMode].label}
            </span>
          </div>
          <div className="flex gap-1.5">
            {(['simple', 'advanced', 'pro'] as CanvasMode[]).map((mode) => {
              const active = mode === canvasMode
              return (
                <button
                  key={mode}
                  onClick={() => onCanvasModeChange(mode)}
                  className="flex-1 px-2 py-2 rounded-xl text-[10px] font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    color: active ? '#c7d2fe' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {CANVAS_MODE_META[mode].label}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {CANVAS_MODE_META[canvasMode].hint}
          </p>
        </div>

        <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.24)' }}>Canvas Status</p>
          <p className="text-[12px] leading-6 text-white/85">
            {idea.trim() || '从底部输入框开始描述你的镜头创意。'}
          </p>
          {currentIntent && (
            <span
              className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.42)' }}
            >
              当前意图：{currentIntent}
            </span>
          )}
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.26)' }}>
            专业参数、风格与 AI 建议都从底部工具栏进入。
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={onAutoDirector}
            disabled={!idea.trim() || running || autoRunning}
            className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)', boxShadow: autoRunning ? 'none' : '0 4px 16px rgba(245,158,11,0.3)', color: 'white' }}
          >
            <span>🎬</span><span>一键导演方案</span>
          </button>

          <button
            onClick={onDirector}
            disabled={!idea.trim() || running || autoRunning}
            className="w-full py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)', color: '#a5b4fc' }}
          >
            <span>🧭</span><span>导演拆镜</span>
          </button>

          <button
            onClick={onCommercialMode}
            disabled={running || autoRunning || commercialRunning}
            className="w-full py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{
              background: commercialMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${commercialMode ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.25)'}`,
              color: '#fbbf24',
            }}
          >
            <span>📢</span><span>接单模式{commercialMode ? ' ✓' : ''}</span>
          </button>
        </div>

        {/* AI tasks */}
        <AnimatePresence>
          {aiTasks && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)' }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                <span className="text-xs">🤖</span>
                <p className="text-[10px] font-bold flex-1" style={{ color: '#a5b4fc' }}>制作流程</p>
                {aiSynced && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>✓ 已同步</span>}
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-1.5">
                {aiTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0" style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}>{i + 1}</span>
                    <p className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{task.title}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', color: '#c4b5fd' }}>{task.role}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto crew */}
        <AnimatePresence>
          {aiTasks && (
            <motion.button
              key="crew-btn" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={onAutoCrew} disabled={crewRunning}
              className="w-full py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{
                background: crewMembers ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.07)',
                border: `1px solid ${crewMembers ? 'rgba(16,185,129,0.45)' : 'rgba(16,185,129,0.2)'}`,
                color: '#34d399',
              }}
            >
              <span>{crewRunning ? '⏳' : '⚡'}</span>
              <span>{crewRunning ? 'AI 匹配中…' : crewMembers ? '重新匹配团队' : 'AI 组建团队'}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Crew panel */}
        <AnimatePresence>
          {crewMembers && crewMembers.length > 0 && (
            <motion.div
              key="crew-panel" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)' }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                <p className="text-[10px] font-bold flex-1" style={{ color: '#34d399' }}>匹配团队</p>
                {crewSynced && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>✓ 已邀请</span>}
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-2">
                {crewMembers.map((m, i) => (
                  <motion.div key={m.userId} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{ background: m.accent }}>{m.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{m.name}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.roleIcon} {m.role} · ★{m.rating.toFixed(1)}</p>
                    </div>
                    <button onClick={() => onReplaceCrewMember(m.userId, m.role)} className="text-[10px] px-1 rounded" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>↻</button>
                    <button onClick={() => onRemoveCrewMember(m.userId)} className="text-[10px] px-1 rounded" style={{ color: '#f87171', background: 'rgba(244,63,94,0.08)' }}>✕</button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pricing panel */}
        <AnimatePresence>
          {pricing && (
            <motion.div
              key="pricing" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.18)' }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(251,191,36,0.1)' }}>
                <p className="text-[10px] font-bold flex-1" style={{ color: '#fbbf24' }}>💰 报价预估</p>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
                  {(['standard', 'premium'] as QualityLevel[]).map((q) => (
                    <button key={q} onClick={() => setPriceQuality(q)} className="px-2 py-0.5 text-[9px] font-semibold transition-colors"
                      style={{ background: priceQuality === q ? 'rgba(251,191,36,0.2)' : 'transparent', color: priceQuality === q ? '#fbbf24' : 'rgba(255,255,255,0.28)' }}>
                      {q === 'standard' ? '标准' : '精品'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-2">
                <div className="flex gap-1 flex-wrap">
                  {[1, 3, 5, 7].map((d) => (
                    <button key={d} onClick={() => setPriceDuration(d)} className="px-2 py-0.5 rounded text-[9px] transition-all"
                      style={{ background: priceDuration === d ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)', border: priceDuration === d ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.06)', color: priceDuration === d ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
                      {d}天
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>预估总价</span>
                  <motion.span key={pricing.totalPrice} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-[14px] font-black" style={{ color: '#fbbf24' }}>¥{pricing.totalPrice.toLocaleString()}</motion.span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* One-click orchestrate */}
        <motion.button
          onClick={onOrchestrate}
          disabled={idea.trim().length < 8 || orchRunning || running || autoRunning}
          whileHover={idea.trim().length >= 8 && !orchRunning ? { scale: 1.01 } : {}}
          whileTap={idea.trim().length >= 8 && !orchRunning ? { scale: 0.98 } : {}}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1.5 relative overflow-hidden"
          style={{
            background: idea.trim().length >= 8 ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)' : 'rgba(255,255,255,0.04)',
            border: idea.trim().length >= 8 ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
            color: idea.trim().length >= 8 ? 'white' : 'rgba(255,255,255,0.2)',
            boxShadow: idea.trim().length >= 8 && !orchRunning ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
            opacity: orchRunning || running || autoRunning ? 0.5 : 1,
          }}
        >
          <span>⚡</span><span>一键生成项目</span>
        </motion.button>

      </div>

      {/* Bottom actions */}
      <div className="px-4 py-3 flex-shrink-0 flex flex-col gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onShowPublish} disabled={running} className="w-full py-2 rounded-xl text-[11px] font-medium transition-all disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
          🌐 发布到 Explore
        </button>
      </div>
    </aside>
  )
}

// ─── Page (three-column layout) ────────────────────────────────────────────────

export default function CreatePage() {
  const { role, setRole } = useMockRoleMode('creator')
  const router = useRouter()

  // ── Shared state ──────────────────────────────────────────────────────────────
  const [running, setRunning]         = useState(false)
  const [proMode, setProMode]         = useState(false)
  const [pro, setPro]                 = useState<ProParams>(DEFAULT_PRO)
  const [globalPro, setGlobalPro]     = useState<GlobalPro>(DEFAULT_GLOBAL_PRO)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoPhase, setAutoPhase]     = useState('')
  const [commercialMode, setCommercialMode]   = useState(false)
  const [commercialRunning, setCommercialRunning] = useState(false)
  const [commercialPhase, setCommercialPhase] = useState('')
  const [orchRunning, setOrchRunning] = useState(false)
  const [orchPhase, setOrchPhase]     = useState<PipelinePhase>('')
  const [canvasMode, setCanvasMode]   = useState<CanvasMode>('simple')
  const [compareSuggestionId, setCompareSuggestionId] = useState<string | null>(null)
  const [compareGearSuggestionId, setCompareGearSuggestionId] = useState<string | null>(null)
  const [storyboardPrevis, setStoryboardPrevis] = useState<StoryboardPrevis | null>(null)
  const [characterBible, setCharacterBible] = useState<CharacterBible | null>(null)
  const [styleBible, setStyleBible] = useState<StyleBible | null>(null)
  const [roleBibles, setRoleBibles] = useState<RoleBible[]>([])
  const [castingSuggestions, setCastingSuggestions] = useState<CastingSuggestion[]>([])
  const [compareCastingSuggestionId, setCompareCastingSuggestionId] = useState<string | null>(null)
  const [editingCastingSuggestionId, setEditingCastingSuggestionId] = useState<string | null>(null)
  const [previsSourceType, setPrevisSourceType] = useState<'prompt' | 'image'>('prompt')
  const [previsSourcePrompt, setPrevisSourcePrompt] = useState('')
  const [previsSourceImageUrl, setPrevisSourceImageUrl] = useState('')
  const [previsDuration, setPrevisDuration] = useState(15)
  const [previsFrameCount, setPrevisFrameCount] = useState<(typeof PREVIS_FRAME_COUNTS)[number]>(6)
  const [previsFrameStyle, setPrevisFrameStyle] = useState<(typeof PREVIS_FRAME_STYLES)[number]>('storyboard')
  const [previsAspectRatio, setPrevisAspectRatio] = useState<(typeof PREVIS_ASPECT_RATIOS)[number]>('16:9')
  const [editingStoryboardFrameId, setEditingStoryboardFrameId] = useState<string | null>(null)
  const [activeStoryboardFrameId, setActiveStoryboardFrameId] = useState<string | null>(null)
  const [videoConfigFrameId, setVideoConfigFrameId] = useState<string | null>(null)
  const [shotDerivativeJobs, setShotDerivativeJobs] = useState<ShotDerivativeJob[]>([])
  const [editorTimeline, setEditorTimeline] = useState<EditorTimeline>({
    id: createId('timeline'),
    clips: [],
    pacingGoal: 'commercial-fast',
    musicDirection: '',
    status: 'draft',
  })
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('canvas')
  const [acceptedClipReviewIds, setAcceptedClipReviewIds] = useState<string[]>([])
  const [ignoredClipReviewActions, setIgnoredClipReviewActions] = useState<string[]>([])
  const [derivativeProvider, setDerivativeProvider] = useState<(typeof DERIVATIVE_PROVIDERS)[number]>('mock')
  const [derivativeDuration, setDerivativeDuration] = useState<(typeof DERIVATIVE_DURATIONS)[number]>(5)
  const [derivativeMovement, setDerivativeMovement] = useState('Static')
  const [motionStrength, setMotionStrength] = useState(45)
  const [characterConsistency, setCharacterConsistency] = useState(85)
  const [styleConsistency, setStyleConsistency] = useState(85)
  const [insightOpen, setInsightOpen] = useState(false)
  const [requestedPanel, setRequestedPanel] = useState<CanvasActionPanel | null>(null)
  const [requestedNoteDraft, setRequestedNoteDraft] = useState<DirectorNoteDraft | null>(null)
  const [focusedSequenceId, setFocusedSequenceId] = useState<string | null>(null)
  const [focusedShotId, setFocusedShotId] = useState<string | null>(null)
  const [focusedStoryboardFrameId, setFocusedStoryboardFrameId] = useState<string | null>(null)
  const [focusedVideoJobId, setFocusedVideoJobId] = useState<string | null>(null)
  const [focusedEditorClipId, setFocusedEditorClipId] = useState<string | null>(null)
  const [focusedRoleBibleId, setFocusedRoleBibleId] = useState<string | null>(null)
  const [requestedReviewId, setRequestedReviewId] = useState<string | null>(null)
  const visibleWorkspaceViews = useMemo(
    () => getVisibleSectionsForRole(role, 'create') as WorkspaceView[],
    [role],
  )

  const dialogueLines = useAudioDeskStore((s) => s.dialogueLines)
  const voiceTakes = useAudioDeskStore((s) => s.voiceTakes)
  const lipSyncJobs = useAudioDeskStore((s) => s.lipSyncJobs)
  const musicCues = useAudioDeskStore((s) => s.musicCues)
  const soundEffectCues = useAudioDeskStore((s) => s.soundEffectCues)
  const audioTimelines = useAudioDeskStore((s) => s.audioTimelines)
  const cueSheets = useAudioDeskStore((s) => s.cueSheets)
  const musicMotifs = useAudioDeskStore((s) => s.musicMotifs)
  const addDialogueLine = useAudioDeskStore((s) => s.addDialogueLine)
  const updateDialogueLine = useAudioDeskStore((s) => s.updateDialogueLine)
  const upsertVoiceTakes = useAudioDeskStore((s) => s.upsertVoiceTakes)
  const updateVoiceTakeStatus = useAudioDeskStore((s) => s.updateVoiceTakeStatus)
  const addLipSyncJob = useAudioDeskStore((s) => s.addLipSyncJob)
  const upsertMusicCues = useAudioDeskStore((s) => s.upsertMusicCues)
  const updateMusicCueStatus = useAudioDeskStore((s) => s.updateMusicCueStatus)
  const upsertSoundEffectCues = useAudioDeskStore((s) => s.upsertSoundEffectCues)
  const updateSoundEffectCueStatus = useAudioDeskStore((s) => s.updateSoundEffectCueStatus)
  const upsertAudioTimeline = useAudioDeskStore((s) => s.upsertAudioTimeline)
  const updateAudioTimelineStatus = useAudioDeskStore((s) => s.updateAudioTimelineStatus)
  const upsertAudioTimelineClip = useAudioDeskStore((s) => s.upsertAudioTimelineClip)
  const updateAudioTimelineClip = useAudioDeskStore((s) => s.updateAudioTimelineClip)
  const upsertCueSheet = useAudioDeskStore((s) => s.upsertCueSheet)
  const updateCueSheetStatus = useAudioDeskStore((s) => s.updateCueSheetStatus)
  const updateCuePoint = useAudioDeskStore((s) => s.updateCuePoint)
  const upsertMusicMotifs = useAudioDeskStore((s) => s.upsertMusicMotifs)
  const updateMusicMotifStatus = useAudioDeskStore((s) => s.updateMusicMotifStatus)

  // Style store
  const selectedStyleId = useStyleStore((s) => s.selectedStyleId)
  const selectStyle     = useStyleStore((s) => s.selectStyle)
  const getActiveStyle  = useStyleStore((s) => s.getActiveStyle)

  // Canvas store
  const updateNode  = useCanvasStore((s) => s.updateNode)
  const setPrompt   = useCanvasStore((s) => s.setPrompt)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const resetCanvas = useCanvasStore((s) => s.resetCanvas)

  // Shots store
  const shots         = useShotsStore((s) => s.shots)
  const narrative     = useShotsStore((s) => s.narrative)
  const currentShotId = useShotsStore((s) => s.currentShotId)
  const setNarrativeType = useShotsStore((s) => s.setNarrativeType)
  const currentShot   = shots.find((s) => s.id === currentShotId)
  const idea          = currentShot?.idea ?? ''
  const selectedStyle = currentShot?.style ?? '商业广告'
  const suggestionShots = currentShot?.suggestions ?? []
  const gearSuggestions = currentShot?.gearSuggestions ?? []
  const projectTemplate = useMemo(
    () => (narrative?.templateId ? PROJECT_TEMPLATE_MAP[narrative.templateId] : undefined),
    [narrative?.templateId]
  )
  const insightContext = useMemo(() => buildInsightContext({ narrative, shots }), [narrative, shots])
  const insights = useMemo(
    () => [
      ...buildNarrativeInsights(insightContext),
      ...buildRhythmNarrativeInsights({ narrative, shots, projectTemplate }),
    ],
    [insightContext, narrative, projectTemplate, shots]
  )
  const scoreSummary = useMemo(() => {
    return computeScoreSystem({ narrative, shots, projectTemplate })
  }, [narrative, shots, projectTemplate])
  const productionDecision = useMemo(
    () => buildProductionDecision({ narrative, shots, scoreSummary, insights }),
    [insights, narrative, scoreSummary, shots]
  )
  const teams = useTeamStore((s) => s.teams)
  const updateTeamStage = useTeamStore((s) => s.updateStage)
  const createTask = useTaskStore((s) => s.createTask)
  const orders = useOrderStore((s) => s.orders)
  const jobs = useJobsStore((s) => s.jobs)
  const sendJobMessage = useJobsStore((s) => s.sendMessage)
  const notes = useDirectorNotesStore((s) => s.notes)
  const addDirectorNote = useDirectorNotesStore((s) => s.addNote)
  const updateDirectorNoteStatus = useDirectorNotesStore((s) => s.updateNoteStatus)
  const addDirectorNoteReply = useDirectorNotesStore((s) => s.addReply)
  const convertNoteToTaskDraft = useDirectorNotesStore((s) => s.convertNoteToTask)
  const approvals = useApprovalStore((s) => s.approvals)
  const createApprovalRequest = useApprovalStore((s) => s.createApprovalRequest)
  const addApprovalDecision = useApprovalStore((s) => s.addApprovalDecision)
  const markApprovalStale = useApprovalStore((s) => s.markApprovalStale)
  const upsertApprovalGate = useApprovalStore((s) => s.upsertApprovalGate)
  const currentUser = useAuthStore((s) => s.user)
  const versions = useVersionHistoryStore((s) => s.versions)
  const createVersion = useVersionHistoryStore((s) => s.createVersion)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const createDeliveryPackage = useDeliveryPackageStore((s) => s.createDeliveryPackage)
  const syncDeliveryAssets = useDeliveryPackageStore((s) => s.syncDeliveryAssets)
  const generateDeliveryManifest = useDeliveryPackageStore((s) => s.generateDeliveryManifest)
  const generateDeliveryRiskSummary = useDeliveryPackageStore((s) => s.generateDeliveryRiskSummary)
  const submitDeliveryPackage = useDeliveryPackageStore((s) => s.submitDeliveryPackage)
  const markDeliveryApproved = useDeliveryPackageStore((s) => s.markDeliveryApproved)
  const markDeliveryNeedsRevision = useDeliveryPackageStore((s) => s.markDeliveryNeedsRevision)
  const submitJobDelivery = useJobsStore((s) => s.submitDelivery)
  const activeTeam = useMemo(
    () => teams.find((team) => team.stage !== 'delivery') ?? teams[0],
    [teams]
  )
  const noteAssigneeOptions = useMemo(
    () => [
      ...(currentUser ? [{ id: currentUser.id, label: `${currentUser.displayName}（我）` }] : []),
      ...((activeTeam?.members ?? []).map((member) => ({ id: member.userId, label: `${member.name} · ${member.role}` }))),
    ].filter((option, index, list) => list.findIndex((item) => item.id === option.id) === index),
    [activeTeam?.members, currentUser]
  )
  const currentStage = activeTeam?.stage ?? 'idea'
  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeTeam?.projectId) ?? null,
    [activeTeam?.projectId, orders]
  )
  const activeJob = useMemo(
    () => (activeOrder ? jobs.find((job) => job.id === activeOrder.chatId) ?? null : null),
    [activeOrder, jobs]
  )
  const deliveryProjectId = useMemo(
    () => activeOrder?.id ?? activeTeam?.projectId ?? activeJob?.id ?? 'creator-city',
    [activeJob?.id, activeOrder?.id, activeTeam?.projectId]
  )
  const deliveryProjectTitle = useMemo(
    () => activeJob?.title ?? (idea.trim() || 'Creator City 项目'),
    [activeJob?.title, idea]
  )
  const deliveryPackagesForProject = useMemo(
    () => deliveryPackages
      .filter((pkg) => pkg.projectId === deliveryProjectId)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [deliveryPackages, deliveryProjectId]
  )
  const activeDeliveryPackage = deliveryPackagesForProject[0] ?? null
  const latestDeliveryApproval = useMemo(
    () => approvals
      .filter((approval) => approval.targetType === 'delivery' && approval.targetId === deliveryProjectId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null,
    [approvals, deliveryProjectId]
  )
  const latestDeliveryVersion = useMemo(
    () => versions
      .filter((version) => version.entityType === 'delivery' && version.entityId === deliveryProjectId)
      .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null,
    [deliveryProjectId, versions]
  )
  const activeStoryboardFrame = storyboardPrevis?.frames.find((frame) => frame.id === activeStoryboardFrameId) ?? null
  const lockedRoleBible = useMemo(
    () => roleBibles.find((role) => role.status === 'locked') ?? null,
    [roleBibles]
  )
  const selectedStoryboardFrameCount = storyboardPrevis?.frames.filter((frame) => frame.status === 'selected').length ?? 0
  const doneDerivativeJobCount = shotDerivativeJobs.filter((job) => job.status === 'done').length
  const clipReviews = useMemo<Record<string, ClipReview>>(() => {
    const timelineByJobId = new Map(editorTimeline.clips.map((clip) => [clip.sourceJobId, clip]))
    return Object.fromEntries(
      shotDerivativeJobs
        .filter((job) => job.status === 'done')
        .map((job) => {
          const frame = storyboardPrevis?.frames.find((item) => item.id === job.storyboardFrameId)
          const shot = frame?.linkedShotId ? shots.find((item) => item.id === frame.linkedShotId) : undefined
          const sequence = narrative?.sequences.find((item) => item.id === frame?.sequenceId)
          const roleBible = frame?.roleBibleId ? roleBibles.find((item) => item.id === frame.roleBibleId) : lockedRoleBible
          const baseReview = buildClipReview({
            job,
            frame,
            roleBible,
            styleBible,
            sequence,
            shot,
            timeline: editorTimeline,
          })
          const clip = timelineByJobId.get(job.id)
          return [
            job.id,
            clip ? { ...baseReview, clipId: clip.id, sourceJobId: job.id } : baseReview,
          ]
        })
    )
  }, [editorTimeline, lockedRoleBible, narrative, roleBibles, shotDerivativeJobs, shots, storyboardPrevis, styleBible])
  const orderedEditorClips = useMemo(
    () => [...editorTimeline.clips].sort((a, b) => a.order - b.order),
    [editorTimeline.clips]
  )
  const audioTimeline = useMemo(
    () => audioTimelines.find((timeline) => timeline.editorTimelineId === editorTimeline.id) ?? null,
    [audioTimelines, editorTimeline.id]
  )
  const cueSheet = useMemo(
    () => (audioTimeline ? cueSheets.find((sheet) => sheet.timelineId === audioTimeline.id) ?? null : null),
    [audioTimeline, cueSheets]
  )
  const timelineIssues = useMemo(
    () => analyzeAudioTimelineIssues({
      editorTimeline,
      audioTimeline,
      dialogueLines,
      voiceTakes,
      musicCues,
      lipSyncJobs,
      soundEffectCues,
      sequences: narrative?.sequences ?? [],
    }),
    [audioTimeline, dialogueLines, editorTimeline, lipSyncJobs, musicCues, narrative?.sequences, soundEffectCues, voiceTakes]
  )
  const selectedMusicCueCount = useMemo(
    () => musicCues.filter((cue) => cue.status === 'selected').length,
    [musicCues]
  )
  const unapprovedDialogueCount = useMemo(
    () => dialogueLines.filter((line) => line.status !== 'approved').length,
    [dialogueLines]
  )
  const pendingLipSyncJobCount = useMemo(
    () => lipSyncJobs.filter((job) => job.status !== 'done').length,
    [lipSyncJobs]
  )
  const audioReviews = useMemo<Record<string, AudioSyncReview>>(() => {
    return Object.fromEntries(
      editorTimeline.clips.map((clip) => {
        const frame = storyboardPrevis?.frames.find((item) => item.id === clip.sourceFrameId)
        const shot = frame?.linkedShotId ? shots.find((item) => item.id === frame.linkedShotId) : undefined
        const sequence = narrative?.sequences.find((item) => item.id === frame?.sequenceId)
        const line = dialogueLines.find((item) => item.targetClipId === clip.id)
        const selectedVoiceTake = line ? voiceTakes.find((item) => item.dialogueLineId === line.id && item.status === 'selected') : undefined
        const selectedMusicCue = musicCues.find((item) => item.targetEditorTimelineId === editorTimeline.id && item.status === 'selected')
        const selectedSoundEffects = soundEffectCues.filter((item) => item.targetClipId === clip.id && item.status === 'selected')
        const lipSyncJob = lipSyncJobs.find((item) => item.targetVideoClipId === clip.sourceJobId && item.status === 'done')
        return [
          clip.id,
          buildAudioSyncReview({
            clip,
            shot,
            sequence,
            line,
            selectedVoiceTake,
            selectedMusicCue,
            selectedSoundEffects,
            lipSyncJob,
            lockedRole: lockedRoleBible,
            timeline: editorTimeline,
          }),
        ]
      })
    )
  }, [dialogueLines, editorTimeline, lipSyncJobs, lockedRoleBible, musicCues, narrative?.sequences, shots, soundEffectCues, storyboardPrevis?.frames, voiceTakes])
  const strongAudioIssueCount = useMemo(
    () => (
      Object.values(audioReviews).filter((review) => review.issues.some((issue) => issue.severity === 'strong')).length
      + timelineIssues.filter((issue) => issue.severity === 'strong').length
    ),
    [audioReviews, timelineIssues]
  )
  const unknownLicenseMusicCount = useMemo(
    () => musicCues.filter((cue) => cue.status === 'selected' && cue.licenseStatus === 'unknown').length,
    [musicCues]
  )
  const approvedDialogueWithoutSelectedVoiceCount = useMemo(
    () => dialogueLines.filter((line) => {
      if (line.status !== 'approved') return false
      return !voiceTakes.some((take) => take.dialogueLineId === line.id && take.status === 'selected')
    }).length,
    [dialogueLines, voiceTakes]
  )
  const cueSheetDraftCount = useMemo(
    () => (audioTimeline && cueSheet?.status !== 'approved' ? 1 : 0),
    [audioTimeline, cueSheet]
  )
  const deliveryAssets = useMemo(
    () => buildDeliveryAssets({
      projectId: deliveryProjectId,
      projectTitle: deliveryProjectTitle,
      currentStage,
      storyboardPrevis,
      shotDerivativeJobs,
      clipReviews,
      editorTimeline,
      audioTimeline,
      dialogueLines,
      voiceTakes,
      musicCues,
      audioReviews,
      notes,
      versions,
      approvals,
    }),
    [
      approvals,
      audioReviews,
      audioTimeline,
      clipReviews,
      currentStage,
      deliveryProjectId,
      deliveryProjectTitle,
      dialogueLines,
      editorTimeline,
      musicCues,
      notes,
      shotDerivativeJobs,
      storyboardPrevis,
      versions,
      voiceTakes,
    ]
  )
  const deliveryPackageIncludedCount = activeDeliveryPackage?.assets.filter((asset) => asset.included).length ?? 0
  const deliveryPackageStrongRiskCount = activeDeliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0
  const deliveryPackageReadyCount = activeDeliveryPackage && ['ready', 'submitted', 'approved'].includes(activeDeliveryPackage.status) ? 1 : 0
  const editorClipCount = editorTimeline.clips.length
  const allEditorClipsReady = editorTimeline.clips.length > 0 && editorTimeline.clips.every((clip) => clip.transition && clip.order >= 0)
  const unreviewedVideoShotCount = Object.values(clipReviews).filter((review) => !acceptedClipReviewIds.includes(review.id)).length
  const strongIssueClipCount = editorTimeline.clips.filter((clip) => {
    const review = clipReviews[clip.sourceJobId]
    return review?.issues.some((issue) => issue.severity === 'strong')
  }).length
  const latestApprovalFor = useCallback((targetType: ApprovalTargetType, targetId: string) => (
    approvals
      .filter((approval) => approval.targetType === targetType && approval.targetId === targetId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
  ), [approvals])
  const approvalStageSignals = useMemo(() => {
    const blockers: Array<{ id: string; title: string; message: string; targetSequenceId?: string; targetShotId?: string }> = []
    const warnings: Array<{ id: string; title: string; message: string; targetSequenceId?: string; targetShotId?: string }> = []
    const nextStage = ['idea', 'storyboard', 'shooting', 'editing', 'delivery'][['idea', 'storyboard', 'shooting', 'editing', 'delivery'].indexOf(currentStage) + 1] as typeof currentStage | undefined
    const commercialProject = narrative?.type === 'commercial'
    const selectedFrames = storyboardPrevis?.frames.filter((frame) => frame.status === 'selected') ?? []
    const keyShots = shots.filter((shot, index) => index === 0 || /Hook|CTA|Opening|Resolve/i.test(narrative?.sequences.find((sequence) => sequence.id === shot.sequenceId)?.name ?? ''))
    const readyVideoJobs = shotDerivativeJobs.filter((job) => job.status === 'done')
    const missingRolesForApproval = (approval: ApprovalRequest | null, roles: ApprovalRole[]) => (
      roles.filter((role) => !approval || approval.status === 'stale' || !approval.decisions.some((decision) => decision.role === role && decision.status === 'approved'))
    )

    if (nextStage === 'shooting') {
      const targets = selectedFrames.length > 0 ? selectedFrames : keyShots.map((shot) => ({ id: shot.id, sequenceId: shot.sequenceId, timecode: shot.label }))
      const missingDirector = targets.find((target) => missingRolesForApproval(latestApprovalFor(selectedFrames.length > 0 ? 'storyboard-frame' : 'shot', target.id), ['director']).length > 0)
      if (missingDirector) {
        blockers.push({
          id: 'approval-storyboard-director',
          title: '关键分镜仍缺少导演确认',
          message: '进入 shooting 前，关键分镜或关键镜头至少需要导演确认。',
          targetSequenceId: missingDirector.sequenceId,
          targetShotId: selectedFrames.length > 0 ? undefined : missingDirector.id,
        })
      }
      if (commercialProject) {
        const missingClient = targets.find((target) => missingRolesForApproval(latestApprovalFor(selectedFrames.length > 0 ? 'storyboard-frame' : 'shot', target.id), ['client']).length > 0)
        if (missingClient) {
          warnings.push({
            id: 'approval-storyboard-client',
            title: '商业项目仍缺少客户确认',
            message: '当前是商业项目，建议在进入 shooting 前让客户确认关键分镜。',
            targetSequenceId: missingClient.sequenceId,
            targetShotId: selectedFrames.length > 0 ? undefined : missingClient.id,
          })
        }
      }
    }

    if (nextStage === 'editing') {
      const unapprovedJob = readyVideoJobs.find((job) => missingRolesForApproval(latestApprovalFor('video-shot', job.id), ['director', 'editor']).length === 2)
      if (unapprovedJob) {
        blockers.push({
          id: 'approval-video-shot-review',
          title: '视频镜头仍未完成导演/剪辑确认',
          message: '进入 editing 前，至少需要 director 或 editor 对关键视频镜头给出确认。',
        })
      }
    }

    if (nextStage === 'delivery') {
      const timelineApproval = latestApprovalFor('editor-timeline', editorTimeline.id)
      const missingTimelineRoles = missingRolesForApproval(timelineApproval, ['director', 'client'])
      if (missingTimelineRoles.length > 0) {
        blockers.push({
          id: 'approval-editor-timeline',
          title: '剪辑方案仍缺少交付前确认',
          message: '进入 delivery 前，editor timeline 需要导演与客户确认。',
        })
      }
    }

    if (currentStage === 'delivery') {
      const deliveryApproval = latestApprovalFor('delivery', activeOrder?.id ?? activeTeam?.id ?? 'delivery')
      const missingClient = missingRolesForApproval(deliveryApproval, ['client'])
      if (missingClient.length > 0) {
        warnings.push({
          id: 'approval-delivery-client',
          title: '交付物仍未得到客户确认',
          message: 'delivery 阶段建议先完成 client approval，再考虑订单完成状态。',
        })
      }
    }

    return { blockers, warnings }
  }, [activeOrder?.id, activeTeam?.id, currentStage, editorTimeline.id, latestApprovalFor, narrative?.type, narrative?.sequences, shotDerivativeJobs, shots, storyboardPrevis?.frames])
  const approvalGate = useMemo(() => {
    const unresolvedCount = approvalStageSignals.blockers.length + approvalStageSignals.warnings.length
    return {
      id: `gate-${currentStage}`,
      stage: currentStage,
      name: `${currentStage} approval gate`,
      requiredApprovals: currentStage === 'delivery' ? ['client'] as ApprovalRole[] : currentStage === 'editing' ? ['director', 'client'] as ApprovalRole[] : ['director'] as ApprovalRole[],
      status: approvalStageSignals.blockers.length > 0 ? 'blocked' as const : unresolvedCount > 0 ? 'needs-review' as const : 'ready' as const,
    }
  }, [approvalStageSignals.blockers.length, approvalStageSignals.warnings.length, currentStage])
  const recentImportantVersionCount = useMemo(
    () => versions.filter((version) => ['shot', 'storyboard-frame', 'editor-clip', 'role-bible'].includes(version.entityType) && Date.now() - new Date(version.createdAt).getTime() < 30 * 60 * 1000).length,
    [versions]
  )
  const stageReadiness = useMemo(
    () => buildStageReadiness({
      currentStage,
      scoreSummary,
      insights,
      selectedStoryboardFrameCount,
      doneDerivativeJobCount,
      editorClipCount,
      allEditorClipsReady,
      unreviewedVideoShotCount,
      strongIssueClipCount,
      lockedRoleBibleCount: roleBibles.filter((role) => role.status === 'locked').length,
      openBlockerNoteCount: notes.filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress')).length,
      highPriorityOpenNoteCount: notes.filter((note) => note.priority === 'high' && (note.status === 'open' || note.status === 'in-progress')).length,
      recentImportantVersionCount,
      approvalBlockers: approvalStageSignals.blockers,
      approvalWarnings: approvalStageSignals.warnings,
      selectedMusicCueCount,
      unapprovedDialogueCount,
      approvedDialogueWithoutSelectedVoiceCount,
      unknownLicenseMusicCount,
      pendingLipSyncJobCount,
      strongAudioIssueCount,
      cueSheetDraftCount,
      deliveryPackageCount: activeDeliveryPackage ? 1 : 0,
      deliveryPackageReadyCount,
      deliveryPackageStrongRiskCount,
    }),
    [activeDeliveryPackage, allEditorClipsReady, approvalStageSignals.blockers, approvalStageSignals.warnings, approvedDialogueWithoutSelectedVoiceCount, cueSheetDraftCount, currentStage, deliveryPackageReadyCount, deliveryPackageStrongRiskCount, doneDerivativeJobCount, editorClipCount, insights, notes, pendingLipSyncJobCount, recentImportantVersionCount, roleBibles, scoreSummary, selectedMusicCueCount, selectedStoryboardFrameCount, strongAudioIssueCount, strongIssueClipCount, unapprovedDialogueCount, unknownLicenseMusicCount, unreviewedVideoShotCount]
  )

  const notesSummary = useMemo(() => buildNotesAiSummary(notes), [notes])
  const approvalsSummary = useMemo(() => buildApprovalSummary(approvals), [approvals])

  useEffect(() => {
    upsertApprovalGate(approvalGate)
  }, [approvalGate, upsertApprovalGate])

  useEffect(() => {
    if (requestedPanel === 'audio') {
      setWorkspaceView('audio')
    }
  }, [requestedPanel])

  useEffect(() => {
    const handleOpenAudioDesk = () => {
      setWorkspaceView('audio')
    }
    window.addEventListener('creator-city-open-audio', handleOpenAudioDesk)
    return () => window.removeEventListener('creator-city-open-audio', handleOpenAudioDesk)
  }, [])

  useEffect(() => {
    const duration = Math.max(15, orderedEditorClips.reduce((sum, clip) => sum + clip.duration, 0))
    if (!audioTimeline) {
      upsertAudioTimeline(createDefaultAudioTimeline(editorTimeline.id, duration))
      return
    }
    if (audioTimeline.duration !== duration) {
      upsertAudioTimeline({ ...audioTimeline, duration })
    }
  }, [audioTimeline, editorTimeline.id, orderedEditorClips, upsertAudioTimeline])

  useEffect(() => {
    if (!audioTimeline) return
    if (!cueSheet) {
      upsertCueSheet(buildCueSheet({
        timelineId: audioTimeline.id,
        sequences: narrative?.sequences ?? [],
        clips: orderedEditorClips,
        musicDirection: editorTimeline.musicDirection,
      }))
    }
  }, [audioTimeline, cueSheet, editorTimeline.musicDirection, narrative?.sequences, orderedEditorClips, upsertCueSheet])

  useEffect(() => {
    if (musicMotifs.length > 0) return
    if ((roleBibles.length === 0) && ((narrative?.sequences.length ?? 0) === 0)) return
    upsertMusicMotifs(buildMusicMotifs({
      roles: roleBibles,
      sequences: narrative?.sequences ?? [],
      narrativeType: narrative?.type,
    }))
  }, [musicMotifs.length, narrative?.sequences, narrative?.type, roleBibles, upsertMusicMotifs])

  useEffect(() => {
    if (!activeDeliveryPackage) return
    syncDeliveryAssets(activeDeliveryPackage.id, deliveryAssets)
  }, [activeDeliveryPackage, activeDeliveryPackage?.id, deliveryAssets, syncDeliveryAssets])

  useEffect(() => {
    if (!activeDeliveryPackage) return
    generateDeliveryManifest(activeDeliveryPackage.id, {
      projectTitle: deliveryProjectTitle,
      projectStage: currentStage,
      finalVersion: latestDeliveryVersion?.label ?? activeDeliveryPackage.manifest?.finalVersion ?? 'v0',
    })
    generateDeliveryRiskSummary(activeDeliveryPackage.id)
  }, [activeDeliveryPackage, activeDeliveryPackage?.id, activeDeliveryPackage?.manifest?.finalVersion, currentStage, deliveryAssets, deliveryProjectTitle, generateDeliveryManifest, generateDeliveryRiskSummary, latestDeliveryVersion?.label])

  useEffect(() => {
    if (!activeDeliveryPackage || !latestDeliveryApproval) return
    if (latestDeliveryApproval.status === 'approved') {
      markDeliveryApproved(activeDeliveryPackage.id)
    } else if (latestDeliveryApproval.status === 'changes-requested' || latestDeliveryApproval.status === 'rejected') {
      markDeliveryNeedsRevision(activeDeliveryPackage.id)
    }
  }, [activeDeliveryPackage, activeDeliveryPackage?.id, latestDeliveryApproval, markDeliveryApproved, markDeliveryNeedsRevision])

  const noteTargets = useMemo(() => {
    const targets: Array<{ value: string; label: string; targetType: DirectorNoteTargetType; targetId: string }> = [
      { value: 'project:creator-city', label: '项目 · Creator City', targetType: 'project', targetId: 'creator-city' },
    ]
    ;(narrative?.sequences ?? []).forEach((sequence) => {
      targets.push({ value: `sequence:${sequence.id}`, label: `段落 · ${sequence.name}`, targetType: 'sequence', targetId: sequence.id })
    })
    shots.forEach((shot) => {
      targets.push({ value: `shot:${shot.id}`, label: `镜头 · ${shot.label}`, targetType: 'shot', targetId: shot.id })
    })
    storyboardPrevis?.frames.forEach((frame) => {
      targets.push({ value: `storyboard-frame:${frame.id}`, label: `分镜 · ${frame.timecode}`, targetType: 'storyboard-frame', targetId: frame.id })
    })
    shotDerivativeJobs.forEach((job) => {
      targets.push({ value: `video-shot:${job.id}`, label: `视频镜头 · ${job.provider} ${job.duration}s`, targetType: 'video-shot', targetId: job.id })
    })
    editorTimeline.clips.forEach((clip, index) => {
      targets.push({ value: `editor-clip:${clip.id}`, label: `剪辑片段 · #${index + 1} ${clip.title}`, targetType: 'editor-clip', targetId: clip.id })
    })
    roleBibles.forEach((role) => {
      targets.push({ value: `role-bible:${role.id}`, label: `角色 · ${role.name}`, targetType: 'role-bible', targetId: role.id })
    })
    Object.values(clipReviews).forEach((review) => {
      targets.push({ value: `clip-review:${review.id}`, label: `审片 · ${review.sourceJobId}`, targetType: 'clip-review', targetId: review.id })
    })
    return targets
  }, [clipReviews, editorTimeline.clips, narrative?.sequences, roleBibles, shotDerivativeJobs, shots, storyboardPrevis?.frames])

  const approvalTargets = useMemo<ApprovalTargetOption[]>(() => {
    const targets: ApprovalTargetOption[] = [
      { value: 'project-brief:creator-city', label: '项目简报 · Creator City', targetType: 'project-brief', targetId: 'creator-city' },
      { value: `editor-timeline:${editorTimeline.id}`, label: '剪辑时间线 · 当前序列', targetType: 'editor-timeline', targetId: editorTimeline.id },
      { value: `delivery:${deliveryProjectId}`, label: '交付确认 · 当前项目', targetType: 'delivery', targetId: deliveryProjectId },
    ]
    ;(narrative?.sequences ?? []).forEach((sequence) => {
      targets.push({ value: `sequence:${sequence.id}`, label: `段落 · ${sequence.name}`, targetType: 'sequence', targetId: sequence.id })
    })
    shots.forEach((shot) => {
      targets.push({ value: `shot:${shot.id}`, label: `镜头 · ${shot.label}`, targetType: 'shot', targetId: shot.id })
    })
    storyboardPrevis?.frames.forEach((frame) => {
      targets.push({ value: `storyboard-frame:${frame.id}`, label: `分镜 · ${frame.timecode}`, targetType: 'storyboard-frame', targetId: frame.id })
    })
    shotDerivativeJobs.forEach((job) => {
      targets.push({ value: `video-shot:${job.id}`, label: `视频镜头 · ${job.provider} ${job.duration}s`, targetType: 'video-shot', targetId: job.id })
    })
    editorTimeline.clips.forEach((clip, index) => {
      targets.push({ value: `editor-clip:${clip.id}`, label: `剪辑片段 · #${index + 1} ${clip.title}`, targetType: 'editor-clip', targetId: clip.id })
    })
    roleBibles.forEach((role) => {
      targets.push({ value: `role-bible:${role.id}`, label: `角色 · ${role.name}`, targetType: 'role-bible', targetId: role.id })
    })
    return targets
  }, [deliveryProjectId, editorTimeline.clips, editorTimeline.id, narrative?.sequences, roleBibles, shotDerivativeJobs, shots, storyboardPrevis?.frames])

  const handleCreateEntityVersion = useCallback((args: {
    entityType: VersionedEntityType
    entityId: string
    snapshot: Record<string, unknown>
    changeType: VersionChangeType
    summary: string
    changedFields?: string[]
    parentVersionId?: string
  }) => {
    const latest = versions
      .filter((version) => version.entityType === args.entityType && version.entityId === args.entityId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0]
    const created = createVersion({
      entityType: args.entityType,
      entityId: args.entityId,
      snapshot: args.snapshot,
      changeType: args.changeType,
      summary: args.summary,
      changedFields: args.changedFields ?? pickChangedFields(args.snapshot, latest?.snapshot),
      createdBy: currentUser?.displayName ?? '我',
      parentVersionId: args.parentVersionId ?? latest?.id,
    })
    const approvalTargetType = mapEntityTypeToApprovalTargetType(args.entityType)
    if (approvalTargetType) {
      markApprovalStale(approvalTargetType, args.entityId)
    }
    return created
  }, [createVersion, currentUser?.displayName, markApprovalStale, versions])

  const ensureApprovalVersion = useCallback((targetType: ApprovalTargetType, targetId: string) => {
    const existingByEntity = (entityType: VersionedEntityType, entityId: string) => (
      versions
        .filter((version) => version.entityType === entityType && version.entityId === entityId)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    )

    const snapshotByTarget = (): { entityType: VersionedEntityType; entityId: string; snapshot: Record<string, unknown>; summary: string } | null => {
      switch (targetType) {
        case 'project-brief':
          return {
            entityType: 'project-brief',
            entityId: targetId,
            snapshot: snapshotProjectBrief({
              idea,
              narrative,
              currentStage,
              templateName: projectTemplate?.name,
            }),
            summary: '创建项目简报版本',
          }
        case 'sequence': {
          const sequence = narrative?.sequences.find((item) => item.id === targetId)
          return sequence ? { entityType: 'sequence', entityId: targetId, snapshot: snapshotSequence(sequence), summary: '创建段落版本' } : null
        }
        case 'shot': {
          const shot = shots.find((item) => item.id === targetId)
          return shot ? { entityType: 'shot', entityId: targetId, snapshot: snapshotShot(shot), summary: '创建镜头版本' } : null
        }
        case 'storyboard-frame': {
          const frame = storyboardPrevis?.frames.find((item) => item.id === targetId)
          return frame ? { entityType: 'storyboard-frame', entityId: targetId, snapshot: snapshotStoryboardFrame(frame), summary: '创建分镜版本' } : null
        }
        case 'video-shot': {
          const job = shotDerivativeJobs.find((item) => item.id === targetId)
          return job ? { entityType: 'video-shot', entityId: targetId, snapshot: snapshotVideoShot(job), summary: '创建视频镜头版本' } : null
        }
        case 'editor-clip': {
          const clip = editorTimeline.clips.find((item) => item.id === targetId)
          return clip ? { entityType: 'editor-clip', entityId: targetId, snapshot: snapshotEditorClip(clip), summary: '创建剪辑片段版本' } : null
        }
        case 'role-bible': {
          const role = roleBibles.find((item) => item.id === targetId)
          return role ? { entityType: 'role-bible', entityId: targetId, snapshot: snapshotRoleBible(role), summary: '创建角色版本' } : null
        }
        case 'editor-timeline':
          return { entityType: 'editor-timeline', entityId: targetId, snapshot: snapshotEditorTimeline(editorTimeline), summary: '创建剪辑时间线版本' }
        case 'delivery':
          return {
            entityType: 'delivery',
            entityId: targetId,
            snapshot: snapshotDelivery({
              teamId: activeTeam?.id,
              orderId: activeOrder?.id,
              jobId: activeJob?.id,
              currentStage,
              editorTimeline,
              deliveryPackage: activeDeliveryPackage,
            }),
            summary: '创建交付版本',
          }
        default:
          return null
      }
    }

    const entityInfo = snapshotByTarget()
    if (!entityInfo) return undefined
    const latest = existingByEntity(entityInfo.entityType, entityInfo.entityId)
    if (latest) return latest.id
    return handleCreateEntityVersion({
      entityType: entityInfo.entityType,
      entityId: entityInfo.entityId,
      snapshot: entityInfo.snapshot,
      changeType: 'manual-edit',
      summary: entityInfo.summary,
    }).id
  }, [activeDeliveryPackage, activeJob?.id, activeOrder?.id, activeTeam?.id, currentStage, editorTimeline, handleCreateEntityVersion, idea, narrative, projectTemplate?.name, roleBibles, shotDerivativeJobs, shots, storyboardPrevis?.frames, versions])

  // AI tasks + pricing + crew
  const [aiTasks, setAiTasks]     = useState<DirectorTask[] | null>(null)
  const [aiSynced, setAiSynced]   = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiLastIdea = useRef('')

  const [pricing, setPricing]           = useState<PricingResult | null>(null)
  const [priceDuration, setPriceDuration] = useState(3)
  const [priceQuality, setPriceQuality]   = useState<QualityLevel>('standard')

  const [crewMembers, setCrewMembers] = useState<CrewMember[] | null>(null)
  const [crewRunning, setCrewRunning] = useState(false)
  const [crewSynced, setCrewSynced]   = useState(false)

  // Pricing auto-compute
  useEffect(() => {
    if (!aiTasks) { setPricing(null); return }
    setPricing(generatePrice({ tasks: aiTasks, duration: priceDuration, quality: priceQuality }))
  }, [aiTasks, priceDuration, priceQuality])

  // AI task generation on idea change
  useEffect(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    if (idea.trim().length < 8) {
      setAiTasks(null); setAiSynced(false); aiLastIdea.current = ''; return
    }
    aiTimerRef.current = setTimeout(() => {
      const trimmed = idea.trim()
      if (trimmed === aiLastIdea.current) return
      aiLastIdea.current = trimmed
      const tasks = generateTasksFromIdea(trimmed)
      setAiTasks(tasks); setAiSynced(false)
      const teamsList = useTeamStore.getState().teams
      const target = teamsList.find((t) => t.stage !== 'delivery')
      if (target) {
        const createTask = useTaskStore.getState().createTask
        const existing = useTaskStore.getState().tasks.filter((t) => t.teamId === target.id)
        tasks.forEach((task) => {
          if (existing.some((e) => e.title === task.title)) return
          const member = target.members.find((m) => m.role === task.role && m.status === 'joined')
          createTask(target.id, task.title, member?.userId ?? target.ownerId, member?.name ?? '待分配')
        })
        setAiSynced(true)
      }
    }, 850)
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  }, [idea])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleIdeaChange = useCallback((v: string) => {
    useShotsStore.getState().updateShot(currentShotId, { idea: v })
    setPrompt(v)
    updateNode('prompt-1', { content: v })
  }, [currentShotId, setPrompt, updateNode])

  const handleStyleChange = useCallback((v: string) => {
    useShotsStore.getState().updateShot(currentShotId, { style: v })
  }, [currentShotId])

  const handleSwitchShot = useCallback((id: string) => {
    if (id === currentShotId) return
    useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
    useShotsStore.getState().setCurrentShotId(id)
    const target = useShotsStore.getState().shots.find((s) => s.id === id)
    if (target) {
      resetCanvas(target.nodes, target.edges)
      setPrompt(target.idea)
      if (target.presetParams && Object.keys(target.presetParams).length > 0) {
        setPro((p) => ({ ...p, ...target.presetParams }))
        setProMode(true)
      }
    }
  }, [currentShotId, canvasNodes, canvasEdges, resetCanvas, setPrompt])

  const handleAddShot = useCallback((sequenceId?: string) => {
    useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
    const targetSequenceId = sequenceId ?? currentShot?.sequenceId
    const newId = useShotsStore.getState().addShot(DEFAULT_NODES, DEFAULT_EDGES, targetSequenceId)
    useShotsStore.getState().setCurrentShotId(newId)
    resetCanvas(DEFAULT_NODES, DEFAULT_EDGES)
    setPrompt('')
    updateNode('prompt-1', { content: '' })
  }, [currentShotId, currentShot?.sequenceId, canvasNodes, canvasEdges, resetCanvas, setPrompt, updateNode])

  const handleRemoveShot = useCallback((id: string) => {
    if (id === currentShotId) {
      const remaining = shots.filter((s) => s.id !== id)
      if (remaining.length === 0) return
      const next = remaining[0]!
      useShotsStore.getState().removeShot(id)
      resetCanvas(next.nodes, next.edges)
      setPrompt(next.idea)
    } else {
      useShotsStore.getState().removeShot(id)
    }
  }, [currentShotId, shots, resetCanvas, setPrompt])

  const handleUpdateShot = useCallback((id: string, patch: Partial<Shot>) => {
    useShotsStore.getState().updateShot(id, patch)
  }, [])

  const handlePatchCurrentPro = useCallback((patch: Partial<ProParams>) => {
    const nextSnapshot = snapshotShot({
      ...(currentShot as Shot),
      presetParams: { ...(currentShot?.presetParams ?? {}), ...patch },
    })
    setPro((prev) => ({ ...prev, ...patch }))
    setProMode(true)
    useShotsStore.getState().updateShot(currentShotId, {
      presetParams: { ...(currentShot?.presetParams ?? {}), ...patch },
    })
    if (currentShot) {
      handleCreateEntityVersion({
        entityType: 'shot',
        entityId: currentShotId,
        snapshot: nextSnapshot,
        changeType: 'manual-edit',
        summary: '更新镜头参数',
      })
    }
  }, [currentShot, currentShotId, handleCreateEntityVersion])

  const handleIntentChange = useCallback((intent: string) => {
    useShotsStore.getState().updateShot(currentShotId, { intent })
    if (currentShot) {
      handleCreateEntityVersion({
        entityType: 'shot',
        entityId: currentShotId,
        snapshot: snapshotShot({ ...currentShot, intent }),
        changeType: 'manual-edit',
        summary: '修改镜头意图',
      })
    }
  }, [currentShot, currentShotId, handleCreateEntityVersion])

  const handleGenerateSuggestions = useCallback(() => {
    const baseShot = currentShot ?? shots[0]
    if (!baseShot) return
    const basePro = { ...DEFAULT_PRO, ...pro, ...baseShot.presetParams }
    const context = buildSuggestionContext({ shot: baseShot, shots, narrative })
    useShotsStore.getState().updateShot(baseShot.id, {
      originalVersion: makeShotSnapshot(baseShot, basePro),
      suggestions: buildMockSuggestionShots(baseShot, basePro, context),
    })
    setCompareSuggestionId(null)
  }, [currentShot, shots, pro, narrative])

  const handleGenerateGearSuggestions = useCallback(() => {
    const baseShot = currentShot ?? shots[0]
    if (!baseShot) return
    useShotsStore.getState().updateShot(baseShot.id, {
      gearSuggestions: buildCameraLensSuggestions({ shot: baseShot, narrative, projectTemplate }),
    })
    setCompareGearSuggestionId(null)
  }, [currentShot, shots, narrative, projectTemplate])

  const applySuggestionCandidate = useCallback((suggestion: ShotSuggestion) => {
    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === suggestion.shotId)
    if (!targetShot) return

    if (suggestion.kind === 'gear') {
      const nextShot = {
        ...targetShot,
        cameraBrand: suggestion.suggestedShot.cameraBrand,
        cameraModel: suggestion.suggestedShot.cameraModel,
        lensBrand: suggestion.suggestedShot.lensBrand,
        lensModel: suggestion.suggestedShot.lensModel,
      }
      useShotsStore.getState().updateShot(suggestion.shotId, {
        cameraBrand: suggestion.suggestedShot.cameraBrand,
        cameraModel: suggestion.suggestedShot.cameraModel,
        lensBrand: suggestion.suggestedShot.lensBrand,
        lensModel: suggestion.suggestedShot.lensModel,
        appliedGearSuggestion: {
          suggestionId: suggestion.id,
          appliedAt: new Date().toISOString(),
          result: suggestion.suggestedShot,
        },
        gearSuggestions: (targetShot.gearSuggestions ?? []).filter((item) => item.id !== suggestion.id),
      })
      handleCreateEntityVersion({
        entityType: 'shot',
        entityId: suggestion.shotId,
        snapshot: snapshotShot(nextShot),
        changeType: 'ai-suggestion-applied',
        summary: '应用器材建议',
      })
      setCompareGearSuggestionId((prev) => (prev === suggestion.id ? null : prev))
      return
    }

    const nextShot = {
      ...targetShot,
      idea: suggestion.suggestedShot.idea,
      style: suggestion.suggestedShot.style,
      intent: suggestion.suggestedShot.intent,
      presetParams: suggestion.suggestedShot.presetParams,
    }
    useShotsStore.getState().updateShot(suggestion.shotId, {
      idea: suggestion.suggestedShot.idea,
      style: suggestion.suggestedShot.style,
      intent: suggestion.suggestedShot.intent,
      presetParams: suggestion.suggestedShot.presetParams,
      originalVersion: targetShot.originalVersion ?? suggestion.originalShot,
      appliedSuggestion: {
        suggestionId: suggestion.id,
        appliedAt: new Date().toISOString(),
        result: suggestion.suggestedShot,
      },
      suggestions: (targetShot.suggestions ?? []).filter((item) => item.id !== suggestion.id),
    })
    handleCreateEntityVersion({
      entityType: 'shot',
      entityId: suggestion.shotId,
      snapshot: snapshotShot(nextShot),
      changeType: 'ai-suggestion-applied',
      summary: '应用 AI 镜头建议',
    })

    if (suggestion.shotId === currentShotId) {
      setPrompt(suggestion.suggestedShot.idea)
      updateNode('prompt-1', { content: suggestion.suggestedShot.idea })
      setPro((prev) => ({ ...prev, ...suggestion.suggestedShot.presetParams }))
      setProMode(true)
    }

    setCompareSuggestionId((prev) => (prev === suggestion.id ? null : prev))
  }, [currentShotId, handleCreateEntityVersion, setPrompt, updateNode])

  const handleApplySuggestion = useCallback((suggestionId: string) => {
    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === currentShotId)
    const suggestion = targetShot?.suggestions?.find((item) => item.id === suggestionId)
    if (!suggestion) return
    applySuggestionCandidate(suggestion)
  }, [currentShotId, applySuggestionCandidate])

  const handleApplyGearSuggestion = useCallback((suggestionId: string) => {
    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === currentShotId)
    const suggestion = targetShot?.gearSuggestions?.find((item) => item.id === suggestionId)
    if (!suggestion) return
    applySuggestionCandidate(suggestion)
  }, [currentShotId, applySuggestionCandidate])

  const handleToggleCompareSuggestion = useCallback((suggestionId: string) => {
    setCompareSuggestionId((prev) => (prev === suggestionId ? null : suggestionId))
  }, [])

  const handleToggleCompareGearSuggestion = useCallback((suggestionId: string) => {
    setCompareGearSuggestionId((prev) => (prev === suggestionId ? null : suggestionId))
  }, [])

  const handleIgnoreSuggestion = useCallback((suggestionId: string) => {
    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === currentShotId)
    if (!targetShot) return
    useShotsStore.getState().updateShot(currentShotId, {
      suggestions: (targetShot.suggestions ?? []).filter((item) => item.id !== suggestionId),
    })
    setCompareSuggestionId((prev) => (prev === suggestionId ? null : prev))
  }, [currentShotId])

  const handleIgnoreGearSuggestion = useCallback((suggestionId: string) => {
    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === currentShotId)
    if (!targetShot) return
    useShotsStore.getState().updateShot(currentShotId, {
      gearSuggestions: (targetShot.gearSuggestions ?? []).filter((item) => item.id !== suggestionId),
    })
    setCompareGearSuggestionId((prev) => (prev === suggestionId ? null : prev))
  }, [currentShotId])

  const handleApplyCinematicSkill = useCallback((suggestion: ShotSuggestion) => {
    const skillId = suggestion.cinematicSkillId
    if (!skillId) return

    if (suggestion.applyTarget === 'sequence' && suggestion.targetSequenceId && narrative) {
      const nextNarrative = {
        ...narrative,
        sequences: narrative.sequences.map((sequence) => (
          sequence.id === suggestion.targetSequenceId
            ? {
                ...sequence,
                cinematicSkillIds: sequence.cinematicSkillIds?.includes(skillId)
                  ? sequence.cinematicSkillIds
                  : [...(sequence.cinematicSkillIds ?? []), skillId],
              }
            : sequence
        )),
      }
      const nextSequence = nextNarrative.sequences.find((sequence) => sequence.id === suggestion.targetSequenceId)
      useShotsStore.getState().setNarrative(nextNarrative)
      if (nextSequence) {
        handleCreateEntityVersion({
          entityType: 'sequence',
          entityId: nextSequence.id,
          snapshot: snapshotSequence(nextSequence),
          changeType: 'ai-suggestion-applied',
          summary: `应用电影语言技能：${suggestion.title}`,
        })
      }
      return
    }

    if (suggestion.applyTarget === 'editor-clip' && suggestion.targetClipId) {
      setEditorTimeline((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => {
          if (clip.id !== suggestion.targetClipId) return clip
          const nextClip = {
            ...clip,
            cinematicSkillIds: clip.cinematicSkillIds?.includes(skillId)
              ? clip.cinematicSkillIds
              : [...(clip.cinematicSkillIds ?? []), skillId],
          }
          handleCreateEntityVersion({
            entityType: 'editor-clip',
            entityId: clip.id,
            snapshot: snapshotEditorClip(nextClip),
            changeType: 'ai-suggestion-applied',
            summary: `应用电影语言技能：${suggestion.title}`,
          })
          return nextClip
        }),
      }))
      return
    }

    const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === suggestion.shotId)
    if (!targetShot) return
    const nextShot = {
      ...targetShot,
      presetParams: { ...(targetShot.presetParams ?? {}), ...(suggestion.suggestedShot.presetParams ?? {}) },
      cinematicSkillIds: targetShot.cinematicSkillIds?.includes(skillId)
        ? targetShot.cinematicSkillIds
        : [...(targetShot.cinematicSkillIds ?? []), skillId],
    }

    useShotsStore.getState().updateShot(suggestion.shotId, {
      presetParams: nextShot.presetParams,
      cinematicSkillIds: nextShot.cinematicSkillIds,
    })
    handleCreateEntityVersion({
      entityType: 'shot',
      entityId: suggestion.shotId,
      snapshot: snapshotShot(nextShot),
      changeType: 'ai-suggestion-applied',
      summary: `应用电影语言技能：${suggestion.title}`,
    })

    if (suggestion.shotId === currentShotId) {
      setPro((prev) => ({ ...prev, ...(suggestion.suggestedShot.presetParams ?? {}) }))
      setProMode(true)
    }
  }, [currentShotId, handleCreateEntityVersion, narrative])

  const handleGenerateCastingSuggestions = useCallback(() => {
    setCastingSuggestions(buildCastingSuggestions({
      shot: currentShot ?? shots[0],
      narrative,
      template: projectTemplate,
      existingRoles: roleBibles,
    }))
    setCompareCastingSuggestionId(null)
    setEditingCastingSuggestionId(null)
  }, [currentShot, narrative, projectTemplate, roleBibles, shots])

  const applyCastingSuggestion = useCallback((suggestion: CastingSuggestion) => {
    setRoleBibles((prev) => {
      const lockedRole = prev.find((role) => role.status === 'locked')
      if (lockedRole) {
        return prev.some((role) => role.id === suggestion.suggestedRoleBible.id)
          ? prev
          : [...prev, { ...suggestion.suggestedRoleBible, status: 'draft' }]
      }

      const existingIndex = prev.findIndex((role) => role.name === suggestion.suggestedRoleBible.name && role.roleType === suggestion.suggestedRoleBible.roleType)
      if (existingIndex >= 0) {
        return prev.map((role, index) => index === existingIndex ? { ...suggestion.suggestedRoleBible, status: role.status } : role)
      }
      return [...prev, suggestion.suggestedRoleBible]
    })
    setCastingSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id))
    setCompareCastingSuggestionId((prev) => (prev === suggestion.id ? null : prev))
    setEditingCastingSuggestionId((prev) => (prev === suggestion.id ? null : prev))
  }, [])

  const handleApplyCastingSuggestion = useCallback((suggestionId: string) => {
    const suggestion = castingSuggestions.find((item) => item.id === suggestionId)
    if (!suggestion) return
    applyCastingSuggestion(suggestion)
  }, [applyCastingSuggestion, castingSuggestions])

  const handleToggleCompareCastingSuggestion = useCallback((suggestionId: string) => {
    setCompareCastingSuggestionId((prev) => (prev === suggestionId ? null : suggestionId))
  }, [])

  const handleIgnoreCastingSuggestion = useCallback((suggestionId: string) => {
    setCastingSuggestions((prev) => prev.filter((item) => item.id !== suggestionId))
    setCompareCastingSuggestionId((prev) => (prev === suggestionId ? null : prev))
    setEditingCastingSuggestionId((prev) => (prev === suggestionId ? null : prev))
  }, [])

  const handleStartEditCastingSuggestion = useCallback((suggestionId: string | null) => {
    setEditingCastingSuggestionId(suggestionId)
  }, [])

  const handlePatchEditingCastingSuggestion = useCallback((patch: Partial<RoleBible>) => {
    setCastingSuggestions((prev) => prev.map((suggestion) => (
      suggestion.id === editingCastingSuggestionId
        ? {
            ...suggestion,
            suggestedRoleBible: {
              ...suggestion.suggestedRoleBible,
              ...patch,
              appearance: patch.appearance ? { ...suggestion.suggestedRoleBible.appearance, ...patch.appearance } : suggestion.suggestedRoleBible.appearance,
              performanceStyle: patch.performanceStyle ? { ...suggestion.suggestedRoleBible.performanceStyle, ...patch.performanceStyle } : suggestion.suggestedRoleBible.performanceStyle,
            },
          }
        : suggestion
    )))
  }, [editingCastingSuggestionId])

  const handleApplyEditedCastingSuggestion = useCallback(() => {
    if (!editingCastingSuggestionId) return
    const suggestion = castingSuggestions.find((item) => item.id === editingCastingSuggestionId)
    if (!suggestion) return
    applyCastingSuggestion(suggestion)
  }, [applyCastingSuggestion, castingSuggestions, editingCastingSuggestionId])

  const handleToggleRoleBibleLock = useCallback((roleId: string) => {
    setRoleBibles((prev) => prev.map((role) => {
      if (role.id !== roleId) {
        return role.status === 'locked' ? { ...role, status: 'draft' } : role
      }
      const nextStatus: RoleBible['status'] = role.status === 'locked' ? 'draft' : 'locked'
      const nextRole: RoleBible = { ...role, status: nextStatus }
      handleCreateEntityVersion({
        entityType: 'role-bible',
        entityId: roleId,
        snapshot: snapshotRoleBible(nextRole),
        changeType: 'manual-edit',
        summary: nextRole.status === 'locked' ? '锁定角色设定' : '解锁角色设定',
      })
      return nextRole
    }))
  }, [handleCreateEntityVersion])

  const handleGenerateStoryboardPrevis = useCallback(() => {
    const activeShot = currentShot ?? shots[0]
    const generated = generateStoryboardPrevis({
      sourceType: previsSourceType,
      sourcePrompt: (previsSourcePrompt || idea || activeShot?.idea || '').trim(),
      sourceImageUrl: previsSourceImageUrl.trim() || activeShot?.thumbnailUrl,
      duration: previsDuration,
      frameCount: previsFrameCount,
      frameStyle: previsFrameStyle,
      aspectRatio: previsAspectRatio,
      narrative,
      shots,
      currentShot: activeShot,
      projectTemplate,
      lockedRoleBible,
    })
    setStoryboardPrevis(generated.previs)
    setCharacterBible(generated.characterBible)
    setStyleBible(generated.styleBible)
    setEditingStoryboardFrameId(null)
    setActiveStoryboardFrameId(generated.previs.frames[0]?.id ?? null)
    setVideoConfigFrameId(null)
  }, [
    currentShot,
    idea,
    narrative,
    previsAspectRatio,
    previsDuration,
    previsFrameCount,
    previsFrameStyle,
    previsSourceImageUrl,
    previsSourcePrompt,
    previsSourceType,
    projectTemplate,
    lockedRoleBible,
    shots,
  ])

  const handleSelectStoryboardFrame = useCallback((frameId: string) => {
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      const frames = prev.frames.map((frame) => (
        frame.id === frameId ? { ...frame, status: 'selected' as const } : frame
      ))
      const nextFrame = frames.find((frame) => frame.id === frameId)
      if (nextFrame) {
        handleCreateEntityVersion({
          entityType: 'storyboard-frame',
          entityId: frameId,
          snapshot: snapshotStoryboardFrame(nextFrame),
          changeType: 'storyboard-selection',
          summary: '保留分镜单帧',
        })
      }
      return {
        ...prev,
        frames,
        status: frames.some((frame) => frame.status === 'selected') ? 'curated' : 'draft',
      }
    })
    setActiveStoryboardFrameId(frameId)
  }, [handleCreateEntityVersion])

  const handleDiscardStoryboardFrame = useCallback((frameId: string) => {
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      const frames = prev.frames.map((frame) => (
        frame.id === frameId ? { ...frame, status: 'discarded' as const } : frame
      ))
      const nextFrame = frames.find((frame) => frame.id === frameId)
      if (nextFrame) {
        handleCreateEntityVersion({
          entityType: 'storyboard-frame',
          entityId: frameId,
          snapshot: snapshotStoryboardFrame(nextFrame),
          changeType: 'storyboard-selection',
          summary: '删除分镜候选',
        })
      }
      return {
        ...prev,
        frames,
        status: frames.some((frame) => frame.status === 'selected') ? 'curated' : 'draft',
      }
    })
    setVideoConfigFrameId((prev) => (prev === frameId ? null : prev))
  }, [handleCreateEntityVersion])

  const handleDuplicateStoryboardFrame = useCallback((frameId: string) => {
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      const frame = prev.frames.find((item) => item.id === frameId)
      if (!frame) return prev
      const duplicate: StoryboardFrame = {
        ...frame,
        id: createId('frame'),
        timecode: `${frame.timecode} alt`,
        status: 'draft',
        createdAt: new Date().toISOString(),
      }
      return {
        ...prev,
        frames: [...prev.frames, duplicate],
      }
    })
  }, [])

  const handleRegenerateStoryboardFrame = useCallback((frameId: string) => {
    if (!styleBible || !storyboardPrevis) return
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        status: 'draft',
        frames: prev.frames.map((frame) => (
          frame.id === frameId
            ? regenerateStoryboardFrame({
                frame,
                styleBible,
                frameStyle: prev.frameStyle,
                aspectRatio: prev.aspectRatio,
              })
            : frame
        )),
      }
    })
  }, [storyboardPrevis, styleBible])

  const handleUpdateStoryboardFramePrompt = useCallback((frameId: string, imagePrompt: string) => {
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        frames: prev.frames.map((frame) => (
          frame.id === frameId ? { ...frame, imagePrompt, status: 'draft' } : frame
        )),
      }
    })
  }, [])

  const handlePatchStoryboardFrame = useCallback((frameId: string, patch: Partial<StoryboardFrame>) => {
    setStoryboardPrevis((prev) => {
      if (!prev) return prev
      const originalFrame = prev.frames.find((frame) => frame.id === frameId)
      const nextFrame = originalFrame ? { ...originalFrame, ...patch } : null
      if (nextFrame) {
        handleCreateEntityVersion({
          entityType: 'storyboard-frame',
          entityId: frameId,
          snapshot: snapshotStoryboardFrame(nextFrame),
          changeType: patch.status ? 'storyboard-selection' : 'manual-edit',
          summary: patch.status ? '更新分镜状态' : '修改分镜参数',
        })
      }
      return {
        ...prev,
        frames: prev.frames.map((frame) => (
          frame.id === frameId ? { ...frame, ...patch } : frame
        )),
      }
    })
  }, [handleCreateEntityVersion])

  const handleOpenStoryboardFrameEditor = useCallback((frameId: string, panel: CanvasActionPanel = 'camera') => {
    setActiveStoryboardFrameId(frameId)
    setRequestedPanel(panel)
  }, [])

  const handleStoryboardGenerateVideoPlaceholder = useCallback((frameId: string) => {
    setVideoConfigFrameId(frameId)
    setActiveStoryboardFrameId(frameId)
  }, [])

  const handleCreateShotDerivativeJob = useCallback((frameId: string) => {
    const frame = storyboardPrevis?.frames.find((item) => item.id === frameId)
    if (!frame || frame.status !== 'selected') return

    const job: ShotDerivativeJob = {
      id: createId('job'),
      storyboardFrameId: frame.id,
      sourceImageUrl: frame.imageUrl,
      videoPrompt: `${frame.imagePrompt}. Create a short moving shot with ${derivativeMovement} motion while preserving subject and style continuity.`,
      provider: derivativeProvider,
      duration: derivativeDuration,
      movement: derivativeMovement,
      motionStrength,
      characterConsistency: Boolean(frame.roleBibleId && frame.consistencyKey),
      characterConsistencyScore: characterConsistency,
      styleConsistency,
      roleBibleId: frame.roleBibleId,
      consistencyKey: frame.consistencyKey,
      status: derivativeProvider === 'mock' ? 'done' : 'failed',
      videoUrl: derivativeProvider === 'mock' ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : undefined,
      error: derivativeProvider === 'mock'
        ? undefined
        : `${derivativeProvider} 尚未接入，当前仅提供 mock 预演。${frame.roleBibleId ? '' : ' 当前镜头未绑定角色一致性信息。'}`,
    }

    setShotDerivativeJobs((prev) => [job, ...prev])
    handleCreateEntityVersion({
      entityType: 'video-shot',
      entityId: job.id,
      snapshot: snapshotVideoShot(job),
      changeType: 'manual-edit',
      summary: '创建视频镜头衍生任务',
    })
    setVideoConfigFrameId(null)
    setWorkspaceView('editor')
  }, [
    characterConsistency,
    derivativeDuration,
    derivativeMovement,
    derivativeProvider,
    handleCreateEntityVersion,
    motionStrength,
    storyboardPrevis,
    styleConsistency,
  ])

  const handleRetryShotDerivativeJob = useCallback((jobId: string) => {
    setShotDerivativeJobs((prev) => prev.map((job) => (
      job.id === jobId
        ? {
            ...job,
            status: job.provider === 'mock' ? 'done' : 'failed',
            videoUrl: job.provider === 'mock' ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : undefined,
            error: job.provider === 'mock' ? undefined : `${job.provider} 尚未接入，当前仅提供 mock 预演。`,
          }
        : job
    )))
  }, [])

  const handleAddDerivativeJobToEditor = useCallback((jobId: string) => {
    const job = shotDerivativeJobs.find((item) => item.id === jobId)
    if (!job?.videoUrl) return
    const videoUrl = job.videoUrl
    const frame = storyboardPrevis?.frames.find((item) => item.id === job.storyboardFrameId)
    setEditorTimeline((prev) => {
      if (prev.clips.some((clip) => clip.sourceJobId === jobId)) return prev
      const nextClip: EditorClip = {
        id: createId('clip'),
        sourceJobId: jobId,
        sourceFrameId: job.storyboardFrameId,
        videoUrl,
        title: frame?.timecode ? `${frame.timecode} ${frame.intent ?? '镜头'}` : '视频镜头',
        description: frame?.description ?? '从分镜单帧衍生的视频镜头',
        order: prev.clips.length,
        duration: job.duration,
        transition: prev.clips.length === 0 ? 'cut' : 'fade',
        pacing: job.duration <= 5 ? 'fast' : job.duration >= 15 ? 'slow' : 'medium',
        note: '从分镜单帧衍生的视频镜头',
      }
      handleCreateEntityVersion({
        entityType: 'editor-clip',
        entityId: nextClip.id,
        snapshot: snapshotEditorClip(nextClip),
        changeType: 'clip-review-action',
        summary: '确认使用视频镜头并加入剪辑',
      })
      return {
        ...prev,
        clips: [
          ...prev.clips,
          nextClip,
        ],
      }
    })
  }, [handleCreateEntityVersion, shotDerivativeJobs, storyboardPrevis])

  const handleMoveEditorClip = useCallback((clipId: string, direction: 'up' | 'down') => {
    setEditorTimeline((prev) => {
      const ordered = [...prev.clips].sort((a, b) => a.order - b.order)
      const index = ordered.findIndex((clip) => clip.id === clipId)
      if (index === -1) return prev
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= ordered.length) return prev
      const swap = ordered[targetIndex]!
      const current = ordered[index]!
      ordered[index] = swap
      ordered[targetIndex] = current
      const updated = ordered.map((clip, order) => ({ ...clip, order }))
      const changedClip = updated.find((clip) => clip.id === clipId)
      if (changedClip) {
        handleCreateEntityVersion({
          entityType: 'editor-clip',
          entityId: clipId,
          snapshot: snapshotEditorClip(changedClip),
          changeType: 'editor-reorder',
          summary: `调整剪辑顺序（${direction === 'up' ? '上移' : '下移'}）`,
        })
      }
      return {
        ...prev,
        clips: updated,
      }
    })
  }, [handleCreateEntityVersion])

  const handleRemoveEditorClip = useCallback((clipId: string) => {
    setEditorTimeline((prev) => ({
      ...prev,
      clips: prev.clips
        .filter((clip) => clip.id !== clipId)
        .sort((a, b) => a.order - b.order)
        .map((clip, order) => ({ ...clip, order })),
    }))
  }, [])

  const handleSetClipTransition = useCallback((clipId: string, transition: EditorClip['transition']) => {
    setEditorTimeline((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        const nextClip = { ...clip, transition }
        handleCreateEntityVersion({
          entityType: 'editor-clip',
          entityId: clipId,
          snapshot: snapshotEditorClip(nextClip),
          changeType: 'manual-edit',
          summary: '修改转场设置',
        })
        return nextClip
      }),
    }))
  }, [handleCreateEntityVersion])

  const handleSetClipPacing = useCallback((clipId: string, pacing: EditorClip['pacing']) => {
    setEditorTimeline((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        const nextClip = { ...clip, pacing }
        handleCreateEntityVersion({
          entityType: 'editor-clip',
          entityId: clipId,
          snapshot: snapshotEditorClip(nextClip),
          changeType: 'manual-edit',
          summary: '修改剪辑节奏',
        })
        return nextClip
      }),
    }))
  }, [handleCreateEntityVersion])

  const handleTimelinePacingGoalChange = useCallback((pacingGoal: EditorTimeline['pacingGoal']) => {
    setEditorTimeline((prev) => {
      const nextTimeline = { ...prev, pacingGoal }
      handleCreateEntityVersion({
        entityType: 'editor-timeline',
        entityId: prev.id,
        snapshot: snapshotEditorTimeline(nextTimeline),
        changeType: 'manual-edit',
        summary: '修改剪辑台节奏目标',
      })
      return nextTimeline
    })
  }, [handleCreateEntityVersion])

  const handleTimelineMusicDirectionChange = useCallback((musicDirection: string) => {
    setEditorTimeline((prev) => {
      const nextTimeline = { ...prev, musicDirection }
      handleCreateEntityVersion({
        entityType: 'editor-timeline',
        entityId: prev.id,
        snapshot: snapshotEditorTimeline(nextTimeline),
        changeType: 'manual-edit',
        summary: '修改剪辑台音乐方向',
      })
      return nextTimeline
    })
  }, [handleCreateEntityVersion])

  const handleApplyEditSuggestion = useCallback((suggestion: EditSuggestion) => {
    if (!suggestion.targetClipId && suggestion.type !== 'music-direction') return
    switch (suggestion.type) {
      case 'opening-shot':
      case 'reorder':
        if (suggestion.targetClipId) handleMoveEditorClip(suggestion.targetClipId, 'up')
        break
      case 'transition':
        if (suggestion.targetClipId) handleSetClipTransition(suggestion.targetClipId, 'fade')
        break
      case 'pacing':
      case 'remove-repetition':
        if (suggestion.targetClipId) handleSetClipPacing(suggestion.targetClipId, 'fast')
        break
      case 'music-direction':
        handleTimelineMusicDirectionChange(editorTimeline.musicDirection || 'tight electronic pulse')
        break
      default:
        break
    }
  }, [editorTimeline.musicDirection, handleMoveEditorClip, handleSetClipPacing, handleSetClipTransition, handleTimelineMusicDirectionChange])

  const handleExportEditPlan = useCallback(() => {
    const sortedClips = [...editorTimeline.clips].sort((a, b) => a.order - b.order)
    const aiSuggestions = [
      sortedClips[0] ? `opening-shot: ${sortedClips[0].title} 可作为当前开场候选。` : null,
      sortedClips.length > 1 && sortedClips.every((clip) => clip.transition === 'cut') ? 'transition: 当前序列全部为 cut，可考虑至少保留一个 fade 或 dissolve。' : null,
      sortedClips.length > 1 && sortedClips.every((clip) => clip.pacing === sortedClips[0]?.pacing) ? 'pacing: 当前所有 clip 节奏一致，建议保留快慢变化。' : null,
      editorTimeline.musicDirection ? `music-direction: ${editorTimeline.musicDirection}` : 'music-direction: 尚未定义音乐方向。',
    ].filter(Boolean)
    const exportPayload = {
      timelineId: editorTimeline.id,
      pacingGoal: editorTimeline.pacingGoal,
      musicDirection: editorTimeline.musicDirection,
      status: editorTimeline.status,
      clips: sortedClips.map((clip) => ({
        order: clip.order,
        title: clip.title,
        videoUrl: clip.videoUrl,
        transition: clip.transition,
        pacing: clip.pacing,
        note: clip.note,
      })),
      aiSuggestions,
    }
    downloadJson('creator-city-edit-plan.json', exportPayload)
  }, [editorTimeline])

  const handleIgnoreClipReviewRecommendation = useCallback((reviewId: string, actionId: string) => {
    setIgnoredClipReviewActions((prev) => [...prev, `${reviewId}:${actionId}`])
  }, [])

  const handleApplyClipReviewRecommendation = useCallback((review: ClipReview, actionId: string) => {
    const recommendation = review.recommendations.find((item) => item.id === actionId)
    if (!recommendation) return
    const job = shotDerivativeJobs.find((item) => item.id === review.sourceJobId)
    const frame = storyboardPrevis?.frames.find((item) => item.id === review.sourceFrameId)

    switch (recommendation.action) {
      case 'accept':
        setAcceptedClipReviewIds((prev) => prev.includes(review.id) ? prev : [...prev, review.id])
        if (job) {
          handleCreateEntityVersion({
            entityType: 'video-shot',
            entityId: job.id,
            snapshot: snapshotVideoShot(job),
            changeType: 'clip-review-action',
            summary: '接受审片结果',
          })
        }
        break
      case 'send-to-editor':
        if (!window.confirm('确认把这条镜头送入剪辑台吗？')) return
        handleAddDerivativeJobToEditor(review.sourceJobId)
        break
      case 'open-casting':
        setWorkspaceView('canvas')
        setRequestedPanel('casting')
        break
      case 'adjust-motion':
        if (frame) {
          setActiveStoryboardFrameId(frame.id)
          setWorkspaceView('previs')
          setRequestedPanel('movement')
        }
        break
      case 'change-provider':
        if (frame) {
          setActiveStoryboardFrameId(frame.id)
          setVideoConfigFrameId(frame.id)
          setWorkspaceView('previs')
          setRequestedPanel('previs')
        }
        break
      case 'edit-prompt':
        if (frame) {
          setActiveStoryboardFrameId(frame.id)
          setEditingStoryboardFrameId(frame.id)
          setWorkspaceView('previs')
          setRequestedPanel('previs')
        }
        break
      case 'regenerate':
        if (!window.confirm('确认重生成这条镜头吗？系统会保留原镜头，不会自动替换。')) return
        if (job) {
          const nextJob: ShotDerivativeJob = {
            ...job,
            id: createId('job'),
            status: job.provider === 'mock' ? 'done' : 'failed',
            videoUrl: job.provider === 'mock' ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : undefined,
            error: job.provider === 'mock' ? undefined : `${job.provider} 尚未接入，当前仅提供 mock 预演。`,
          }
          setShotDerivativeJobs((prev) => [nextJob, ...prev])
          handleCreateEntityVersion({
            entityType: 'video-shot',
            entityId: nextJob.id,
            snapshot: snapshotVideoShot(nextJob),
            changeType: 'clip-review-action',
            summary: '根据审片建议重生成镜头',
          })
        }
        break
      default:
        break
    }
  }, [handleAddDerivativeJobToEditor, handleCreateEntityVersion, shotDerivativeJobs, storyboardPrevis])

  const handleAddDialogueLine = useCallback((draft: Omit<DialogueLine, 'id'>) => {
    const line: DialogueLine = {
      id: createId('dialogue'),
      ...draft,
    }
    addDialogueLine(line)
  }, [addDialogueLine])

  const handleGenerateVoiceTakes = useCallback((dialogueLineId: string, provider: 'mock' | 'elevenlabs') => {
    const line = dialogueLines.find((item) => item.id === dialogueLineId)
    if (!line) return
    const role = line.roleBibleId ? roleBibles.find((item) => item.id === line.roleBibleId) ?? null : lockedRoleBible
    upsertVoiceTakes(
      generateMockVoiceTakes(line, role).map((take) => ({
        ...take,
        provider: provider === 'elevenlabs' ? 'elevenlabs' : 'mock',
      }))
    )
  }, [dialogueLines, lockedRoleBible, roleBibles, upsertVoiceTakes])

  const handleCreateLipSyncJob = useCallback((args: {
    targetVideoClipId: string
    voiceTakeId: string
    provider: LipSyncJob['provider']
  }) => {
    const job = createMockLipSyncJob(args)
    addLipSyncJob(job)
  }, [addLipSyncJob])

  const handleGenerateMusicCueCandidates = useCallback((args?: { sequenceId?: string; provider?: 'mock' | 'elevenlabs' }) => {
    const sequence = args?.sequenceId ? narrative?.sequences.find((item) => item.id === args.sequenceId) ?? null : narrative?.sequences[0] ?? null
    upsertMusicCues(
      generateMockMusicCues({
        sequence,
        timelineId: editorTimeline.id,
        existingClipCount: editorTimeline.clips.length,
      }).map((cue) => ({
        ...cue,
        provider: args?.provider === 'elevenlabs' ? 'eleven-music' : cue.provider,
      }))
    )
  }, [editorTimeline.clips.length, editorTimeline.id, narrative?.sequences, upsertMusicCues])

  const handleGenerateSoundEffectCandidates = useCallback((clipId: string, provider: 'mock' | 'elevenlabs') => {
    const clip = editorTimeline.clips.find((item) => item.id === clipId)
    if (!clip) return
    upsertSoundEffectCues(
      generateMockSoundEffects(clip).map((cue) => ({
        ...cue,
        provider: provider === 'elevenlabs' ? 'elevenlabs' : cue.provider,
      }))
    )
  }, [editorTimeline.clips, upsertSoundEffectCues])

  const handleSendLipSyncToEditor = useCallback((jobId: string) => {
    const job = lipSyncJobs.find((item) => item.id === jobId)
    if (!job || job.status !== 'done') return
    const targetClip = editorTimeline.clips.find((clip) => clip.sourceJobId === job.targetVideoClipId)
    if (!targetClip) {
      setWorkspaceView('editor')
      return
    }
    if (!window.confirm('确认把这条口型同步结果作为剪辑参考发送到 Editor Desk 吗？原视频不会被自动覆盖。')) return
    setEditorTimeline((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => clip.id === targetClip.id ? { ...clip, note: `${clip.note ?? ''}${clip.note ? ' · ' : ''}附带 lip sync 参考 ${job.id}` } : clip),
    }))
    handleCreateEntityVersion({
      entityType: 'editor-clip',
      entityId: targetClip.id,
      snapshot: snapshotEditorClip({ ...targetClip, note: `${targetClip.note ?? ''}${targetClip.note ? ' · ' : ''}附带 lip sync 参考 ${job.id}` }),
      changeType: 'manual-edit',
      summary: '附加 lip sync 参考到剪辑片段',
    })
    setWorkspaceView('editor')
  }, [editorTimeline.clips, handleCreateEntityVersion, lipSyncJobs])

  const handleSelectMusicMotif = useCallback((motifId: string, status: MusicMotif['status']) => {
    updateMusicMotifStatus(motifId, status)
  }, [updateMusicMotifStatus])

  const handleAddAudioTimelineClipFromSource = useCallback((args: {
    sourceType: AudioTimelineClip['sourceType']
    sourceId: string
    targetEditorClipId?: string
    targetSequenceId?: string
  }) => {
    if (!audioTimeline) return

    const trackTypeMap: Record<AudioTimelineClip['sourceType'], AudioTrack['type']> = {
      'voice-take': 'dialogue',
      'music-cue': 'music',
      'sfx-cue': 'sfx',
      'lip-sync-job': 'lip-sync',
      ambience: 'ambience',
    }
    const trackType = trackTypeMap[args.sourceType]
    const existingTrack = audioTimeline.tracks.find((track) => track.type === trackType)
    const duplicate = existingTrack?.clips.find((clip) => (
      clip.sourceType === args.sourceType
      && clip.sourceId === args.sourceId
      && clip.targetEditorClipId === args.targetEditorClipId
      && clip.targetSequenceId === args.targetSequenceId
    ))
    if (duplicate) return

    const targetClip = args.targetEditorClipId
      ? orderedEditorClips.find((clip) => clip.id === args.targetEditorClipId)
      : orderedEditorClips.find((clip) => {
          const frame = storyboardPrevis?.frames.find((item) => item.id === clip.sourceFrameId)
          return frame?.sequenceId === args.targetSequenceId
        })

    const clipStart = targetClip
      ? orderedEditorClips
          .filter((clip) => clip.order < targetClip.order)
          .reduce((sum, clip) => sum + clip.duration, 0)
      : 0

    let startTime = clipStart
    let endTime = clipStart + (targetClip?.duration ?? 3)

    if (args.sourceType === 'voice-take') {
      const take = voiceTakes.find((item) => item.id === args.sourceId)
      const line = take ? dialogueLines.find((item) => item.id === take.dialogueLineId) : undefined
      startTime = clipStart + (line?.startTime ?? 0)
      endTime = clipStart + (line?.endTime ?? ((line?.startTime ?? 0) + (take?.duration ?? 3)))
    } else if (args.sourceType === 'music-cue') {
      const cue = musicCues.find((item) => item.id === args.sourceId)
      const sequenceClips = orderedEditorClips.filter((clip) => {
        const frame = storyboardPrevis?.frames.find((item) => item.id === clip.sourceFrameId)
        return frame?.sequenceId === (args.targetSequenceId ?? cue?.targetSequenceId)
      })
      if (sequenceClips.length > 0) {
        const firstClip = sequenceClips[0]!
        startTime = orderedEditorClips
          .filter((clip) => clip.order < firstClip.order)
          .reduce((sum, clip) => sum + clip.duration, 0)
        endTime = startTime + Math.max(
          cue?.duration ?? 8,
          sequenceClips.reduce((sum, clip) => sum + clip.duration, 0)
        )
      } else if (cue) {
        endTime = startTime + cue.duration
      }
    } else if (args.sourceType === 'sfx-cue') {
      endTime = startTime + 1.2
    } else if (args.sourceType === 'lip-sync-job') {
      const lipSyncJob = lipSyncJobs.find((item) => item.id === args.sourceId)
      const sourceJob = lipSyncJob ? shotDerivativeJobs.find((item) => item.id === lipSyncJob.targetVideoClipId) : undefined
      endTime = startTime + (sourceJob?.duration ?? targetClip?.duration ?? 5)
    }

    upsertAudioTimelineClip(audioTimeline.id, trackType, createAudioTimelineClip({
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      targetEditorClipId: args.targetEditorClipId,
      targetSequenceId: args.targetSequenceId,
      startTime,
      endTime,
    }))
    updateAudioTimelineStatus(audioTimeline.id, 'review')
  }, [audioTimeline, dialogueLines, lipSyncJobs, musicCues, orderedEditorClips, shotDerivativeJobs, storyboardPrevis?.frames, updateAudioTimelineStatus, upsertAudioTimelineClip, voiceTakes])

  const handleUpdateAudioTimelineClip = useCallback((trackType: AudioTrack['type'], clipId: string, patch: Partial<AudioTimelineClip>) => {
    if (!audioTimeline) return
    updateAudioTimelineClip(audioTimeline.id, trackType, clipId, patch)
  }, [audioTimeline, updateAudioTimelineClip])

  const handleUpdateCuePoint = useCallback((cueId: string, patch: { approved?: boolean; description?: string; intensity?: number }) => {
    if (!cueSheet) return
    updateCuePoint(cueSheet.id, cueId, patch)
  }, [cueSheet, updateCuePoint])

  const handleUpdateCueSheetState = useCallback((status: CueSheet['status']) => {
    if (!cueSheet) return
    updateCueSheetStatus(cueSheet.id, status)
  }, [cueSheet, updateCueSheetStatus])

  const handleCreateDirectorNote = useCallback((draft: DirectorNoteDraft & {
    content: string
    category: DirectorNoteCategory
    priority: DirectorNotePriority
    assignedTo?: string
  }) => {
    const trimmed = draft.content.trim()
    if (!trimmed) return null
    const created = addDirectorNote({
      targetType: draft.targetType,
      targetId: draft.targetId,
      category: draft.category,
      priority: draft.priority,
      status: 'open',
      content: trimmed,
      createdBy: currentUser?.displayName ?? '我',
      assignedTo: draft.assignedTo,
      aiSummary: draft.priority === 'blocker'
        ? '这条批注会直接影响阶段推进，建议优先处理。'
        : '这条批注建议在进入下一阶段前完成复核。',
    })
    handleCreateEntityVersion({
      entityType: 'director-note',
      entityId: created.id,
      snapshot: snapshotDirectorNote(created),
      changeType: 'director-note-action',
      summary: '创建导演批注',
    })
    return created
  }, [addDirectorNote, currentUser?.displayName, handleCreateEntityVersion])

  const handleReplyDirectorNote = useCallback((noteId: string, content: string) => {
    if (!content.trim()) return
    addDirectorNoteReply(noteId, {
      authorId: currentUser?.displayName ?? '我',
      content: content.trim(),
    })
  }, [addDirectorNoteReply, currentUser?.displayName])

  const handleDirectorNoteStatusChange = useCallback((noteId: string, status: DirectorNoteStatus) => {
    updateDirectorNoteStatus(noteId, status)
    const note = notes.find((item) => item.id === noteId)
    if (note) {
      handleCreateEntityVersion({
        entityType: 'director-note',
        entityId: noteId,
        snapshot: snapshotDirectorNote({ ...note, status }),
        changeType: 'director-note-action',
        summary: `批注状态更新为 ${status}`,
      })
    }
  }, [handleCreateEntityVersion, notes, updateDirectorNoteStatus])

  const handleLocateDirectorNote = useCallback((note: DirectorNote) => {
    setRequestedPanel(null)
    setFocusedSequenceId(null)
    setFocusedShotId(null)
    setFocusedStoryboardFrameId(null)
    setFocusedVideoJobId(null)
    setFocusedEditorClipId(null)
    setFocusedRoleBibleId(null)
    setRequestedReviewId(null)

    switch (note.targetType) {
      case 'sequence':
        setWorkspaceView('canvas')
        setFocusedSequenceId(note.targetId)
        break
      case 'shot':
        setWorkspaceView('canvas')
        setFocusedShotId(note.targetId)
        if (note.targetId !== currentShotId) {
          useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
          useShotsStore.getState().setCurrentShotId(note.targetId)
          const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === note.targetId)
          if (targetShot) {
            resetCanvas(targetShot.nodes, targetShot.edges)
            setPrompt(targetShot.idea)
          }
        }
        break
      case 'storyboard-frame':
        setWorkspaceView('previs')
        setFocusedStoryboardFrameId(note.targetId)
        setActiveStoryboardFrameId(note.targetId)
        setRequestedPanel('previs')
        break
      case 'video-shot':
        setWorkspaceView('footage')
        setFocusedVideoJobId(note.targetId)
        break
      case 'editor-clip':
        setWorkspaceView('editor')
        setFocusedEditorClipId(note.targetId)
        break
      case 'role-bible':
        setWorkspaceView('canvas')
        setFocusedRoleBibleId(note.targetId)
        setRequestedPanel('casting')
        break
      case 'editor-timeline':
        setWorkspaceView('editor')
        break
      case 'audio-timeline':
        setWorkspaceView('audio')
        break
      case 'project-brief':
        setWorkspaceView('canvas')
        break
      case 'delivery':
        setWorkspaceView('delivery')
        break
      case 'clip-review':
        setWorkspaceView('footage')
        setRequestedReviewId(note.targetId)
        break
      case 'project':
        setWorkspaceView('canvas')
        break
      default:
        break
    }
  }, [canvasEdges, canvasNodes, currentShotId, resetCanvas, setPrompt])

  const handleConvertNoteToTask = useCallback((noteId: string) => {
    const draft = convertNoteToTaskDraft(noteId)
    if (!draft || !activeTeam) return
    const note = notes.find((item) => item.id === noteId)
    if (!note) return
    const assignedMember = activeTeam.members.find((member) => member.userId === draft.assignedTo)
    const assignedTo = assignedMember?.userId ?? activeTeam.ownerId
    const assignedName = assignedMember?.name ?? currentUser?.displayName ?? '我'
    const confirmed = window.confirm(`确认把这条导演批注转成任务吗？\n\n${draft.title}`)
    if (!confirmed) return
    createTask(activeTeam.id, draft.title, assignedTo, assignedName)
    updateDirectorNoteStatus(noteId, 'in-progress')
    const updatedNote = notes.find((item) => item.id === noteId)
    if (updatedNote) {
      handleCreateEntityVersion({
        entityType: 'director-note',
        entityId: noteId,
        snapshot: snapshotDirectorNote({ ...updatedNote, status: 'in-progress' }),
        changeType: 'director-note-action',
        summary: '将批注转为任务',
      })
    }
  }, [activeTeam, convertNoteToTaskDraft, createTask, currentUser?.displayName, handleCreateEntityVersion, notes, updateDirectorNoteStatus])

  const handleDraftNoteFromClipReviewIssue = useCallback((review: ClipReview, issueId: string) => {
    const issue = review.issues.find((item) => item.id === issueId)
    if (!issue) return
    setRequestedNoteDraft({
      targetType: 'clip-review',
      targetId: review.id,
      category: issue.type === 'character-drift' ? 'continuity' : issue.type === 'style-mismatch' ? 'color' : issue.type === 'motion-artifact' ? 'camera' : issue.type === 'editing-risk' ? 'editing' : 'creative',
      priority: issue.severity === 'strong' ? 'blocker' : issue.severity === 'warning' ? 'high' : 'medium',
      content: issue.message,
      assignedTo: currentUser?.id,
    })
    setWorkspaceView('canvas')
    setRequestedPanel('notes')
  }, [currentUser?.id])

  const handleCreateApprovalRequest = useCallback((draft: {
    targetType: ApprovalTargetType
    targetId: string
    title: string
    description?: string
    requiredRoles: ApprovalRole[]
    linkedVersionId?: string
  }) => {
    if (draft.requiredRoles.length === 0) return null
    const linkedVersionId = draft.linkedVersionId ?? ensureApprovalVersion(draft.targetType, draft.targetId)
    const created = createApprovalRequest(draft.targetType, draft.targetId, draft.requiredRoles, {
      title: draft.title,
      description: draft.description,
      linkedVersionId,
      createdBy: currentUser?.displayName ?? '我',
    })
    if (activeOrder?.chatId) {
      sendJobMessage(activeOrder.chatId, 'system', `${draft.title} 已提交${draft.requiredRoles.map((role) => APPROVAL_ROLE_META[role].label).join(' / ')}确认。`)
    }
    return created
  }, [activeOrder?.chatId, createApprovalRequest, currentUser?.displayName, ensureApprovalVersion, sendJobMessage])

  const handleCreateTaskFromApprovalComment = useCallback((comment: string, assignedTo?: string) => {
    if (!activeTeam || !comment.trim()) return
    const assignedMember = activeTeam.members.find((member) => member.userId === assignedTo)
    const finalAssignedTo = assignedMember?.userId ?? activeTeam.ownerId
    const finalAssignedName = assignedMember?.name ?? currentUser?.displayName ?? '我'
    const confirmed = window.confirm(`确认把这条确认意见转成任务吗？\n\n${comment.trim()}`)
    if (!confirmed) return
    createTask(activeTeam.id, `[确认修改] ${comment.trim().slice(0, 48)}`, finalAssignedTo, finalAssignedName)
  }, [activeTeam, createTask, currentUser?.displayName])

  const handleApprovalDecision = useCallback((draft: {
    approvalId: string
    role: ApprovalRole
    status: ApprovalDecision['status']
    comment: string
    followUp: 'note' | 'task' | 'comment'
    assignedTo?: string
  }) => {
    const approval = approvals.find((item) => item.id === draft.approvalId)
    if (!approval || approval.status === 'stale') return null
    if (draft.status === 'changes-requested' && !draft.comment.trim()) return null
    const nextApproval = addApprovalDecision(draft.approvalId, {
      role: draft.role,
      userId: currentUser?.id ?? draft.role,
      status: draft.status,
      comment: draft.comment.trim() || undefined,
      versionId: approval.linkedVersionId,
    })
    if (!nextApproval) return null

    if (activeOrder?.chatId) {
      const statusLabel = draft.status === 'approved' ? '已确认通过' : draft.status === 'changes-requested' ? '请求修改' : '已拒绝'
      sendJobMessage(activeOrder.chatId, 'system', `${APPROVAL_ROLE_META[draft.role].label}${statusLabel} ${approval.title}。`)
    }

    if (draft.status === 'changes-requested') {
      if (draft.followUp === 'note') {
        const confirmed = window.confirm(`确认把这条修改意见转成导演批注吗？\n\n${draft.comment.trim()}`)
        if (confirmed) {
          setRequestedNoteDraft({
            targetType: approval.targetType as DirectorNoteTargetType,
            targetId: approval.targetId,
            category: mapApprovalTargetToNoteCategory(approval.targetType),
            priority: 'high',
            content: draft.comment.trim(),
            assignedTo: draft.assignedTo,
          })
          setWorkspaceView('canvas')
          setRequestedPanel('notes')
        }
      } else if (draft.followUp === 'task') {
        handleCreateTaskFromApprovalComment(draft.comment.trim(), draft.assignedTo)
      }
    }

    return nextApproval
  }, [activeOrder, addApprovalDecision, approvals, currentUser?.id, handleCreateTaskFromApprovalComment, sendJobMessage])

  const handleLocateApprovalTarget = useCallback((targetType: ApprovalTargetType, targetId: string) => {
    setRequestedPanel('approval')
    setFocusedSequenceId(null)
    setFocusedShotId(null)
    setFocusedStoryboardFrameId(null)
    setFocusedVideoJobId(null)
    setFocusedEditorClipId(null)
    setFocusedRoleBibleId(null)

    switch (targetType) {
      case 'sequence':
        setWorkspaceView('canvas')
        setFocusedSequenceId(targetId)
        break
      case 'shot': {
        setWorkspaceView('canvas')
        setFocusedShotId(targetId)
        if (targetId !== currentShotId) {
          useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
          useShotsStore.getState().setCurrentShotId(targetId)
          const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === targetId)
          if (targetShot) {
            resetCanvas(targetShot.nodes, targetShot.edges)
            setPrompt(targetShot.idea)
          }
        }
        break
      }
      case 'storyboard-frame':
        setWorkspaceView('previs')
        setFocusedStoryboardFrameId(targetId)
        setActiveStoryboardFrameId(targetId)
        break
      case 'video-shot':
        setWorkspaceView('footage')
        setFocusedVideoJobId(targetId)
        break
      case 'editor-clip':
        setWorkspaceView('editor')
        setFocusedEditorClipId(targetId)
        break
      case 'role-bible':
        setWorkspaceView('canvas')
        setFocusedRoleBibleId(targetId)
        setRequestedPanel('casting')
        break
      case 'editor-timeline':
        setWorkspaceView('editor')
        break
      case 'delivery':
        setWorkspaceView('delivery')
        break
      case 'project-brief':
        setWorkspaceView('canvas')
        break
      default:
        break
    }
  }, [canvasEdges, canvasNodes, currentShotId, resetCanvas, setPrompt])

  const handleRequestedPanelHandled = useCallback(() => {
    setRequestedPanel(null)
  }, [])

  const handleCreateDeliveryPackage = useCallback(() => {
    const existing = useDeliveryPackageStore.getState().deliveryPackages.find((pkg) => pkg.projectId === deliveryProjectId)
    if (existing) {
      setWorkspaceView('delivery')
      return existing
    }
    const created = createDeliveryPackage(deliveryProjectId, {
      title: `${deliveryProjectTitle} · 交付包`,
      description: '商业交付包草稿。由你决定最终纳入哪些交付资产、确认记录与版本依据。',
    })
    setWorkspaceView('delivery')
    return created
  }, [createDeliveryPackage, deliveryProjectId, deliveryProjectTitle])

  const handleToggleDeliveryAssetIncluded = useCallback((assetId: string) => {
    if (!activeDeliveryPackage) return
    useDeliveryPackageStore.getState().toggleAssetIncluded(activeDeliveryPackage.id, assetId)
  }, [activeDeliveryPackage])

  const handlePreviewDeliveryAsset = useCallback((asset: DeliveryAsset) => {
    if (asset.url) {
      window.open(asset.url, '_blank', 'noopener,noreferrer')
      return
    }

    switch (asset.type) {
      case 'storyboard-frame':
        setWorkspaceView('previs')
        setFocusedStoryboardFrameId(asset.sourceId)
        setActiveStoryboardFrameId(asset.sourceId)
        break
      case 'video-shot':
        setWorkspaceView('footage')
        setFocusedVideoJobId(asset.sourceId)
        break
      case 'editor-timeline':
        setWorkspaceView('editor')
        break
      case 'audio-timeline':
      case 'music-cue':
      case 'voice-take':
        setWorkspaceView('audio')
        break
      case 'director-note': {
        const note = notes.find((item) => item.id === asset.sourceId)
        if (note) handleLocateDirectorNote(note)
        break
      }
      case 'approval-record': {
        const approval = approvals.find((item) => item.id === asset.sourceId)
        if (approval) handleLocateApprovalTarget(approval.targetType, approval.targetId)
        break
      }
      case 'version-record':
        setWorkspaceView('delivery')
        break
      default:
        break
    }
  }, [approvals, handleLocateApprovalTarget, handleLocateDirectorNote, notes])

  const handleViewDeliveryVersion = useCallback((asset: DeliveryAsset) => {
    const version = versions.find((item) => item.id === asset.sourceId)
    if (!version) return
    window.alert([
      `版本：${version.label}`,
      `类型：${version.entityType}`,
      `摘要：${version.summary}`,
      version.changedFields.length ? `变更字段：${version.changedFields.join('、')}` : '变更字段：无',
      `时间：${new Date(version.createdAt).toLocaleString('zh-CN')}`,
    ].join('\n'))
  }, [versions])

  const handleViewDeliveryApproval = useCallback((asset: DeliveryAsset) => {
    const approval = approvals.find((item) => item.id === asset.sourceId)
    if (!approval) return
    window.alert([
      `确认项：${approval.title}`,
      `状态：${approval.status}`,
      `目标：${approval.targetType}`,
      `要求角色：${approval.requiredRoles.join(' / ')}`,
      approval.description ? `说明：${approval.description}` : '说明：无',
    ].join('\n'))
    handleLocateApprovalTarget(approval.targetType, approval.targetId)
  }, [approvals, handleLocateApprovalTarget])

  const handleExportDeliverySummary = useCallback(() => {
    if (!activeDeliveryPackage) return
    const refreshedManifest = generateDeliveryManifest(activeDeliveryPackage.id, {
      projectTitle: deliveryProjectTitle,
      projectStage: currentStage,
      finalVersion: latestDeliveryVersion?.label ?? activeDeliveryPackage.manifest?.finalVersion ?? 'v0',
    })
    const refreshedRisk = generateDeliveryRiskSummary(activeDeliveryPackage.id)
    const pkg = {
      ...(useDeliveryPackageStore.getState().deliveryPackages.find((item) => item.id === activeDeliveryPackage.id) ?? activeDeliveryPackage),
      manifest: refreshedManifest ?? activeDeliveryPackage.manifest,
      riskSummary: refreshedRisk ?? activeDeliveryPackage.riskSummary,
    }
    downloadText('delivery-summary.txt', buildDeliverySummaryText(pkg))
  }, [activeDeliveryPackage, currentStage, deliveryProjectTitle, generateDeliveryManifest, generateDeliveryRiskSummary, latestDeliveryVersion?.label])

  const handleExportDeliveryManifest = useCallback(() => {
    if (!activeDeliveryPackage) return
    const manifest = generateDeliveryManifest(activeDeliveryPackage.id, {
      projectTitle: deliveryProjectTitle,
      projectStage: currentStage,
      finalVersion: latestDeliveryVersion?.label ?? activeDeliveryPackage.manifest?.finalVersion ?? 'v0',
    })
    if (manifest) {
      downloadJson('manifest.json', {
        ...manifest,
        assets: activeDeliveryPackage.assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          title: asset.title,
          included: asset.included,
          approvalStatus: asset.approvalStatus,
          licenseStatus: asset.licenseStatus,
          riskLevel: asset.riskLevel,
        })),
      })
    }
  }, [activeDeliveryPackage, currentStage, deliveryProjectTitle, generateDeliveryManifest, latestDeliveryVersion?.label])

  const handleExportDeliveryProjectData = useCallback(() => {
    if (!activeDeliveryPackage) return
    downloadJson('project-data.json', buildDeliveryProjectData({
      pkg: activeDeliveryPackage,
      currentStage,
      narrative,
      shots,
      audioTimeline,
      approvals,
      versions,
      notes,
    }))
  }, [activeDeliveryPackage, approvals, audioTimeline, currentStage, narrative, notes, shots, versions])

  const handleSubmitDeliveryPackage = useCallback(() => {
    if (!activeDeliveryPackage) return
    const manifest = generateDeliveryManifest(activeDeliveryPackage.id, {
      projectTitle: deliveryProjectTitle,
      projectStage: currentStage,
      finalVersion: latestDeliveryVersion?.label ?? activeDeliveryPackage.manifest?.finalVersion ?? 'v0',
    })
    const riskSummary = generateDeliveryRiskSummary(activeDeliveryPackage.id)
    const hasStrongRisk = riskSummary?.issues.some((issue) => issue.severity === 'strong')
    if (hasStrongRisk) {
      const confirmed = window.confirm('当前仍有高风险项，是否仍然提交？')
      if (!confirmed) return
    }

    const submitted = submitDeliveryPackage(activeDeliveryPackage.id)
    if (!submitted) return

    if (activeJob?.id) {
      submitJobDelivery(activeJob.id, shots.filter((shot) => shot.isDone).map(extractShotData))
    }

    const linkedVersion = handleCreateEntityVersion({
      entityType: 'delivery',
      entityId: deliveryProjectId,
      snapshot: snapshotDelivery({
        teamId: activeTeam?.id,
        orderId: activeOrder?.id,
        jobId: activeJob?.id,
        currentStage,
        editorTimeline,
        deliveryPackage: {
          ...submitted,
          manifest: manifest ?? submitted.manifest,
          riskSummary: riskSummary ?? submitted.riskSummary,
        },
      }),
      changeType: 'manual-edit',
      summary: '提交交付包客户确认',
    })

    const existingPendingApproval = approvals.find((approval) => (
      approval.targetType === 'delivery'
      && approval.targetId === deliveryProjectId
      && (approval.status === 'pending' || approval.status === 'stale')
    ))

    if (!existingPendingApproval) {
      handleCreateApprovalRequest({
        targetType: 'delivery',
        targetId: deliveryProjectId,
        title: `交付包确认 · ${deliveryProjectTitle}`,
        description: `已提交 ${submitted.assets.filter((asset) => asset.included).length} 项交付资产，请客户确认是否可交付。`,
        requiredRoles: ['client'],
        linkedVersionId: linkedVersion.id,
      })
    } else if (linkedVersion.id !== existingPendingApproval.linkedVersionId) {
      useApprovalStore.getState().markApprovalStale('delivery', deliveryProjectId)
      handleCreateApprovalRequest({
        targetType: 'delivery',
        targetId: deliveryProjectId,
        title: `交付包确认 · ${deliveryProjectTitle}`,
        description: `交付包已更新，本次提交包含 ${submitted.assets.filter((asset) => asset.included).length} 项资产。`,
        requiredRoles: ['client'],
        linkedVersionId: linkedVersion.id,
      })
    }
  }, [activeDeliveryPackage, activeJob?.id, activeOrder?.id, activeTeam?.id, approvals, currentStage, deliveryProjectId, deliveryProjectTitle, editorTimeline, generateDeliveryManifest, generateDeliveryRiskSummary, handleCreateApprovalRequest, handleCreateEntityVersion, latestDeliveryVersion?.label, shots, submitDeliveryPackage, submitJobDelivery])

  const handleProductionAction = useCallback((decision: ProductionDecision) => {
    setFocusedSequenceId(decision.targetSequenceId ?? null)
    setFocusedShotId(decision.targetShotId ?? null)

    if (decision.targetShotId && decision.targetShotId !== currentShotId) {
      useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
      useShotsStore.getState().setCurrentShotId(decision.targetShotId)
      const targetShot = shots.find((shot) => shot.id === decision.targetShotId)
      if (targetShot) {
        resetCanvas(targetShot.nodes, targetShot.edges)
        setPrompt(targetShot.idea)
        if (targetShot.presetParams && Object.keys(targetShot.presetParams).length > 0) {
          setPro((prev) => ({ ...prev, ...targetShot.presetParams }))
          setProMode(true)
        }
      }
    }

    switch (decision.nextBestAction) {
      case 'add-missing-sequence':
      case 'improve-hook':
      case 'improve-cta':
        setRequestedPanel('ai')
        break
      case 'refine-rhythm':
        setRequestedPanel(decision.ownerSuggestion === 'cinematographer' ? 'camera' : 'ai')
        break
      case 'edit-intent':
        setRequestedPanel('style')
        break
      case 'ready-for-next-stage':
        setRequestedPanel('reference')
        break
      default:
        setRequestedPanel(null)
    }
  }, [currentShotId, shots, canvasNodes, canvasEdges, resetCanvas, setPrompt])

  const handleViewStageIssues = useCallback(() => {
    setInsightOpen(true)
    const firstTarget = stageReadiness.blockers[0] ?? stageReadiness.warnings[0]
    if (firstTarget?.targetSequenceId) setFocusedSequenceId(firstTarget.targetSequenceId)
    if (firstTarget?.targetShotId) setFocusedShotId(firstTarget.targetShotId)
    const firstAction = stageReadiness.suggestedActions[0]
    if (firstAction?.panel) setRequestedPanel(firstAction.panel)
  }, [stageReadiness])

  const handleContinueRefiningStage = useCallback(() => {
    setRequestedPanel(null)
  }, [])

  const handleConfirmAdvanceStage = useCallback(() => {
    if (!activeTeam || !stageReadiness.nextStage || stageReadiness.status === 'blocked') return
    const confirmed = window.confirm(`确认将阶段从 ${stageReadiness.currentStage} 推进到 ${stageReadiness.nextStage} 吗？`)
    if (!confirmed) return
    updateTeamStage(activeTeam.id, stageReadiness.nextStage)
  }, [activeTeam, stageReadiness, updateTeamStage])

  const handleInsightAction = useCallback((insight: NarrativeInsight) => {
    setFocusedSequenceId(insight.targetSequenceId ?? null)
    const targetShotId = insight.targetShotId
      ?? (insight.targetSequenceId ? shots.find((shot) => shot.sequenceId === insight.targetSequenceId)?.id : undefined)
    setFocusedShotId(targetShotId ?? null)
    if (targetShotId && targetShotId !== currentShotId) {
      useShotsStore.getState().saveCanvas(currentShotId, canvasNodes, canvasEdges)
      useShotsStore.getState().setCurrentShotId(targetShotId)
      const targetShot = useShotsStore.getState().shots.find((shot) => shot.id === targetShotId)
      if (targetShot) {
        resetCanvas(targetShot.nodes, targetShot.edges)
        setPrompt(targetShot.idea)
        if (targetShot.presetParams && Object.keys(targetShot.presetParams).length > 0) {
          setPro((prev) => ({ ...prev, ...targetShot.presetParams }))
          setProMode(true)
        }
      }
    }

    if (insight.suggestedAction.kind === 'open-suggestion') {
      setRequestedPanel(insight.suggestedAction.panel ?? 'ai')
    } else if (insight.suggestedAction.kind === 'focus-shot' && insight.suggestedAction.panel) {
      setRequestedPanel(insight.suggestedAction.panel)
    } else if (insight.suggestedAction.kind === 'focus-shot' || insight.suggestedAction.kind === 'focus-sequence') {
      setRequestedPanel(null)
    }

    setInsightOpen(false)
  }, [currentShotId, shots, canvasNodes, canvasEdges, resetCanvas, setPrompt])

  useEffect(() => {
    if (!focusedSequenceId && !focusedShotId && !focusedStoryboardFrameId && !focusedVideoJobId && !focusedEditorClipId && !focusedRoleBibleId) return
    const timer = setTimeout(() => {
      setFocusedSequenceId(null)
      setFocusedShotId(null)
      setFocusedStoryboardFrameId(null)
      setFocusedVideoJobId(null)
      setFocusedEditorClipId(null)
      setFocusedRoleBibleId(null)
    }, 2200)
    return () => clearTimeout(timer)
  }, [focusedEditorClipId, focusedRoleBibleId, focusedSequenceId, focusedShotId, focusedStoryboardFrameId, focusedVideoJobId])

  useEffect(() => {
    setEditorTimeline((prev) => ({
      ...prev,
      status: prev.clips.length === 0 ? 'draft' : 'review',
    }))
  }, [editorTimeline.clips.length])

  const handleApplyTemplate = useCallback((templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    const projectTemplate = PROJECT_TEMPLATE_MAP[templateId]
    if (!tpl || !projectTemplate) return
    setActiveTemplateId(templateId)
    const firstId = useShotsStore.getState().resetShots(
      tpl.shots,
      tpl.style,
      DEFAULT_NODES,
      DEFAULT_EDGES,
      {
        type: projectTemplate.narrativeType,
        structure: projectTemplate.structure,
        templateId: projectTemplate.id,
        sequences: projectTemplate.sequences.map((sequence) => ({
          structureId: sequence.structureId,
          name: sequence.name,
          goal: sequence.goal,
          suggestedIntent: sequence.suggestedIntent,
        })),
      }
    )
    const firstShot = useShotsStore.getState().shots.find((s) => s.id === firstId)
    resetCanvas(DEFAULT_NODES, DEFAULT_EDGES)
    if (firstShot) {
      setPrompt(firstShot.idea)
      updateNode('prompt-1', { content: firstShot.idea })
      if (firstShot.presetParams && Object.keys(firstShot.presetParams).length > 0) {
        setPro((p) => ({ ...p, ...firstShot.presetParams }))
        setProMode(true)
      }
    }
    setCompareSuggestionId(null)
    setInsightOpen(false)
  }, [resetCanvas, setPrompt, updateNode])

  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || running) return
    setRunning(true)

    type ContextRef = { id: string; label: string }
    type AgentStep  = { id: string; skill: string; contextRefs?: ContextRef[] }
    const agents: AgentStep[] = [
      { id: 'agent-writer',   skill: 'writer' },
      { id: 'agent-director', skill: 'director', contextRefs: [{ id: 'agent-writer', label: '编剧产出' }] },
      { id: 'agent-actor',    skill: 'actor',    contextRefs: [{ id: 'agent-writer', label: '编剧产出' }, { id: 'agent-director', label: '导演思路' }] },
      { id: 'agent-dop',      skill: 'camera',   contextRefs: [{ id: 'agent-director', label: '导演思路' }, { id: 'agent-actor', label: '角色设定' }] },
      { id: 'agent-editor',   skill: 'video',    contextRefs: [{ id: 'agent-writer', label: '编剧产出' }, { id: 'agent-director', label: '导演思路' }, { id: 'agent-dop', label: '摄影方案' }] },
    ]

    agents.forEach(({ id }) => updateNode(id, { status: 'idle', content: undefined, progress: 0, source: undefined, imageUrl: undefined, videoUrl: undefined }))
    updateNode('final-edit-1', { status: 'idle', content: undefined, progress: 0 })

    const outputs: Record<string, string> = {}
    const imageOutputs: Record<string, string> = {}
    const keyframeOutputs: Record<string, string> = {}
    const excerpt = (s: string) => (s.length > 450 ? s.slice(0, 450) + '…' : s)

    const shotPreset = currentShot?.presetParams ?? {}
    const effectivePro = proMode ? { ...pro, ...shotPreset } : undefined
    const params: Record<string, unknown> | undefined = effectivePro
    const styleTemplate = getActiveStyle()?.promptTemplate

    let generatedVideoUrl: string | undefined
    let generatedThumbnailUrl: string | undefined

    for (const { id, skill, contextRefs } of agents) {
      updateNode(id, { status: 'running', progress: 0 })
      const context = contextRefs?.filter(({ id: cid }) => outputs[cid]).map(({ id: cid, label }) => `【${label}】\n${excerpt(outputs[cid] ?? '')}`).join('\n\n') || undefined
      const imageUrl       = skill === 'video' ? imageOutputs['agent-dop']    : undefined
      const keyframePrompt = skill === 'video' ? keyframeOutputs['agent-dop'] : undefined
      try {
        const res = await fetch('/api/skill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skill, idea, style: selectedStyle, context, imageUrl, keyframePrompt, globalPro, params, styleTemplate }),
        })
        const data = await res.json() as { content?: string; imageUrl?: string; videoUrl?: string; source?: string; keyframePrompt?: string; [k: string]: unknown }
        outputs[id] = data.content ?? ''
        if (data.imageUrl)       imageOutputs[id]    = data.imageUrl
        if (data.keyframePrompt) keyframeOutputs[id] = data.keyframePrompt
        if (skill === 'camera' && data.imageUrl) generatedThumbnailUrl = data.imageUrl
        if (skill === 'video'  && data.videoUrl) generatedVideoUrl     = data.videoUrl
        updateNode(id, {
          status: 'done', progress: 100, content: data.content ?? '',
          source: (data.source as 'mock' | 'real' | 'fallback-mock') ?? undefined,
          ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
        })
      } catch { updateNode(id, { status: 'error', progress: 0 }) }
    }

    updateNode('output-1', { content: `《${idea.slice(0, 20)}》${selectedStyle}方案已生成` })
    const liveNodes = useCanvasStore.getState().nodes
    const liveEdges = useCanvasStore.getState().edges
    useShotsStore.getState().saveCanvas(currentShotId, liveNodes, liveEdges)
    useShotsStore.getState().updateShot(currentShotId, {
      isDone: true,
      ...(generatedVideoUrl     ? { videoUrl:     generatedVideoUrl     } : {}),
      ...(generatedThumbnailUrl ? { thumbnailUrl: generatedThumbnailUrl } : {}),
    })

    const allShots = useShotsStore.getState().shots
    const shotsSummary = allShots.map((s, i) => ({ id: s.id, label: s.label, idea: s.idea || undefined, videoUrl: s.videoUrl || undefined, duration: s.duration, order: i }))
    updateNode('final-edit-1', { status: 'running', progress: 0 })
    try {
      const feRes = await fetch('/api/skill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: 'final-edit', idea, style: selectedStyle, shots: shotsSummary, globalPro, params }),
      })
      const feData = await feRes.json() as { content?: string; timelineSummary?: string; finalVideoUrl?: string; source?: string }
      updateNode('final-edit-1', { status: 'done', progress: 100, content: feData.content, timelineSummary: feData.timelineSummary, finalVideoUrl: feData.finalVideoUrl, source: (feData.source as 'mock' | 'real' | 'fallback-mock') ?? undefined })
    } catch { updateNode('final-edit-1', { status: 'error', progress: 0 }) }

    recordDirectorSession({ source: 'generate', idea, style: selectedStyle, shots: [{ label: currentShot?.label ?? 'Shot 1', idea, style: selectedStyle }], prompts: Object.values(outputs) })
    setRunning(false)
  }, [idea, running, selectedStyle, pro, proMode, globalPro, updateNode, currentShotId, currentShot, getActiveStyle])

  const handleAutoDirector = useCallback(async () => {
    if (!idea.trim() || running || autoRunning) return
    setAutoRunning(true)
    setAutoPhase('分析广告结构…')
    const commercial = analyzeCommercial(idea)
    await new Promise<void>((r) => setTimeout(r, 350))
    setAutoPhase('导演正在拆镜…')
    let defs: Array<{ idea: string; label: string; presetParams?: Partial<ProParams> }>
    let dirShots: DirectorShot[]
    if (commercial.isCommercial) {
      const commercialDefs = commercialToShotDefs(commercial.segments, selectedStyle)
      dirShots = runDirector(idea, selectedStyle)
      defs = commercialDefs.map((def, i) => ({ ...def, presetParams: dirShots[i]?.presetParams ?? dirShots[0]?.presetParams }))
    } else {
      dirShots = runDirector(idea, selectedStyle)
      defs = directorShotsToResetDefs(dirShots)
    }
    const firstId = useShotsStore.getState().resetShots(defs, selectedStyle, DEFAULT_NODES, DEFAULT_EDGES)
    await new Promise<void>((r) => setTimeout(r, 350))
    setAutoPhase('填充创作信息…')
    const allShots = useShotsStore.getState().shots
    for (let i = 0; i < allShots.length; i++) {
      const shot = allShots[i]!
      const dir = dirShots[i] ?? dirShots[dirShots.length - 1]!
      const filledNodes = buildFilledNodes(shot.idea, dir, i, DEFAULT_NODES)
      useShotsStore.getState().saveCanvas(shot.id, filledNodes, DEFAULT_EDGES)
      useShotsStore.getState().updateShot(shot.id, { isDone: true, thumbnailUrl: getMoodThumbnail(dir.mood, i) })
      await new Promise<void>((r) => setTimeout(r, 250))
    }
    setAutoPhase('合成画布…')
    const firstShot = useShotsStore.getState().shots.find((s) => s.id === firstId)
    if (firstShot) {
      resetCanvas(firstShot.nodes, firstShot.edges)
      setPrompt(firstShot.idea)
      if (firstShot.presetParams && Object.keys(firstShot.presetParams).length > 0) {
        setPro((p) => ({ ...p, ...firstShot.presetParams }))
        setProMode(true)
      }
    }
    useCanvasStore.getState().setTransform({ x: -80, y: 20, scale: 0.58 })
    await new Promise<void>((r) => setTimeout(r, 400))
    recordDirectorSession({ source: 'auto', idea, style: selectedStyle, shots: useShotsStore.getState().shots.map((s) => ({ label: s.label, idea: s.idea })), prompts: defs.map((d) => d.idea) })
    setAutoRunning(false)
    setAutoPhase('')
  }, [idea, running, autoRunning, selectedStyle, resetCanvas, setPrompt])

  const handleCommercialMode = useCallback(async () => {
    if (running || commercialRunning || autoRunning) return
    setCommercialMode(true)
    setCommercialRunning(true)
    const commercialIdea = idea.trim() || '品牌商业视频'
    setCommercialPhase('分析商业视频结构…')
    const commercial = analyzeCommercial(commercialIdea)
    await new Promise<void>((r) => setTimeout(r, 400))
    setCommercialPhase('导演正在规划商业镜头…')
    const dirShots = runDirector(commercialIdea, selectedStyle)
    const commercialDefs = commercialToShotDefs(commercial.segments, selectedStyle)
    const defs = commercialDefs.map((def, i) => ({ ...def, presetParams: dirShots[i]?.presetParams ?? dirShots[0]?.presetParams }))
    const firstId = useShotsStore.getState().resetShots(defs, selectedStyle, DEFAULT_NODES, DEFAULT_EDGES)
    await new Promise<void>((r) => setTimeout(r, 350))
    setCommercialPhase('填充商业创作方案…')
    const allShots = useShotsStore.getState().shots
    for (let i = 0; i < allShots.length; i++) {
      const shot = allShots[i]!
      const dir = dirShots[i] ?? dirShots[dirShots.length - 1]!
      const filledNodes = buildFilledNodes(shot.idea, dir, i, DEFAULT_NODES)
      useShotsStore.getState().saveCanvas(shot.id, filledNodes, DEFAULT_EDGES)
      useShotsStore.getState().updateShot(shot.id, { isDone: true, thumbnailUrl: getMoodThumbnail(dir.mood, i) })
      await new Promise<void>((r) => setTimeout(r, 220))
    }
    setCommercialPhase('合成画布…')
    const firstShot = useShotsStore.getState().shots.find((s) => s.id === firstId)
    if (firstShot) {
      resetCanvas(firstShot.nodes, firstShot.edges)
      setPrompt(firstShot.idea)
      if (firstShot.presetParams && Object.keys(firstShot.presetParams).length > 0) {
        setPro((p) => ({ ...p, ...firstShot.presetParams }))
        setProMode(true)
      }
    }
    useCanvasStore.getState().setTransform({ x: -80, y: 20, scale: 0.58 })
    await new Promise<void>((r) => setTimeout(r, 400))
    recordDirectorSession({ source: 'commercial', idea: commercialIdea, style: selectedStyle, shots: useShotsStore.getState().shots.map((s) => ({ label: s.label, idea: s.idea })), prompts: defs.map((d) => d.idea) })
    setCommercialRunning(false)
    setCommercialPhase('')
  }, [idea, running, autoRunning, commercialRunning, selectedStyle, resetCanvas, setPrompt])

  const handleAutoCrew = useCallback(() => {
    if (!aiTasks || crewRunning) return
    setCrewRunning(true)
    setCrewSynced(false)
    const collaborated = useRelationshipStore.getState().relationships.filter((r) => r.userId === 'user-me').map((r) => r.creatorId)
    const members = generateCrew({ idea, tasks: aiTasks, users: CREATORS, collaborated })
    setCrewMembers(members)
    const teamStore = useTeamStore.getState()
    const target = teamStore.teams.find((t) => t.stage !== 'delivery')
    if (target) {
      members.forEach((m) => teamStore.inviteMember(target.id, { userId: m.userId, name: m.name, role: m.role, split: Math.floor(80 / members.length) }))
      setCrewSynced(true)
    }
    setCrewRunning(false)
  }, [aiTasks, idea, crewRunning])

  const handleRemoveCrewMember = useCallback((userId: string) => {
    setCrewMembers((prev) => { if (!prev) return null; const next = prev.filter((m) => m.userId !== userId); return next.length > 0 ? next : null })
  }, [])

  const handleReplaceCrewMember = useCallback((userId: string, role: string) => {
    setCrewMembers((prev) => {
      if (!prev) return null
      const excludeIds = prev.map((m) => m.userId)
      const collaborated = useRelationshipStore.getState().relationships.filter((r) => r.userId === 'user-me').map((r) => r.creatorId)
      const replacement = findReplacement(role, CREATORS, excludeIds, collaborated)
      if (!replacement) return prev
      return prev.map((m) => m.userId === userId ? replacement : m)
    })
  }, [])

  const handleOrchestrate = useCallback(async () => {
    if (idea.trim().length < 8 || orchRunning) return
    setOrchRunning(true)
    try {
      const result = await runProjectPipeline(idea, (phase) => setOrchPhase(phase as PipelinePhase))
      setOrchPhase('')
      await new Promise<void>((r) => setTimeout(r, 300))
      router.push(`/chat/${result.jobId}`)
    } catch (err) {
      console.error('[Orchestrator]', err)
      setOrchRunning(false)
      setOrchPhase('')
    }
  }, [idea, orchRunning, router])

  const handleDirector = useCallback(() => {
    if (!idea.trim() || running) return
    const dirShots = runDirector(idea, selectedStyle)
    const defs = directorShotsToResetDefs(dirShots)
    const firstId = useShotsStore.getState().resetShots(defs, selectedStyle, DEFAULT_NODES, DEFAULT_EDGES)
    const firstShot = useShotsStore.getState().shots.find((s) => s.id === firstId)
    resetCanvas(DEFAULT_NODES, DEFAULT_EDGES)
    if (firstShot) {
      setPrompt(firstShot.idea)
      updateNode('prompt-1', { content: firstShot.idea })
      if (firstShot.presetParams && Object.keys(firstShot.presetParams).length > 0) {
        setPro((p) => ({ ...p, ...firstShot.presetParams }))
        setProMode(true)
      }
    }
    recordDirectorSession({ source: 'director', idea, style: selectedStyle, shots: dirShots.map((d) => ({ label: d.shotType, idea: d.description, shotType: d.shotType, mood: d.mood })), prompts: dirShots.map((d) => d.description) })
  }, [idea, running, selectedStyle, resetCanvas, setPrompt, updateNode])

  useEffect(() => {
    if (!visibleWorkspaceViews.includes(workspaceView)) {
      setWorkspaceView(visibleWorkspaceViews[0] ?? 'delivery')
    }
  }, [visibleWorkspaceViews, workspaceView])

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <CanvasProvider>
      <div className="flex h-screen bg-[#060a14] overflow-hidden">

        {role === 'creator' ? (
        <LeftPanel
          idea={idea}
          running={running}
          autoRunning={autoRunning}
          orchRunning={orchRunning}
          commercialRunning={commercialRunning}
          onAutoDirector={handleAutoDirector}
          onDirector={handleDirector}
          onCommercialMode={handleCommercialMode}
          onOrchestrate={handleOrchestrate}
          onAutoCrew={handleAutoCrew}
          onShowPublish={() => setShowPublish(true)}
          globalPro={globalPro}
          aiTasks={aiTasks}
          aiSynced={aiSynced}
          crewMembers={crewMembers}
          crewSynced={crewSynced}
          crewRunning={crewRunning}
          onRemoveCrewMember={handleRemoveCrewMember}
          onReplaceCrewMember={handleReplaceCrewMember}
          pricing={pricing}
          priceDuration={priceDuration}
          setPriceDuration={setPriceDuration}
          priceQuality={priceQuality}
          setPriceQuality={setPriceQuality}
          orchPhase={orchPhase}
          autoPhase={autoPhase}
          commercialPhase={commercialPhase}
          commercialMode={commercialMode}
          canvasMode={canvasMode}
          onCanvasModeChange={setCanvasMode}
          currentIntent={currentShot?.intent}
        />
        ) : null}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between" style={{ background: 'rgba(6,10,20,0.9)', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex-1">
              <RoleViewSwitcher role={role} onChange={setRole} compact />
            </div>
          </div>

          <div className="px-5 pt-2 pb-2 flex items-center justify-between gap-4" style={{ background: 'rgba(6,10,20,0.9)', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'canvas', label: '创作画布' },
                { id: 'previs', label: '分镜预演' },
                { id: 'footage', label: '视频镜头' },
                { id: 'audio', label: '声音台' },
                { id: 'editor', label: '剪辑台' },
                { id: 'delivery', label: '交付' },
              ] as const).filter((item) => visibleWorkspaceViews.includes(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setWorkspaceView(item.id)
                    if (item.id === 'previs') setRequestedPanel('previs')
                  }}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
                  style={{
                    background: workspaceView === item.id ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                    border: workspaceView === item.id ? '1px solid rgba(99,102,241,0.28)' : '1px solid rgba(255,255,255,0.08)',
                    color: workspaceView === item.id ? '#c7d2fe' : 'rgba(255,255,255,0.56)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] max-w-[640px] text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {role === 'creator'
                ? '创作者视图保留完整工作区，覆盖分镜、视频、声音、剪辑和交付。'
                : role === 'producer'
                  ? '制片视图只保留产出与交付相关面板，不显示完整创作控制台。'
                  : '客户视图在工作区内只保留交付相关内容，复杂参数与内部创作流程已隐藏。'}
            </p>
          </div>

          {workspaceView === 'canvas' || workspaceView === 'previs' ? (
            <ShotTimeline
              shots={shots}
              narrative={narrative}
              currentShotId={currentShotId}
              running={running}
              onSwitchShot={handleSwitchShot}
              onAddShot={handleAddShot}
              onRemoveShot={handleRemoveShot}
              onUpdateShot={handleUpdateShot}
              crewMembers={crewMembers}
              suggestionShots={suggestionShots}
              compareSuggestionId={compareSuggestionId}
              gearSuggestions={gearSuggestions}
              compareGearSuggestionId={compareGearSuggestionId}
              onGenerateSuggestions={handleGenerateSuggestions}
              onGenerateGearSuggestions={handleGenerateGearSuggestions}
              onApplySuggestion={handleApplySuggestion}
              onApplyGearSuggestion={handleApplyGearSuggestion}
              onToggleCompareSuggestion={handleToggleCompareSuggestion}
              onToggleCompareGearSuggestion={handleToggleCompareGearSuggestion}
              onIgnoreSuggestion={handleIgnoreSuggestion}
              onIgnoreGearSuggestion={handleIgnoreGearSuggestion}
              idea={idea}
              onIdeaChange={handleIdeaChange}
              pro={pro}
              onPatchPro={handlePatchCurrentPro}
              globalPro={globalPro}
              setGlobalPro={setGlobalPro}
              selectedStyle={selectedStyle}
              onStyleChange={handleStyleChange}
              activeTemplateId={activeTemplateId}
              onApplyTemplate={handleApplyTemplate}
              selectedStyleId={selectedStyleId}
              onSelectStyle={selectStyle}
              onGenerateCurrent={handleGenerate}
              canvasMode={canvasMode}
              insights={insights}
              scoreSummary={scoreSummary}
              productionDecision={productionDecision}
              onProductionAction={handleProductionAction}
              stageReadiness={stageReadiness}
              onViewStageIssues={handleViewStageIssues}
              onContinueRefiningStage={handleContinueRefiningStage}
              onConfirmAdvanceStage={handleConfirmAdvanceStage}
              insightOpen={insightOpen}
              onToggleInsight={() => setInsightOpen((prev) => !prev)}
              onInsightAction={handleInsightAction}
              currentIntent={currentShot?.intent}
              onIntentChange={handleIntentChange}
              requestedPanel={requestedPanel}
              onRequestedPanelHandled={handleRequestedPanelHandled}
              onNarrativeTypeChange={setNarrativeType}
              focusedSequenceId={focusedSequenceId}
              focusedShotId={focusedShotId}
              storyboardPrevis={storyboardPrevis}
              characterBible={characterBible}
              styleBible={styleBible}
              roleBibles={roleBibles}
              notes={notes}
              noteTargets={noteTargets}
              notesSummary={notesSummary}
              requestedNoteDraft={requestedNoteDraft}
              noteAssigneeOptions={noteAssigneeOptions}
              approvalTargets={approvalTargets}
              approvalsSummary={approvalsSummary}
              castingSuggestions={castingSuggestions}
              compareCastingSuggestionId={compareCastingSuggestionId}
              editingCastingSuggestionId={editingCastingSuggestionId}
              onGenerateCastingSuggestions={handleGenerateCastingSuggestions}
              onApplyCastingSuggestion={handleApplyCastingSuggestion}
              onToggleCompareCastingSuggestion={handleToggleCompareCastingSuggestion}
              onIgnoreCastingSuggestion={handleIgnoreCastingSuggestion}
              onStartEditCastingSuggestion={handleStartEditCastingSuggestion}
              onPatchEditingCastingSuggestion={handlePatchEditingCastingSuggestion}
              onApplyEditedCastingSuggestion={handleApplyEditedCastingSuggestion}
              onToggleRoleBibleLock={handleToggleRoleBibleLock}
              onCreateDirectorNote={handleCreateDirectorNote}
              onReplyDirectorNote={handleReplyDirectorNote}
              onUpdateDirectorNoteStatus={handleDirectorNoteStatusChange}
              onLocateDirectorNote={handleLocateDirectorNote}
              onConvertDirectorNoteToTask={handleConvertNoteToTask}
              onCreateApprovalRequest={handleCreateApprovalRequest}
              onApprovalDecision={handleApprovalDecision}
              onLocateApprovalTarget={handleLocateApprovalTarget}
              onRequestedNoteDraftHandled={() => setRequestedNoteDraft(null)}
              focusedStoryboardFrameId={focusedStoryboardFrameId}
              focusedRoleBibleId={focusedRoleBibleId}
              previsSourceType={previsSourceType}
              onPrevisSourceTypeChange={setPrevisSourceType}
              previsSourcePrompt={previsSourcePrompt}
              onPrevisSourcePromptChange={setPrevisSourcePrompt}
              previsSourceImageUrl={previsSourceImageUrl}
              onPrevisSourceImageUrlChange={setPrevisSourceImageUrl}
              previsDuration={previsDuration}
              onPrevisDurationChange={setPrevisDuration}
              previsFrameCount={previsFrameCount}
              onPrevisFrameCountChange={setPrevisFrameCount}
              previsFrameStyle={previsFrameStyle}
              onPrevisFrameStyleChange={setPrevisFrameStyle}
              previsAspectRatio={previsAspectRatio}
              onPrevisAspectRatioChange={setPrevisAspectRatio}
              editingStoryboardFrameId={editingStoryboardFrameId}
              onEditingStoryboardFrameChange={setEditingStoryboardFrameId}
              activeStoryboardFrame={activeStoryboardFrame}
              onSelectStoryboardFrame={handleSelectStoryboardFrame}
              onDiscardStoryboardFrame={handleDiscardStoryboardFrame}
              onDuplicateStoryboardFrame={handleDuplicateStoryboardFrame}
              onOpenStoryboardFrameEditor={handleOpenStoryboardFrameEditor}
              onPatchStoryboardFrame={handlePatchStoryboardFrame}
              videoConfigFrameId={videoConfigFrameId}
              onGenerateStoryboardPrevis={handleGenerateStoryboardPrevis}
              onRegenerateStoryboardFrame={handleRegenerateStoryboardFrame}
              onUpdateStoryboardFramePrompt={handleUpdateStoryboardFramePrompt}
              onStoryboardGenerateVideoPlaceholder={handleStoryboardGenerateVideoPlaceholder}
              derivativeProvider={derivativeProvider}
              onDerivativeProviderChange={setDerivativeProvider}
              derivativeDuration={derivativeDuration}
              onDerivativeDurationChange={setDerivativeDuration}
              derivativeMovement={derivativeMovement}
              onDerivativeMovementChange={setDerivativeMovement}
              motionStrength={motionStrength}
              onMotionStrengthChange={setMotionStrength}
              characterConsistency={characterConsistency}
              onCharacterConsistencyChange={setCharacterConsistency}
              styleConsistency={styleConsistency}
              onStyleConsistencyChange={setStyleConsistency}
              onCreateShotDerivativeJob={handleCreateShotDerivativeJob}
              onApplyCinematicSkill={handleApplyCinematicSkill}
              currentStage={currentStage}
            />
          ) : workspaceView === 'audio' ? (
            <AudioDesk
              roleBibles={roleBibles}
              shots={shots}
              sequences={narrative?.sequences ?? []}
              clips={[...editorTimeline.clips].sort((a, b) => a.order - b.order)}
              timeline={editorTimeline}
              dialogueLines={dialogueLines}
              voiceTakes={voiceTakes}
              lipSyncJobs={lipSyncJobs}
              musicCues={musicCues}
              soundEffectCues={soundEffectCues}
              audioTimeline={audioTimeline}
              cueSheet={cueSheet}
              musicMotifs={musicMotifs}
              audioReviews={audioReviews}
              timelineIssues={timelineIssues}
              onAddDialogueLine={handleAddDialogueLine}
              onUpdateDialogueLine={updateDialogueLine}
              onGenerateVoiceTakes={handleGenerateVoiceTakes}
              onSelectVoiceTake={updateVoiceTakeStatus}
              onCreateLipSyncJob={handleCreateLipSyncJob}
              onGenerateMusicCues={handleGenerateMusicCueCandidates}
              onSelectMusicCue={updateMusicCueStatus}
              onGenerateSoundEffects={handleGenerateSoundEffectCandidates}
              onSelectSoundEffectCue={updateSoundEffectCueStatus}
              onSelectMusicMotif={handleSelectMusicMotif}
              onAddAudioTimelineClipFromSource={handleAddAudioTimelineClipFromSource}
              onUpdateAudioTimelineClip={handleUpdateAudioTimelineClip}
              onUpdateCuePoint={handleUpdateCuePoint}
              onUpdateCueSheetStatus={handleUpdateCueSheetState}
              onSendLipSyncToEditor={handleSendLipSyncToEditor}
              onOpenEditorDesk={() => setWorkspaceView('editor')}
              onBackToCanvas={() => setWorkspaceView('canvas')}
            />
          ) : workspaceView === 'delivery' ? (
            <DeliveryTab
              projectTitle={deliveryProjectTitle}
              currentStage={currentStage}
              deliveryPackage={activeDeliveryPackage}
              canSubmit={Boolean(activeDeliveryPackage && deliveryPackageIncludedCount > 0)}
              onCreatePackage={handleCreateDeliveryPackage}
              onToggleAssetIncluded={handleToggleDeliveryAssetIncluded}
              onPreviewAsset={handlePreviewDeliveryAsset}
              onViewVersion={handleViewDeliveryVersion}
              onViewApproval={handleViewDeliveryApproval}
              onExportSummary={handleExportDeliverySummary}
              onExportManifest={handleExportDeliveryManifest}
              onExportProjectData={handleExportDeliveryProjectData}
              onSubmitPackage={handleSubmitDeliveryPackage}
            />
          ) : (
            <EditorDesk
              jobs={shotDerivativeJobs}
              timeline={editorTimeline}
              view={workspaceView}
              clipReviews={clipReviews}
              dialogueLines={dialogueLines}
              voiceTakes={voiceTakes}
              lipSyncJobs={lipSyncJobs}
              musicCues={musicCues}
              soundEffectCues={soundEffectCues}
              notes={notes}
              acceptedReviewIds={acceptedClipReviewIds}
              ignoredReviewActions={ignoredClipReviewActions}
              focusedJobId={focusedVideoJobId}
              focusedClipId={focusedEditorClipId}
              requestedReviewId={requestedReviewId}
              onAddJobToEditor={handleAddDerivativeJobToEditor}
              onMoveClip={handleMoveEditorClip}
              onRemoveClip={handleRemoveEditorClip}
              onSetClipTransition={handleSetClipTransition}
              onSetClipPacing={handleSetClipPacing}
              onApplyEditSuggestion={handleApplyEditSuggestion}
              onApplyClipReviewRecommendation={handleApplyClipReviewRecommendation}
              onIgnoreClipReviewRecommendation={handleIgnoreClipReviewRecommendation}
              onDraftNoteFromClipReviewIssue={handleDraftNoteFromClipReviewIssue}
              onExportEditPlan={handleExportEditPlan}
              onTimelinePacingGoalChange={handleTimelinePacingGoalChange}
              onTimelineMusicDirectionChange={handleTimelineMusicDirectionChange}
              onRetryJob={handleRetryShotDerivativeJob}
              onBackToCanvas={() => setWorkspaceView('canvas')}
              onOpenPrevis={() => {
                setWorkspaceView('previs')
                setRequestedPanel('previs')
              }}
            />
          )}
        </div>

        <div className="hidden">
          <RightPanel
            pro={pro}
            setPro={setPro}
            globalPro={globalPro}
            setGlobalPro={setGlobalPro}
            running={running}
            idea={idea}
            onGenerate={handleGenerate}
          />
        </div>

        <AnimatePresence>
          {showPublish && (
            <PublishProjectModal
              defaultTitle={idea.slice(0, 40) || '未命名作品'}
              onClose={() => setShowPublish(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </CanvasProvider>
  )
}
