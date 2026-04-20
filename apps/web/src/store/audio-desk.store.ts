import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DialogueLine {
  id: string
  roleBibleId?: string
  characterName: string
  text: string
  emotion: 'calm' | 'sad' | 'angry' | 'excited' | 'whisper' | 'commercial'
  targetShotId?: string
  targetClipId?: string
  startTime: number
  endTime: number
  status: 'draft' | 'approved'
}

export interface VoiceTake {
  id: string
  dialogueLineId: string
  provider: 'mock' | 'elevenlabs' | 'openai' | 'other'
  voiceId: string
  style: string
  speed: number
  emotion: DialogueLine['emotion']
  audioUrl: string
  duration: number
  status: 'draft' | 'selected' | 'rejected'
}

export interface LipSyncJob {
  id: string
  targetVideoClipId: string
  voiceTakeId: string
  provider: 'mock' | 'sync' | 'heygen'
  status: 'queued' | 'running' | 'done' | 'failed'
  outputVideoUrl?: string
  syncScore?: number
  error?: string
}

export interface AudioTimelineClip {
  id: string
  sourceType: 'voice-take' | 'music-cue' | 'sfx-cue' | 'lip-sync-job' | 'ambience'
  sourceId: string
  targetEditorClipId?: string
  targetSequenceId?: string
  startTime: number
  endTime: number
  volume: number
  fadeIn: number
  fadeOut: number
  locked: boolean
  syncStatus: 'unsynced' | 'rough-sync' | 'synced' | 'needs-review'
}

export interface AudioTrack {
  id: string
  type: 'dialogue' | 'music' | 'sfx' | 'ambience' | 'lip-sync'
  name: string
  clips: AudioTimelineClip[]
}

export interface AudioTimeline {
  id: string
  editorTimelineId: string
  tracks: AudioTrack[]
  duration: number
  status: 'draft' | 'review' | 'locked'
  createdAt: string
}

export interface MusicCue {
  id: string
  targetSequenceId?: string
  targetEditorTimelineId?: string
  mood: 'tension' | 'hope' | 'lonely' | 'commercial' | 'epic' | 'warm'
  tempo: 'slow' | 'medium' | 'fast'
  intensityCurve: 'rising' | 'falling' | 'wave' | 'flat'
  provider: 'mock' | 'eleven-music' | 'stable-audio' | 'mubert' | 'aiva'
  prompt: string
  audioUrl: string
  duration: number
  licenseStatus: 'unknown' | 'user-provided' | 'commercial-cleared'
  status: 'draft' | 'selected' | 'rejected'
}

export interface SoundEffectCue {
  id: string
  targetClipId: string
  category: 'impact' | 'transition' | 'ambient' | 'footstep' | 'object' | 'whoosh'
  description: string
  audioUrl: string
  provider: 'mock' | 'elevenlabs' | 'custom'
  status: 'draft' | 'selected' | 'rejected'
}

export interface AudioSyncIssue {
  id: string
  type: 'dialogue-too-long' | 'lip-sync-offset' | 'music-over-dialogue' | 'weak-emotion-match' | 'missing-sfx-hit' | 'abrupt-transition' | 'license-risk'
  targetClipId?: string
  targetAudioClipId?: string
  message: string
  severity: 'info' | 'warning' | 'strong'
  suggestedAction: 'adjust-dialogue' | 'regenerate-voice' | 'run-lipsync' | 'change-music' | 'shift-cue' | 'send-to-editor' | 'review-license' | 'add-sfx-hit' | 'replace-version'
}

export interface AudioSyncRecommendation {
  label: string
  action: 'adjust-dialogue' | 'regenerate-voice' | 'run-lipsync' | 'change-music' | 'shift-cue' | 'send-to-editor'
}

export interface AudioSyncReview {
  id: string
  targetClipId: string
  dialogueSyncScore: number
  lipSyncScore: number
  musicFitScore: number
  sfxFitScore: number
  issues: AudioSyncIssue[]
  recommendations: AudioSyncRecommendation[]
}

export interface MusicCuePoint {
  id: string
  timecode: string
  targetSequenceId?: string
  targetClipId?: string
  cueType: 'theme-entry' | 'emotion-rise' | 'stinger' | 'transition-hit' | 'silence' | 'ending-resolution'
  mood: 'lonely' | 'tension' | 'hope' | 'epic' | 'warm' | 'commercial' | 'mysterious'
  intensity: number
  description: string
  suggestedInstrumentation: string
  approved: boolean
}

export interface CueSheet {
  id: string
  timelineId: string
  cues: MusicCuePoint[]
  musicDirection?: string
  status: 'draft' | 'approved'
}

export interface MusicMotif {
  id: string
  name: string
  targetType: 'character' | 'brand' | 'city' | 'emotion' | 'theme'
  targetId: string
  description: string
  instrumentation: string
  tempo: 'slow' | 'medium' | 'fast'
  moodTags: Array<'lonely' | 'tension' | 'hope' | 'epic' | 'warm' | 'commercial' | 'mysterious'>
  audioUrl: string
  status: 'draft' | 'selected' | 'rejected'
}

