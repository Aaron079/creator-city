'use client'

import { useMemo, useState } from 'react'
import { getAdaptersByPanel } from '@/lib/adapters/registry'
import { mapAudioDeskRequestToElevenLabsPayload, mapLipSyncJobToSyncPayload } from '@/lib/tools/mappers'
import type {
  AudioSyncIssue,
  AudioSyncReview,
  AudioTrack,
  AudioTimeline,
  AudioTimelineClip,
  CueSheet,
  DialogueLine,
  LipSyncJob,
  MusicCue,
  MusicMotif,
  SoundEffectCue,
  VoiceTake,
} from '@/store/audio-desk.store'
import type { EditorClip, EditorTimeline, RoleBible, Sequence, Shot } from '@/store/shots.store'

type AudioDeskTab = 'dialogue' | 'voice' | 'lipsync' | 'music' | 'sfx' | 'timeline'

const EMOTIONS: DialogueLine['emotion'][] = ['calm', 'sad', 'angry', 'excited', 'whisper', 'commercial']
const AUDIO_PROVIDERS = ['mock', 'elevenlabs'] as const
const LIP_SYNC_PROVIDERS = ['mock', 'sync'] as const

function AudioTrackBadge({ label, count }: { label: string; count: number }) {
  return (
    <span
      className="px-2 py-1 rounded-lg text-[9px]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}
    >
      {label} {count}
    </span>
  )
}

