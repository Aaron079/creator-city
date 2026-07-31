import { memo } from 'react'
import {
  CanvasNodeCard,
  type CanvasNodeCardProps,
  type VisualCanvasNode,
} from '@/components/create/CanvasNodeCard'
import type { ReframeMode } from '@/components/create/AssetAgentToolbar'
import type { GenerationHealthResponse } from '@/lib/generation/health-types'
import {
  canvasNodeLayerPropsEqual,
  type CanvasNodeLayerVisualState,
} from './canvasRenderPlanning'

export type CanvasNodeCardPropsFactory = (
  visualState: CanvasNodeLayerVisualState<
    VisualCanvasNode,
    ReframeMode,
    GenerationHealthResponse | null
  >,
) => CanvasNodeCardProps

export type CanvasNodeCardPropsFactoryRef = {
  current: CanvasNodeCardPropsFactory
}

type CanvasNodeLayerProps = CanvasNodeLayerVisualState<
  VisualCanvasNode,
  ReframeMode,
  GenerationHealthResponse | null
> & {
  createCardProps: CanvasNodeCardPropsFactory
  cardPropsFactoryRef: CanvasNodeCardPropsFactoryRef
}

function CanvasNodeLayerComponent(props: CanvasNodeLayerProps) {
  const initialCardProps = props.createCardProps(props)
  const latestCardProps = () => props.cardPropsFactoryRef.current(props)

  return (
    <CanvasNodeCard
      {...initialCardProps}
      generationHealth={props.generationHealth}
      onSelect={() => latestCardProps().onSelect()}
      onAddPrev={(event) => latestCardProps().onAddPrev(event)}
      onAddNext={(event) => latestCardProps().onAddNext(event)}
      onDragStart={(event) => latestCardProps().onDragStart(event)}
      onOpenContextMenu={(event) => latestCardProps().onOpenContextMenu(event)}
      onEdit={() => latestCardProps().onEdit()}
      onOpenPreview={(type) => latestCardProps().onOpenPreview(type)}
      onOpenPromptInspector={props.canOpenPromptInspector
        ? () => latestCardProps().onOpenPromptInspector?.()
        : undefined}
      onOpenMediaDiagnostics={props.canOpenMediaDiagnostics
        ? (type) => latestCardProps().onOpenMediaDiagnostics?.(type)
        : undefined}
      onCreateStableCopy={props.canCreateStableCopy
        ? () => latestCardProps().onCreateStableCopy?.()
        : undefined}
      onRecoverMedia={props.canRecoverMedia
        ? (nodeId, patch) => latestCardProps().onRecoverMedia?.(nodeId, patch)
        : undefined}
      onRegenerateFromPrompt={props.canRegenerateFromPrompt
        ? () => latestCardProps().onRegenerateFromPrompt?.()
        : undefined}
      onOpenSkillPanel={props.canOpenSkillPanel
        ? () => latestCardProps().onOpenSkillPanel?.()
        : undefined}
      onOpenCreativeAssets={props.canOpenCreativeAssets
        ? () => latestCardProps().onOpenCreativeAssets?.()
        : undefined}
      onOpenAssetIntelligence={props.canOpenAssetIntelligence
        ? () => latestCardProps().onOpenAssetIntelligence?.()
        : undefined}
      onAddToStoryboard={props.canAddToStoryboard
        ? () => latestCardProps().onAddToStoryboard?.()
        : undefined}
      onWorkflowContinue={props.canContinueWorkflow
        ? (event) => latestCardProps().onWorkflowContinue?.(event)
        : undefined}
      onCreateDerivedVideo={props.canCreateDerivedVideo
        ? () => latestCardProps().onCreateDerivedVideo?.()
        : undefined}
      onOpenGenerationDialog={props.canOpenGenerationDialog
        ? () => latestCardProps().onOpenGenerationDialog?.()
        : undefined}
    />
  )
}

export const CanvasNodeLayer = memo(
  CanvasNodeLayerComponent,
  (previous, next) => (
    canvasNodeLayerPropsEqual(previous, next)
      && previous.createCardProps === next.createCardProps
      && previous.cardPropsFactoryRef === next.cardPropsFactoryRef
  ),
)