interface AudioDeskState {
  dialogueLines: DialogueLine[]
  voiceTakes: VoiceTake[]
  lipSyncJobs: LipSyncJob[]
  musicCues: MusicCue[]
  soundEffectCues: SoundEffectCue[]
  audioTimelines: AudioTimeline[]
  cueSheets: CueSheet[]
  musicMotifs: MusicMotif[]
  addDialogueLine: (line: DialogueLine) => void
  updateDialogueLine: (id: string, patch: Partial<DialogueLine>) => void
  removeDialogueLine: (id: string) => void
  upsertVoiceTakes: (takes: VoiceTake[]) => void
  updateVoiceTakeStatus: (id: string, status: VoiceTake['status']) => void
  addLipSyncJob: (job: LipSyncJob) => void
  updateLipSyncJob: (id: string, patch: Partial<LipSyncJob>) => void
  upsertMusicCues: (cues: MusicCue[]) => void
  updateMusicCueStatus: (id: string, status: MusicCue['status']) => void
  upsertSoundEffectCues: (cues: SoundEffectCue[]) => void
  updateSoundEffectCueStatus: (id: string, status: SoundEffectCue['status']) => void
  upsertAudioTimeline: (timeline: AudioTimeline) => void
  updateAudioTimelineStatus: (id: string, status: AudioTimeline['status']) => void
  upsertAudioTimelineClip: (timelineId: string, trackType: AudioTrack['type'], clip: AudioTimelineClip) => void
  updateAudioTimelineClip: (timelineId: string, trackType: AudioTrack['type'], clipId: string, patch: Partial<AudioTimelineClip>) => void
  upsertCueSheet: (sheet: CueSheet) => void
  updateCueSheetStatus: (id: string, status: CueSheet['status']) => void
  updateCuePoint: (sheetId: string, cueId: string, patch: Partial<MusicCuePoint>) => void
  upsertMusicMotifs: (motifs: MusicMotif[]) => void
  updateMusicMotifStatus: (id: string, status: MusicMotif['status']) => void
}

export function createAudioId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function buildDefaultTracks(): AudioTrack[] {
  return [
    { id: createAudioId('track'), type: 'dialogue', name: 'Dialogue', clips: [] },
    { id: createAudioId('track'), type: 'music', name: 'Music', clips: [] },
    { id: createAudioId('track'), type: 'sfx', name: 'SFX', clips: [] },
    { id: createAudioId('track'), type: 'ambience', name: 'Ambience', clips: [] },
    { id: createAudioId('track'), type: 'lip-sync', name: 'Lip Sync', clips: [] },
  ]
}