export function AudioDesk({
  roleBibles,
  shots,
  sequences,
  clips,
  timeline,
  dialogueLines,
  voiceTakes,
  lipSyncJobs,
  musicCues,
  soundEffectCues,
  audioTimeline,
  cueSheet,
  musicMotifs,
  audioReviews,
  timelineIssues,
  onAddDialogueLine,
  onUpdateDialogueLine,
  onGenerateVoiceTakes,
  onSelectVoiceTake,
  onCreateLipSyncJob,
  onGenerateMusicCues,
  onSelectMusicCue,
  onGenerateSoundEffects,
  onSelectSoundEffectCue,
  onSelectMusicMotif,
  onAddAudioTimelineClipFromSource,
  onUpdateAudioTimelineClip,
  onUpdateCuePoint,
  onUpdateCueSheetStatus,
  onSendLipSyncToEditor,
  onOpenEditorDesk,
  onBackToCanvas,
}: {
  roleBibles: RoleBible[]
  shots: Shot[]
  sequences: Sequence[]
  clips: EditorClip[]
  timeline: EditorTimeline
  dialogueLines: DialogueLine[]
  voiceTakes: VoiceTake[]
  lipSyncJobs: LipSyncJob[]
  musicCues: MusicCue[]
  soundEffectCues: SoundEffectCue[]
  audioTimeline: AudioTimeline | null
  cueSheet: CueSheet | null
  musicMotifs: MusicMotif[]
  audioReviews: Record<string, AudioSyncReview>
  timelineIssues: AudioSyncIssue[]
  onAddDialogueLine: (draft: Omit<DialogueLine, 'id'>) => void
  onUpdateDialogueLine: (id: string, patch: Partial<DialogueLine>) => void
  onGenerateVoiceTakes: (dialogueLineId: string, provider: typeof AUDIO_PROVIDERS[number]) => void
  onSelectVoiceTake: (voiceTakeId: string, status: VoiceTake['status']) => void
  onCreateLipSyncJob: (args: { targetVideoClipId: string; voiceTakeId: string; provider: LipSyncJob['provider'] }) => void
  onGenerateMusicCues: (args?: { sequenceId?: string; provider?: typeof AUDIO_PROVIDERS[number] }) => void
  onSelectMusicCue: (musicCueId: string, status: MusicCue['status']) => void
  onGenerateSoundEffects: (clipId: string, provider: typeof AUDIO_PROVIDERS[number]) => void
  onSelectSoundEffectCue: (sfxId: string, status: SoundEffectCue['status']) => void
  onSelectMusicMotif: (motifId: string, status: MusicMotif['status']) => void
  onAddAudioTimelineClipFromSource: (args: {
    sourceType: AudioTimelineClip['sourceType']
    sourceId: string
    targetEditorClipId?: string
    targetSequenceId?: string
  }) => void
  onUpdateAudioTimelineClip: (trackType: AudioTrack['type'], clipId: string, patch: Partial<AudioTimelineClip>) => void
  onUpdateCuePoint: (cueId: string, patch: { approved?: boolean; description?: string; intensity?: number }) => void
  onUpdateCueSheetStatus: (status: CueSheet['status']) => void
  onSendLipSyncToEditor: (jobId: string) => void
  onOpenEditorDesk: () => void
  onBackToCanvas: () => void
}) {
  const [activeTab, setActiveTab] = useState<AudioDeskTab>('dialogue')
  const [draft, setDraft] = useState<{
    roleBibleId?: string
    characterName: string
    text: string
    emotion: DialogueLine['emotion']
    targetShotId?: string
    targetClipId?: string
    startTime: number
    endTime: number
  }>({
    roleBibleId: roleBibles[0]?.id,
    characterName: roleBibles[0]?.name ?? '旁白',
    text: '',
    emotion: 'commercial',
    targetShotId: shots[0]?.id,
    targetClipId: clips[0]?.id,
    startTime: 0,
    endTime: 3,
  })
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(dialogueLines[0]?.id ?? null)
  const [audioProvider, setAudioProvider] = useState<typeof AUDIO_PROVIDERS[number]>('mock')
  const [lipSyncProvider, setLipSyncProvider] = useState<typeof LIP_SYNC_PROVIDERS[number]>('mock')

  const activeDialogue = dialogueLines.find((line) => line.id === activeDialogueId) ?? dialogueLines[0] ?? null
  const activeVoiceTakes = useMemo(
    () => voiceTakes.filter((take) => take.dialogueLineId === activeDialogue?.id),
    [activeDialogue?.id, voiceTakes]
  )
  const selectedVoiceTake = activeVoiceTakes.find((take) => take.status === 'selected') ?? null
  const selectedMotifs = musicMotifs.filter((motif) => motif.status === 'selected')
  const audioAdapters = useMemo(() => getAdaptersByPanel('audio-desk'), [])
  const lipSyncAdapters = useMemo(() => getAdaptersByPanel('audio-desk').filter((item) => item.supports.includes('lipsync')), [])
  const audioProviderPayload = useMemo(() => {
    if (audioProvider !== 'elevenlabs') return null
    return mapAudioDeskRequestToElevenLabsPayload({
      kind: activeTab === 'music' ? 'music' : activeTab === 'sfx' ? 'sfx' : 'voice',
      dialogueLine: activeTab === 'voice' ? activeDialogue : null,
      sequence: activeTab === 'music' ? sequences[0] ?? null : null,
      clip: activeTab === 'sfx' ? clips[0] ?? null : null,
    })
  }, [activeDialogue, activeTab, audioProvider, clips, sequences])
  const lipSyncProviderPayload = useMemo(() => {
    if (lipSyncProvider !== 'sync' || !selectedVoiceTake || !activeDialogue?.targetClipId) return null
    const clip = clips.find((item) => item.id === activeDialogue.targetClipId)
    if (!clip) return null
    return mapLipSyncJobToSyncPayload({
      targetVideoClipId: clip.sourceJobId,
      voiceTakeId: selectedVoiceTake.id,
      selectedVoiceTake,
    })
  }, [activeDialogue?.targetClipId, clips, lipSyncProvider, selectedVoiceTake])

  const getSourcePreview = (audioClip: AudioTimelineClip) => {
    switch (audioClip.sourceType) {
      case 'voice-take':
        return voiceTakes.find((take) => take.id === audioClip.sourceId)?.audioUrl
      case 'music-cue':
        return musicCues.find((cue) => cue.id === audioClip.sourceId)?.audioUrl
      case 'sfx-cue':
        return soundEffectCues.find((cue) => cue.id === audioClip.sourceId)?.audioUrl
      case 'lip-sync-job':
        return lipSyncJobs.find((job) => job.id === audioClip.sourceId)?.outputVideoUrl
      default:
        return undefined
    }
  }

  const getSourceLabel = (audioClip: AudioTimelineClip) => {
    switch (audioClip.sourceType) {
      case 'voice-take': {
        const take = voiceTakes.find((item) => item.id === audioClip.sourceId)
        return take ? `Voice · ${take.voiceId}` : 'Voice'
      }
      case 'music-cue': {
        const cue = musicCues.find((item) => item.id === audioClip.sourceId)
        return cue ? `Music · ${cue.mood}/${cue.tempo}` : 'Music'
      }
      case 'sfx-cue': {
        const cue = soundEffectCues.find((item) => item.id === audioClip.sourceId)
        return cue ? `SFX · ${cue.category}` : 'SFX'
      }
      case 'lip-sync-job': {
        const job = lipSyncJobs.find((item) => item.id === audioClip.sourceId)
        return job ? `Lip Sync · ${job.provider}` : 'Lip Sync'
      }
      default:
        return 'Ambience'
    }
  }

  const tabs: Array<{ id: AudioDeskTab; label: string }> = [
    { id: 'dialogue', label: '台词' },
    { id: 'voice', label: '配音' },
    { id: 'lipsync', label: '口型同步' },
    { id: 'music', label: '配乐' },
    { id: 'sfx', label: '音效' },
    { id: 'timeline', label: '声画时间线' },
  ]

  return (
    <div className="flex-1 min-w-0 flex flex-col" style={{ background: '#060a14', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,10,20,0.9)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>Audio Desk</p>
          <p className="text-[12px] font-semibold text-white/84 mt-1">声音台负责台词、配音、口型同步、配乐、音效与声画时间线。AI 只给候选和风险提示，不会替你锁定最终方案。</p>
          <div className="flex gap-2 flex-wrap mt-2">
            <AudioTrackBadge label="对白" count={dialogueLines.length} />
            <AudioTrackBadge label="已选配音" count={voiceTakes.filter((take) => take.status === 'selected').length} />
            <AudioTrackBadge label="音乐" count={musicCues.filter((cue) => cue.status === 'selected').length} />
            <AudioTrackBadge label="音轨片段" count={audioTimeline?.tracks.reduce((sum, track) => sum + track.clips.length, 0) ?? 0} />
            {audioAdapters.map((adapter) => (
              <AudioTrackBadge key={adapter.id} label={adapter.name} count={0} />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenEditorDesk} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#a7f3d0' }}>前往剪辑台</button>
          <button onClick={onBackToCanvas} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>返回画布</button>
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
            style={{
              background: activeTab === tab.id ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.28)' : '1px solid rgba(255,255,255,0.08)',
              color: activeTab === tab.id ? '#c7d2fe' : 'rgba(255,255,255,0.58)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'dialogue' && (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">新增台词</p>
              <div className="grid gap-2 mt-4 md:grid-cols-2">
                <select
                  value={draft.roleBibleId ?? ''}
                  onChange={(e) => {
                    const role = roleBibles.find((item) => item.id === e.target.value)
                    setDraft((prev) => ({ ...prev, roleBibleId: role?.id, characterName: role?.name ?? prev.characterName }))
                  }}
                  className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  <option value="">未绑定角色</option>
                  {roleBibles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <select
                  value={draft.targetClipId ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, targetClipId: e.target.value || undefined }))}
                  className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  <option value="">未绑定剪辑镜头</option>
                  {clips.map((clip, index) => <option key={clip.id} value={clip.id}>#{index + 1} {clip.title}</option>)}
                </select>
                <select
                  value={draft.targetShotId ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, targetShotId: e.target.value || undefined }))}
                  className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  <option value="">未绑定 shot</option>
                  {shots.map((shot) => <option key={shot.id} value={shot.id}>{shot.label}</option>)}
                </select>
                <select
                  value={draft.emotion}
                  onChange={(e) => setDraft((prev) => ({ ...prev, emotion: e.target.value as DialogueLine['emotion'] }))}
                  className="w-full rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  {EMOTIONS.map((emotion) => <option key={emotion} value={emotion}>{emotion}</option>)}
                </select>
              </div>
              <textarea
                value={draft.text}
                onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="输入对白或旁白。AI 只会给你候选配音，不会自动替你锁定最终 voice。"
                rows={4}
                className="w-full rounded-2xl px-4 py-3 mt-3 text-[12px] outline-none resize-none"
                style={{ background: 'rgba(7,11,20,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)' }}
              />
              <div className="grid gap-2 mt-3 md:grid-cols-2">
                <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
                  Start
                  <input type="number" value={draft.startTime} min={0} step={0.1} onChange={(e) => setDraft((prev) => ({ ...prev, startTime: Number(e.target.value) }))} className="w-full rounded-xl px-3 py-2 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                </label>
                <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
                  End
                  <input type="number" value={draft.endTime} min={0} step={0.1} onChange={(e) => setDraft((prev) => ({ ...prev, endTime: Number(e.target.value) }))} className="w-full rounded-xl px-3 py-2 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                </label>
              </div>
              <button
                onClick={() => {
                  if (!draft.text.trim()) return
                  onAddDialogueLine({
                    roleBibleId: draft.roleBibleId,
                    characterName: draft.characterName,
                    text: draft.text.trim(),
                    emotion: draft.emotion,
                    targetShotId: draft.targetShotId,
                    targetClipId: draft.targetClipId,
                    startTime: draft.startTime,
                    endTime: draft.endTime,
                    status: 'draft',
                  })
                  setDraft((prev) => ({ ...prev, text: '' }))
                }}
                className="px-3 py-1.5 mt-3 rounded-xl text-[10px] font-semibold"
                style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
              >
                新增台词
              </button>
            </section>

            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">当前台词列表</p>
              <div className="flex flex-col gap-3 mt-4">
                {dialogueLines.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>还没有台词。先建立对白，再把它送去配音和时间线。</p>
                ) : dialogueLines.map((line) => (
                  <div key={line.id} className="rounded-xl p-3" style={{ background: activeDialogue?.id === line.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.025)', border: activeDialogue?.id === line.id ? '1px solid rgba(99,102,241,0.24)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-white/82">{line.characterName} · {line.emotion}</p>
                        <p className="text-[10px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.44)' }}>{line.text}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                          {line.startTime}s - {line.endTime}s · {line.targetClipId ? `绑定 clip #${clips.findIndex((clip) => clip.id === line.targetClipId) + 1}` : '未绑定 clip'}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button onClick={() => { setActiveDialogueId(line.id); setActiveTab('voice') }} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>去配音</button>
                        <button onClick={() => onUpdateDialogueLine(line.id, { status: line.status === 'approved' ? 'draft' : 'approved' })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: line.status === 'approved' ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.12)', border: line.status === 'approved' ? '1px solid rgba(244,63,94,0.18)' : '1px solid rgba(16,185,129,0.2)', color: line.status === 'approved' ? '#fda4af' : '#a7f3d0' }}>
                          {line.status === 'approved' ? '撤回确认' : '确认台词'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">当前台词</p>
              {activeDialogue ? (
                <>
                  <p className="text-[10px] mt-3 font-semibold text-white/82">{activeDialogue.characterName} · {activeDialogue.emotion}</p>
                  <p className="text-[10px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>{activeDialogue.text}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Provider</span>
                    <select
                      value={audioProvider}
                      onChange={(e) => setAudioProvider(e.target.value as typeof AUDIO_PROVIDERS[number])}
                      className="rounded-xl px-3 py-2 text-[10px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                    >
                      {AUDIO_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => onGenerateVoiceTakes(activeDialogue.id, audioProvider)} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>
                      {audioProvider === 'elevenlabs' ? '生成 ElevenLabs skeleton takes' : '生成 mock voice takes'}
                    </button>
                    <button onClick={() => setActiveTab('dialogue')} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>返回台词</button>
                  </div>
                  {audioProviderPayload && (
                    <pre className="mt-3 rounded-xl p-3 text-[9px] overflow-x-auto" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(99,102,241,0.2)', color: 'rgba(255,255,255,0.62)' }}>
                      {JSON.stringify(audioProviderPayload, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.38)' }}>先在台词页选择一条 Dialogue Line。</p>
              )}
            </section>
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">Voice Takes</p>
              <div className="flex flex-col gap-3 mt-4">
                {activeVoiceTakes.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>当前台词还没有 voice take。</p>
                ) : activeVoiceTakes.map((take) => (
                  <div key={take.id} className="rounded-xl p-3" style={{ background: take.status === 'selected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: take.status === 'selected' ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">{take.provider} · {take.voiceId} · {take.style}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>duration {take.duration}s · speed {take.speed}x · emotion {take.emotion}</p>
                      </div>
                      <span className="text-[9px]" style={{ color: take.status === 'selected' ? '#a7f3d0' : take.status === 'rejected' ? '#fda4af' : 'rgba(255,255,255,0.42)' }}>{take.status}</span>
                    </div>
                    <audio controls src={take.audioUrl} className="w-full mt-3" />
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={() => onSelectVoiceTake(take.id, 'selected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>选择</button>
                      <button onClick={() => onSelectVoiceTake(take.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}>拒绝</button>
                      {take.status === 'selected' && (
                        <button onClick={() => activeDialogue?.targetClipId && onAddAudioTimelineClipFromSource({ sourceType: 'voice-take', sourceId: take.id, targetEditorClipId: activeDialogue.targetClipId })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.22)', color: '#7dd3fc' }}>
                          加入声画时间线
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'lipsync' && (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">口型同步</p>
              <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.4)' }}>只有 selected VoiceTake 和目标视频镜头都明确后，才允许创建 lip sync job。系统不会自动替你同步所有镜头。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lipSyncAdapters.map((adapter) => (
                  <span
                    key={adapter.id}
                    className="px-2 py-1 rounded-lg text-[9px]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}
                  >
                    {adapter.name} · {adapter.status}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 mt-4 md:grid-cols-[1fr_auto]">
                <select
                  value={lipSyncProvider}
                  onChange={(e) => setLipSyncProvider(e.target.value as typeof LIP_SYNC_PROVIDERS[number])}
                  className="rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  {LIP_SYNC_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
                <button
                  disabled={!selectedVoiceTake || !activeDialogue?.targetClipId}
                  onClick={() => {
                    const clip = clips.find((item) => item.id === activeDialogue?.targetClipId)
                    if (!clip || !selectedVoiceTake) return
                    onCreateLipSyncJob({ targetVideoClipId: clip.sourceJobId, voiceTakeId: selectedVoiceTake.id, provider: lipSyncProvider })
                  }}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                >
                  运行 lip sync
                </button>
              </div>
              {lipSyncProviderPayload && (
                <pre className="mt-3 rounded-xl p-3 text-[9px] overflow-x-auto" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(99,102,241,0.2)', color: 'rgba(255,255,255,0.62)' }}>
                  {JSON.stringify(lipSyncProviderPayload, null, 2)}
                </pre>
              )}
            </section>
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">Lip Sync Jobs</p>
              <div className="flex flex-col gap-3 mt-4">
                {lipSyncJobs.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>还没有 lip sync job。</p>
                ) : lipSyncJobs.map((job) => (
                  <div key={job.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">{job.provider} · {job.status}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>sync score {job.syncScore ?? '--'} · target {job.targetVideoClipId}</p>
                        {job.error && <p className="text-[9px] mt-1" style={{ color: '#fda4af' }}>{job.error}</p>}
                      </div>
                      <span className="text-[9px]" style={{ color: job.status === 'done' ? '#a7f3d0' : job.status === 'failed' ? '#fda4af' : 'rgba(255,255,255,0.42)' }}>{job.status}</span>
                    </div>
                    {job.outputVideoUrl && <video src={job.outputVideoUrl} controls className="w-full rounded-lg mt-3" style={{ maxHeight: 160 }} />}
                    <div className="flex gap-2 flex-wrap mt-3">
                      {job.status === 'done' && (
                        <>
                          <button onClick={() => onAddAudioTimelineClipFromSource({ sourceType: 'lip-sync-job', sourceId: job.id, targetEditorClipId: clips.find((clip) => clip.sourceJobId === job.targetVideoClipId)?.id })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.22)', color: '#7dd3fc' }}>
                            加入声画时间线
                          </button>
                          <button onClick={() => onSendLipSyncToEditor(job.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>
                            发送到 Editor Desk
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'music' && (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-white/82">Music Cues</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>配乐候选必须保留 licenseStatus，后续商业授权才能继续接。</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={audioProvider}
                    onChange={(e) => setAudioProvider(e.target.value as typeof AUDIO_PROVIDERS[number])}
                    className="rounded-xl px-3 py-2 text-[10px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                  >
                    {AUDIO_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </select>
                  <button onClick={() => onGenerateMusicCues({ sequenceId: sequences[0]?.id, provider: audioProvider })} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}>
                    {audioProvider === 'elevenlabs' ? '生成 ElevenLabs music skeleton' : '生成配乐候选'}
                  </button>
                </div>
              </div>
              {audioProviderPayload && (
                <pre className="mt-3 rounded-xl p-3 text-[9px] overflow-x-auto" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(99,102,241,0.2)', color: 'rgba(255,255,255,0.62)' }}>
                  {JSON.stringify(audioProviderPayload, null, 2)}
                </pre>
              )}
              <div className="flex flex-col gap-3 mt-4">
                {musicCues.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>还没有 music cue。</p>
                ) : musicCues.filter((cue) => cue.targetEditorTimelineId === timeline.id).map((cue) => (
                  <div key={cue.id} className="rounded-xl p-3" style={{ background: cue.status === 'selected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: cue.status === 'selected' ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">{cue.mood} · {cue.tempo} · {cue.provider}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>license {cue.licenseStatus} · {cue.intensityCurve}</p>
                        <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{cue.prompt}</p>
                      </div>
                      <span className="text-[9px]" style={{ color: cue.status === 'selected' ? '#a7f3d0' : cue.status === 'rejected' ? '#fda4af' : 'rgba(255,255,255,0.42)' }}>{cue.status}</span>
                    </div>
                    <audio controls src={cue.audioUrl} className="w-full mt-3" />
                    <div className="flex gap-2 flex-wrap mt-3">
                      <button onClick={() => onSelectMusicCue(cue.id, 'selected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>选择</button>
                      <button onClick={() => onSelectMusicCue(cue.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}>拒绝</button>
                      {cue.status === 'selected' && (
                        <button onClick={() => onAddAudioTimelineClipFromSource({ sourceType: 'music-cue', sourceId: cue.id, targetSequenceId: cue.targetSequenceId })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.22)', color: '#7dd3fc' }}>
                          加入声画时间线
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-white/82">Music Motifs</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>角色主题、品牌主题和情绪主题都只是候选，你可以试听后再决定是否选用。</p>
                </div>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.34)' }}>已选 {selectedMotifs.length}</span>
              </div>
              <div className="flex flex-col gap-3 mt-4">
                {musicMotifs.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>还没有 music motif。</p>
                ) : musicMotifs.map((motif) => (
                  <div key={motif.id} className="rounded-xl p-3" style={{ background: motif.status === 'selected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: motif.status === 'selected' ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">{motif.name}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>{motif.targetType} · {motif.tempo} · {motif.instrumentation}</p>
                        <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{motif.description}</p>
                      </div>
                      <span className="text-[9px]" style={{ color: motif.status === 'selected' ? '#a7f3d0' : motif.status === 'rejected' ? '#fda4af' : 'rgba(255,255,255,0.42)' }}>{motif.status}</span>
                    </div>
                    <audio controls src={motif.audioUrl} className="w-full mt-3" />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => onSelectMusicMotif(motif.id, 'selected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>选择</button>
                      <button onClick={() => onSelectMusicMotif(motif.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}>拒绝</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'sfx' && (
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">生成音效候选</p>
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.38)' }}>只为你指定的镜头生成音效候选，不会自动铺满整条时间线。</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Provider</span>
                <select
                  value={audioProvider}
                  onChange={(e) => setAudioProvider(e.target.value as typeof AUDIO_PROVIDERS[number])}
                  className="rounded-xl px-3 py-2 text-[10px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}
                >
                  {AUDIO_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                {clips.map((clip, index) => (
                  <button key={clip.id} onClick={() => onGenerateSoundEffects(clip.id, audioProvider)} className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.68)' }}>
                    为 #{index + 1} {clip.title} 生成{audioProvider === 'elevenlabs' ? ' ElevenLabs skeleton' : ''}候选
                  </button>
                ))}
              </div>
              {audioProviderPayload && (
                <pre className="mt-3 rounded-xl p-3 text-[9px] overflow-x-auto" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(99,102,241,0.2)', color: 'rgba(255,255,255,0.62)' }}>
                  {JSON.stringify(audioProviderPayload, null, 2)}
                </pre>
              )}
            </section>
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold text-white/82">Sound Effects</p>
              <div className="flex flex-col gap-3 mt-4">
                {soundEffectCues.length === 0 ? (
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>还没有音效候选。</p>
                ) : soundEffectCues.map((cue) => (
                  <div key={cue.id} className="rounded-xl p-3" style={{ background: cue.status === 'selected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: cue.status === 'selected' ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-white/82">{cue.category} · {cue.provider}</p>
                        <p className="text-[9px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.42)' }}>{cue.description}</p>
                      </div>
                      <span className="text-[9px]" style={{ color: cue.status === 'selected' ? '#a7f3d0' : cue.status === 'rejected' ? '#fda4af' : 'rgba(255,255,255,0.42)' }}>{cue.status}</span>
                    </div>
                    <audio controls src={cue.audioUrl} className="w-full mt-3" />
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={() => onSelectSoundEffectCue(cue.id, 'selected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>选择</button>
                      <button onClick={() => onSelectSoundEffectCue(cue.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)', color: '#fda4af' }}>拒绝</button>
                      {cue.status === 'selected' && (
                        <button onClick={() => onAddAudioTimelineClipFromSource({ sourceType: 'sfx-cue', sourceId: cue.id, targetEditorClipId: cue.targetClipId })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.22)', color: '#7dd3fc' }}>
                          加入声画时间线
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="grid gap-4">
            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-white/82">声画时间线</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>这是一个轻量 Audio Timeline，不是 DAW。你可以手动调整起点、音量、fade 和 sync 状态，但系统不会自动替你改轨道。</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.56)' }}>
                    {audioTimeline?.status ?? 'draft'}
                  </span>
                  {cueSheet && (
                    <button onClick={() => onUpdateCueSheetStatus(cueSheet.status === 'approved' ? 'draft' : 'approved')} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold" style={{ background: cueSheet.status === 'approved' ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.12)', border: cueSheet.status === 'approved' ? '1px solid rgba(244,63,94,0.18)' : '1px solid rgba(16,185,129,0.2)', color: cueSheet.status === 'approved' ? '#fda4af' : '#a7f3d0' }}>
                      {cueSheet.status === 'approved' ? '撤回 Cue Sheet 确认' : '确认 Cue Sheet'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 mt-4">
                {audioTimeline?.tracks.map((track) => (
                  <div key={track.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold text-white/82">{track.name}</p>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{track.clips.length} clips</span>
                    </div>
                    <div className="flex flex-col gap-3 mt-3">
                      {track.clips.length === 0 ? (
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>这个 track 还没有内容。请从配音/音乐/音效/lip sync 区手动加入。</p>
                      ) : track.clips.map((audioClip) => {
                        const previewUrl = getSourcePreview(audioClip)
                        return (
                          <div key={audioClip.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold text-white/82">{getSourceLabel(audioClip)}</p>
                                <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
                                  {audioClip.startTime.toFixed(1)}s → {audioClip.endTime.toFixed(1)}s · {audioClip.syncStatus} · vol {audioClip.volume}
                                </p>
                                <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                  target clip {audioClip.targetEditorClipId ? `#${clips.findIndex((clip) => clip.id === audioClip.targetEditorClipId) + 1}` : '未绑定'} · fade in/out {audioClip.fadeIn}s / {audioClip.fadeOut}s
                                </p>
                              </div>
                              <span className="text-[9px]" style={{ color: audioClip.locked ? '#fde68a' : 'rgba(255,255,255,0.4)' }}>{audioClip.locked ? 'locked' : 'editable'}</span>
                            </div>
                            {previewUrl && (
                              audioClip.sourceType === 'lip-sync-job'
                                ? <video src={previewUrl} controls className="w-full rounded-lg mt-3" style={{ maxHeight: 140 }} />
                                : <audio controls src={previewUrl} className="w-full mt-3" />
                            )}
                            <div className="grid gap-2 mt-3 md:grid-cols-4">
                              <label className="text-[9px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                起点
                                <input type="number" min={0} step={0.1} value={audioClip.startTime} onChange={(e) => onUpdateAudioTimelineClip(track.type, audioClip.id, { startTime: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                              </label>
                              <label className="text-[9px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                音量
                                <input type="number" min={0} max={100} step={1} value={audioClip.volume} onChange={(e) => onUpdateAudioTimelineClip(track.type, audioClip.id, { volume: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                              </label>
                              <label className="text-[9px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                Fade In
                                <input type="number" min={0} step={0.1} value={audioClip.fadeIn} onChange={(e) => onUpdateAudioTimelineClip(track.type, audioClip.id, { fadeIn: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                              </label>
                              <label className="text-[9px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                Fade Out
                                <input type="number" min={0} step={0.1} value={audioClip.fadeOut} onChange={(e) => onUpdateAudioTimelineClip(track.type, audioClip.id, { fadeOut: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 mt-1 text-[10px] outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                              </label>
                            </div>
                            <div className="flex gap-2 flex-wrap mt-3">
                              <button onClick={() => onUpdateAudioTimelineClip(track.type, audioClip.id, { syncStatus: 'synced' })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0' }}>标记 synced</button>
                              <button onClick={() => onUpdateAudioTimelineClip(track.type, audioClip.id, { syncStatus: 'needs-review' })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}>查看同步问题</button>
                              <button onClick={() => setActiveTab(audioClip.sourceType === 'voice-take' ? 'voice' : audioClip.sourceType === 'music-cue' ? 'music' : audioClip.sourceType === 'sfx-cue' ? 'sfx' : 'lipsync')} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>替换版本</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-white/82">Cue Sheet</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>AI 只生成 cue 建议。是否采纳、忽略或编辑，都由你决定。</p>
                  </div>
                  {cueSheet && <span className="text-[9px]" style={{ color: cueSheet.status === 'approved' ? '#a7f3d0' : 'rgba(255,255,255,0.42)' }}>{cueSheet.status}</span>}
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  {cueSheet?.cues.length ? cueSheet.cues.map((cue) => (
                    <div key={cue.id} className="rounded-xl p-3" style={{ background: cue.approved ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)', border: cue.approved ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold text-white/82">{cue.timecode} · {cue.cueType}</p>
                          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>{cue.mood} · intensity {cue.intensity} · {cue.suggestedInstrumentation}</p>
                        </div>
                        <span className="text-[9px]" style={{ color: cue.approved ? '#a7f3d0' : 'rgba(255,255,255,0.42)' }}>{cue.approved ? 'approved' : 'draft'}</span>
                      </div>
                      <textarea value={cue.description} onChange={(e) => onUpdateCuePoint(cue.id, { description: e.target.value })} rows={2} className="w-full rounded-xl px-3 py-2 mt-3 text-[10px] outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }} />
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => onUpdateCuePoint(cue.id, { approved: !cue.approved })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: cue.approved ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.12)', border: cue.approved ? '1px solid rgba(244,63,94,0.18)' : '1px solid rgba(16,185,129,0.2)', color: cue.approved ? '#fda4af' : '#a7f3d0' }}>
                          {cue.approved ? '撤回 cue' : '采纳 cue'}
                        </button>
                        <button onClick={() => onUpdateCuePoint(cue.id, { intensity: Math.max(0, Math.min(100, cue.intensity + 10)) })} className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>
                          增强 intensity
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>当前还没有 cue sheet。</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
                <p className="text-[11px] font-semibold text-[#c7d2fe]">AI 声画风险提示</p>
                <div className="flex flex-col gap-3 mt-4">
                  {timelineIssues.length === 0 ? (
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>当前声画时间线没有明显强风险。</p>
                  ) : timelineIssues.map((issue) => (
                    <div key={issue.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold" style={{ color: issue.severity === 'strong' ? '#fda4af' : issue.severity === 'warning' ? '#fde68a' : '#c7d2fe' }}>{issue.type}</p>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.36)' }}>{issue.severity}</span>
                      </div>
                      <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>{issue.message}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            if (issue.suggestedAction === 'adjust-dialogue' || issue.suggestedAction === 'regenerate-voice') setActiveTab('voice')
                            else if (issue.suggestedAction === 'run-lipsync') setActiveTab('lipsync')
                            else if (issue.suggestedAction === 'change-music' || issue.suggestedAction === 'review-license') setActiveTab('music')
                            else if (issue.suggestedAction === 'add-sfx-hit') setActiveTab('sfx')
                            else setActiveTab('timeline')
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-semibold"
                          style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
                        >
                          去处理
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[11px] font-semibold text-white/82">Clip Audio Review</p>
                  <div className="flex flex-col gap-3 mt-3">
                    {clips.map((clip) => {
                      const review = audioReviews[clip.id]
                      if (!review) return null
                      return (
                        <div key={clip.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <p className="text-[10px] font-semibold text-white/82">{clip.title}</p>
                          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
                            dialogue {review.dialogueSyncScore} · lip {review.lipSyncScore} · music {review.musicFitScore} · sfx {review.sfxFitScore}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
