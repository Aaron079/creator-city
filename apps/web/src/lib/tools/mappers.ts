import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DialogueLine, VoiceTake } from '@/store/audio-desk.store'
import type { EditorClip, EditorTimeline, Sequence, StoryboardPrevis } from '@/store/shots.store'

export function mapEditorTimelineToOTIO(timeline: EditorTimeline) {
  const orderedClips = [...timeline.clips].sort((a, b) => a.order - b.order)
  return {
    OTIO_SCHEMA: 'Timeline.1',
    metadata: {
      generator: 'Creator City OTIO Adapter v1',
      timelineId: timeline.id,
      pacingGoal: timeline.pacingGoal,
      musicDirection: timeline.musicDirection ?? null,
      status: timeline.status,
    },
    name: `Creator City Timeline · ${timeline.id}`,
    tracks: [
      {
        OTIO_SCHEMA: 'Track.1',
        kind: 'Video',
        name: 'Main Track',
        children: orderedClips.map((clip) => ({
          OTIO_SCHEMA: 'Clip.2',
          name: clip.title,
          metadata: {
            creatorCityClipId: clip.id,
            transition: clip.transition,
            pacing: clip.pacing,
            sourceFrameId: clip.sourceFrameId,
            sourceJobId: clip.sourceJobId,
            note: clip.note ?? null,
          },
          media_reference: {
            OTIO_SCHEMA: 'ExternalReference.1',
            target_url: clip.videoUrl,
            available_range: {
              OTIO_SCHEMA: 'TimeRange.1',
              start_time: { OTIO_SCHEMA: 'RationalTime.1', value: 0, rate: 24 },
              duration: { OTIO_SCHEMA: 'RationalTime.1', value: Math.max(1, Math.round(clip.duration * 24)), rate: 24 },
            },
          },
        })),
      },
    ],
  }
}

export function mapStoryboardToBoordsExport(storyboardPrevis: StoryboardPrevis | null) {
  return {
    provider: 'boords',
    exportType: 'storyboard-summary',
    status: storyboardPrevis?.status ?? 'missing',
    aspectRatio: storyboardPrevis?.aspectRatio ?? '16:9',
    duration: storyboardPrevis?.duration ?? 0,
    shotList: (storyboardPrevis?.frames ?? []).map((frame, index) => ({
      order: index + 1,
      frameId: frame.id,
      title: frame.description,
      timecode: frame.timecode,
      status: frame.status,
      intent: frame.intent,
      movement: frame.movement,
      shotType: frame.shotType,
      imageUrl: frame.imageUrl ?? null,
    })),
  }
}

export function mapDeliveryPackageToResolveBridgeExport(pkg: DeliveryPackage) {
  const includedAssets = pkg.assets.filter((asset) => asset.included)
  return {
    provider: 'davinci-resolve-bridge',
    bridgeMode: 'finishing-export',
    packageId: pkg.id,
    projectId: pkg.projectId,
    title: pkg.title,
    status: pkg.status,
    manifest: pkg.manifest,
    includedAssets: includedAssets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      title: asset.title,
      sourceId: asset.sourceId,
      approvalStatus: asset.approvalStatus,
      licenseStatus: asset.licenseStatus,
      riskLevel: asset.riskLevel,
      url: asset.url ?? null,
    })),
    riskSummary: pkg.riskSummary,
  }
}

export function mapAudioDeskRequestToElevenLabsPayload(args: {
  kind: 'voice' | 'music' | 'sfx'
  dialogueLine?: DialogueLine | null
  sequence?: Sequence | null
  clip?: EditorClip | null
}) {
  if (args.kind === 'voice') {
    return {
      provider: 'elevenlabs',
      mode: 'voice',
      text: args.dialogueLine?.text ?? '',
      emotion: args.dialogueLine?.emotion ?? 'commercial',
      targetClipId: args.dialogueLine?.targetClipId ?? null,
      targetShotId: args.dialogueLine?.targetShotId ?? null,
    }
  }

  if (args.kind === 'music') {
    return {
      provider: 'elevenlabs',
      mode: 'music',
      prompt: `${args.sequence?.name ?? 'Main timeline'} · ${args.sequence?.goal ?? '情绪推进'} · 生成可商用音乐候选`,
      targetSequenceId: args.sequence?.id ?? null,
    }
  }

  return {
    provider: 'elevenlabs',
    mode: 'sfx',
    prompt: args.clip ? `${args.clip.title} · ${args.clip.description}` : 'SFX cue',
    targetClipId: args.clip?.id ?? null,
  }
}

export function mapLipSyncJobToSyncPayload(args: {
  targetVideoClipId: string
  voiceTakeId: string
  selectedVoiceTake?: VoiceTake | null
}) {
  return {
    provider: 'sync.so',
    targetVideoClipId: args.targetVideoClipId,
    voiceTakeId: args.voiceTakeId,
    sourceAudioUrl: args.selectedVoiceTake?.audioUrl ?? null,
    voiceProvider: args.selectedVoiceTake?.provider ?? 'unknown',
    syncMode: 'facial-lipsync',
  }
}