export const useAudioDeskStore = create<AudioDeskState>()(
  persist(
    (set) => ({
      dialogueLines: [],
      voiceTakes: [],
      lipSyncJobs: [],
      musicCues: [],
      soundEffectCues: [],
      audioTimelines: [],
      cueSheets: [],
      musicMotifs: [],

      addDialogueLine: (line) => {
        set((state) => ({ dialogueLines: [line, ...state.dialogueLines] }))
      },

      updateDialogueLine: (id, patch) => {
        set((state) => ({
          dialogueLines: state.dialogueLines.map((line) => line.id === id ? { ...line, ...patch } : line),
        }))
      },

      removeDialogueLine: (id) => {
        set((state) => ({
          dialogueLines: state.dialogueLines.filter((line) => line.id !== id),
          voiceTakes: state.voiceTakes.filter((take) => take.dialogueLineId !== id),
        }))
      },

      upsertVoiceTakes: (takes) => {
        set((state) => {
          const incomingIds = new Set(takes.map((take) => take.id))
          return {
            voiceTakes: [
              ...takes,
              ...state.voiceTakes.filter((take) => !incomingIds.has(take.id)),
            ],
          }
        })
      },

      updateVoiceTakeStatus: (id, status) => {
        set((state) => {
          const target = state.voiceTakes.find((take) => take.id === id)
          if (!target) return state
          return {
            voiceTakes: state.voiceTakes.map((take) => {
              if (take.dialogueLineId !== target.dialogueLineId) return take
              if (take.id === id) return { ...take, status }
              return status === 'selected' ? { ...take, status: take.status === 'selected' ? 'rejected' : take.status } : take
            }),
          }
        })
      },

      addLipSyncJob: (job) => {
        set((state) => ({ lipSyncJobs: [job, ...state.lipSyncJobs] }))
      },

      updateLipSyncJob: (id, patch) => {
        set((state) => ({
          lipSyncJobs: state.lipSyncJobs.map((job) => job.id === id ? { ...job, ...patch } : job),
        }))
      },

      upsertMusicCues: (cues) => {
        set((state) => {
          const incomingIds = new Set(cues.map((cue) => cue.id))
          return {
            musicCues: [
              ...cues,
              ...state.musicCues.filter((cue) => !incomingIds.has(cue.id)),
            ],
          }
        })
      },

      updateMusicCueStatus: (id, status) => {
        set((state) => {
          const target = state.musicCues.find((cue) => cue.id === id)
          if (!target) return state
          return {
            musicCues: state.musicCues.map((cue) => {
              if (cue.targetEditorTimelineId !== target.targetEditorTimelineId && cue.targetSequenceId !== target.targetSequenceId) return cue
              if (cue.id === id) return { ...cue, status }
              return status === 'selected' ? { ...cue, status: cue.status === 'selected' ? 'rejected' : cue.status } : cue
            }),
          }
        })
      },

      upsertSoundEffectCues: (cues) => {
        set((state) => {
          const incomingIds = new Set(cues.map((cue) => cue.id))
          return {
            soundEffectCues: [
              ...cues,
              ...state.soundEffectCues.filter((cue) => !incomingIds.has(cue.id)),
            ],
          }
        })
      },

      updateSoundEffectCueStatus: (id, status) => {
        set((state) => {
          const target = state.soundEffectCues.find((cue) => cue.id === id)
          if (!target) return state
          return {
            soundEffectCues: state.soundEffectCues.map((cue) => {
              if (cue.targetClipId !== target.targetClipId) return cue
              if (cue.id === id) return { ...cue, status }
              return status === 'selected' ? { ...cue, status: cue.status === 'selected' ? 'rejected' : cue.status } : cue
            }),
          }
        })
      },

      upsertAudioTimeline: (timeline) => {
        set((state) => ({
          audioTimelines: state.audioTimelines.some((item) => item.id === timeline.id)
            ? state.audioTimelines.map((item) => item.id === timeline.id ? timeline : item)
            : [timeline, ...state.audioTimelines],
        }))
      },

      updateAudioTimelineStatus: (id, status) => {
        set((state) => ({
          audioTimelines: state.audioTimelines.map((timeline) => timeline.id === id ? { ...timeline, status } : timeline),
        }))
      },

      upsertAudioTimelineClip: (timelineId, trackType, clip) => {
        set((state) => ({
          audioTimelines: state.audioTimelines.map((timeline) => {
            if (timeline.id !== timelineId) return timeline
            return {
              ...timeline,
              tracks: timeline.tracks.map((track) => {
                if (track.type !== trackType) return track
                return {
                  ...track,
                  clips: track.clips.some((item) => item.id === clip.id)
                    ? track.clips.map((item) => item.id === clip.id ? clip : item)
                    : [...track.clips, clip],
                }
              }),
            }
          }),
        }))
      },

      updateAudioTimelineClip: (timelineId, trackType, clipId, patch) => {
        set((state) => ({
          audioTimelines: state.audioTimelines.map((timeline) => {
            if (timeline.id !== timelineId) return timeline
            return {
              ...timeline,
              tracks: timeline.tracks.map((track) => {
                if (track.type !== trackType) return track
                return {
                  ...track,
                  clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip),
                }
              }),
            }
          }),
        }))
      },

      upsertCueSheet: (sheet) => {
        set((state) => ({
          cueSheets: state.cueSheets.some((item) => item.id === sheet.id)
            ? state.cueSheets.map((item) => item.id === sheet.id ? sheet : item)
            : [sheet, ...state.cueSheets],
        }))
      },

      updateCueSheetStatus: (id, status) => {
        set((state) => ({
          cueSheets: state.cueSheets.map((sheet) => sheet.id === id ? { ...sheet, status } : sheet),
        }))
      },

      updateCuePoint: (sheetId, cueId, patch) => {
        set((state) => ({
          cueSheets: state.cueSheets.map((sheet) => {
            if (sheet.id !== sheetId) return sheet
            return {
              ...sheet,
              cues: sheet.cues.map((cue) => cue.id === cueId ? { ...cue, ...patch } : cue),
            }
          }),
        }))
      },

      upsertMusicMotifs: (motifs) => {
        set((state) => {
          const incomingIds = new Set(motifs.map((motif) => motif.id))
          return {
            musicMotifs: [
              ...motifs,
              ...state.musicMotifs.filter((motif) => !incomingIds.has(motif.id)),
            ],
          }
        })
      },

      updateMusicMotifStatus: (id, status) => {
        set((state) => ({
          musicMotifs: state.musicMotifs.map((motif) => motif.id === id ? { ...motif, status } : motif),
        }))
      },
    }),
    { name: 'cc:audio-desk-v1' },
  ),
)

export function createDefaultAudioTimeline(editorTimelineId: string, duration: number): AudioTimeline {
  return {
    id: createAudioId('audio-timeline'),
    editorTimelineId,
    tracks: buildDefaultTracks(),
    duration,
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
}
