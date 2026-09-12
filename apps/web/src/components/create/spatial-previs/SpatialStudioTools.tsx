'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Aperture, Check, Copy, Film, Lightbulb, Move3d, Plus, RotateCw, Ruler, ScanLine, Scaling, Trash2, Undo2, User, X } from 'lucide-react'
import { addStudioCamera, newStudioLight, POSE_JOINTS, posePreset, putCut, restPose, restoreStudioTool, retimePose, samplePose, setPose, studioOf, updateStudio } from '@/lib/spatial-previs/studio'
import { updateWhiteboxEntity } from '@/lib/spatial-previs/whitebox-edit'
import type { SpatialPrevisCameraMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import type { StudioLight, StudioTool } from '@/lib/spatial-previs/studio-types'
import type { StudioSelection } from './SpatialStudioScene'
import styles from './spatial-studio-styles'

const TOOLS = [
  { id: 'calibration', label: '场景校准', Icon: Ruler },
  { id: 'lighting', label: '三维布光', Icon: Lightbulb },
  { id: 'performance', label: '人物动作', Icon: User },
  { id: 'multicamera', label: '多机位剪辑', Icon: Film },
  { id: 'comparison', label: '结果对照', Icon: ScanLine },
] as const
export const jointLabels = { head: '头部 / 视线', leftHand: '左手', rightHand: '右手', leftFoot: '左脚', rightFoot: '右脚' }
export function StudioNumber({ label, value, onChange, min = -100, max = 100, step = 0.1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null)
  return <label>{label}<input type="number" aria-label={label} min={min} max={max} step={step} value={draft?.source === value ? draft.text : Number(value.toFixed(3))} onBlur={() => setDraft(null)} onChange={e => {
    const number = e.target.valueAsNumber
    const valid = Number.isFinite(number) && number >= min && number <= max
    setDraft({ source: valid ? number : value, text: e.target.value })
    if (valid) onChange(number)
  }} /></label>
}
function VectorFields({ label, value, onChange, min = -100 }: { label: string; value: Vec3; onChange: (value: Vec3) => void; min?: number }) {
  return <div className={styles.vector}>{(['x', 'y', 'z'] as const).map(axis => <StudioNumber key={axis} label={`${label} ${axis.toUpperCase()}`} value={value[axis]} min={min} onChange={n => onChange({ ...value, [axis]: n })} />)}</div>
}
export function SpatialStudioTools({ state, time, tool, selection, cameraMode, selectedCameraId, program, disabled, onTool, onSelection, onChange, onTime, onCamera, onProgram }: {
  state: SpatialPrevisState; time: number; tool: StudioTool | null; selection: StudioSelection; cameraMode: SpatialPrevisCameraMode; selectedCameraId: string; program: boolean; disabled: boolean
  onTool: (tool: StudioTool | null) => void; onSelection: (selection: StudioSelection) => void; onChange: (state: SpatialPrevisState) => void
  onTime?: (time: number) => void; onCamera: (id: string) => void; onProgram: (enabled: boolean) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [restore, setRestore] = useState<SpatialPrevisState | null>(null)
  const studio = studioOf(state)
  const entity = state.scene.whitebox.entities.find(e => e.id === selection.entityId)
  const light = studio.lighting.lights.find(l => l.id === selection.lightId)
  const actor = state.masterTake.actorTracks.find(a => a.id === selection.actorId)
  const pose = actor ? samplePose(state, actor.id, time) ?? restPose() : restPose()
  useEffect(() => {
    if (!tool) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onTool(null); root.current?.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`)?.focus() } }
    const outside = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!root.current?.contains(target) && !target.closest('[data-spatial-previs-viewport]')) onTool(null)
    }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [tool, onTool])
  const change = (next: SpatialPrevisState) => { if (!disabled) onChange(next) }
  const patchLight = (patch: Partial<StudioLight>) => change(updateStudio(state, { lighting: { ...studio.lighting, lights: studio.lighting.lights.map(l => l.id === light?.id ? { ...l, ...patch } : l) } }))
  const patchEntity = (patch: Parameters<typeof updateWhiteboxEntity>[2]) => {
    if (!entity) return
    const next = updateWhiteboxEntity(state, entity.id, patch)
    change(updateStudio(next, { calibration: { ...studio.calibration, verifiedEntityIds: studio.calibration.verifiedEntityIds.filter(id => id !== entity.id), editedEntityIds: [...new Set([...studio.calibration.editedEntityIds, entity.id])] } }))
  }
  const addLight = (kind: StudioLight['kind']) => {
    const light = newStudioLight(kind, crypto.randomUUID())
    change(updateStudio(state, { lighting: { ...studio.lighting, enabled: true, lights: [...studio.lighting.lights, light] } }))
    onSelection({ ...selection, lightId: light.id })
  }
  const addCamera = () => {
    const id = crypto.randomUUID()
    change(addStudioCamera(state, cameraMode, id, selectedCameraId)); onCamera(id)
  }
  return <div ref={root} className={styles.tools}>
    <div role="toolbar" aria-label="高级预演工具" className={styles.bar}>
      {TOOLS.map(({ id, label, Icon }) => <button key={id} type="button" title={label} aria-label={label} data-tool={id} aria-expanded={tool === id} disabled={disabled} onClick={() => { if (tool !== id) setRestore(structuredClone(state)); onTool(tool === id ? null : id) }}><Icon size={16} /></button>)}
      {tool && <span>{TOOLS.find(t => t.id === tool)?.label}</span>}
      {tool && <button type="button" title="关闭工具" aria-label="关闭高级工具" onClick={() => onTool(null)}><X size={15} /></button>}
    </div>
    {tool && tool !== 'comparison' && <fieldset disabled={disabled} className={styles.inspector} aria-label={`${TOOLS.find(t => t.id === tool)?.label}设置`}>
      <div className={styles.actions}>
        <button type="button" title="撤销本次工具编辑" disabled={!restore} onClick={() => { if (restore) { change(restoreStudioTool(state, restore, tool)); setRestore(null) } }}><Undo2 size={14} />撤销本次编辑</button>
      </div>
      {tool === 'calibration' && <>
        <label>参考图<select aria-label="校准参考图" value={studio.calibration.referenceId ?? ''} onChange={e => change(updateStudio(state, { calibration: { ...studio.calibration, referenceId: e.target.value || null } }))}>
          <option value="">不叠加</option>{state.scene.references.filter(r => r.mediaType === 'image').map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select></label>
        <label>叠加透明度<input aria-label="参考图透明度" type="range" min="0" max="1" step="0.01" value={studio.calibration.opacity} onChange={e => change(updateStudio(state, { calibration: { ...studio.calibration, opacity: Number(e.target.value) } }))} /></label>
        <label>场景实体<select aria-label="校准实体" value={entity?.id ?? ''} onChange={e => onSelection({ ...selection, entityId: e.target.value })}><option value="">选择实体</option>{state.scene.whitebox.entities.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
        {entity && <>
          <div className={styles.actions}>{([{ mode: 'translate', label: '移动实体', Icon: Move3d }, { mode: 'rotate', label: '旋转实体', Icon: RotateCw }, { mode: 'scale', label: '缩放实体', Icon: Scaling }] as const).map(({ mode, label, Icon }) => <button key={mode} type="button" aria-label={label} title={label} aria-pressed={selection.transform === mode} onClick={() => onSelection({ ...selection, transform: mode })}><Icon size={16} /></button>)}</div>
          <VectorFields label="实体位置" value={entity.position} onChange={position => patchEntity({ position })} />
          <VectorFields label="实体尺寸" value={entity.size} min={0.05} onChange={size => patchEntity({ size })} />
          <StudioNumber label="实体朝向 °" value={entity.rotationY * 180 / Math.PI} min={-360} max={360} step={1} onChange={n => patchEntity({ rotationY: n * Math.PI / 180 })} />
          <button type="button" onClick={() => change(updateStudio(state, { calibration: { ...studio.calibration, verifiedEntityIds: [...new Set([...studio.calibration.verifiedEntityIds, entity.id])] } }))}><Check size={14} />{studio.calibration.verifiedEntityIds.includes(entity.id) ? '已人工核对' : '确认此实体对齐'}</button>
        </>}
      </>}
      {tool === 'lighting' && <>
        <label className={styles.check}><input type="checkbox" checked={studio.lighting.enabled} onChange={e => change(updateStudio(state, { lighting: { ...studio.lighting, enabled: e.target.checked } }))} />启用布光方案</label>
        <div className={styles.actions}><button type="button" onClick={() => addLight('spot')}><Plus size={14} />聚光灯</button><button type="button" onClick={() => addLight('sun')}><Plus size={14} />太阳光</button></div>
        <StudioNumber label="环境光" value={studio.lighting.ambient} min={0} max={2} onChange={ambient => change(updateStudio(state, { lighting: { ...studio.lighting, ambient } }))} />
        <label>灯具<select aria-label="选择灯具" value={light?.id ?? ''} onChange={e => onSelection({ ...selection, lightId: e.target.value })}><option value="">选择灯具</option>{studio.lighting.lights.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        {light && <>
          <label>名称<input aria-label="灯具名称" value={light.name} onChange={e => patchLight({ name: e.target.value || '灯具' })} /></label>
          <label className={styles.check}><input type="checkbox" checked={light.enabled} onChange={e => patchLight({ enabled: e.target.checked })} />灯具开启</label>
          <label className={styles.check}><input type="checkbox" checked={selection.lampTarget} onChange={e => onSelection({ ...selection, lampTarget: e.target.checked })} />调整照射目标</label>
          <VectorFields label="灯具位置" value={light.position} onChange={position => patchLight({ position })} />
          <VectorFields label="照射目标" value={light.target} onChange={target => patchLight({ target })} />
          <StudioNumber label="光强" value={light.intensity} min={0} max={500} step={1} onChange={intensity => patchLight({ intensity })} />
          <StudioNumber label="色温 K" value={light.temperature} min={1000} max={12000} step={100} onChange={temperature => patchLight({ temperature })} />
          {light.kind === 'spot' && <StudioNumber label="光束角 °" value={light.angle * 180 / Math.PI} min={3} max={85} step={1} onChange={angle => patchLight({ angle: angle * Math.PI / 180 })} />}
          {light.kind === 'spot' && <label>光束边缘柔化<input aria-label="柔光" type="range" min="0" max="1" step="0.01" value={light.softness} onChange={e => patchLight({ softness: Number(e.target.value) })} /></label>}
          <button type="button" onClick={() => { change(updateStudio(state, { lighting: { ...studio.lighting, lights: studio.lighting.lights.filter(l => l.id !== light.id) } })); onSelection({ ...selection, lightId: '' }) }}><Trash2 size={14} />移除灯具</button>
        </>}
      </>}
      {tool === 'performance' && <>
        <label>演员<select aria-label="动作演员" value={actor?.id ?? ''} onChange={e => onSelection({ ...selection, actorId: e.target.value })}><option value="">选择演员</option>{state.masterTake.actorTracks.map(a => <option key={a.id} value={a.id}>{a.anchorId}</option>)}</select></label>
        {actor && <>
          <div className={styles.actions}>{([{ id: 'rest', label: '站立' }, { id: 'sit', label: '坐下' }, { id: 'reach', label: '伸手' }] as const).map(p => <button key={p.id} type="button" onClick={() => change(setPose(state, actor.id, time, posePreset(p.id)))}>{p.label}</button>)}</div>
          <label>关节目标<select aria-label="动作关节" value={selection.joint} onChange={e => onSelection({ ...selection, joint: e.target.value as StudioSelection['joint'] })}>{POSE_JOINTS.map(j => <option value={j} key={j}>{jointLabels[j]}</option>)}</select></label>
          <VectorFields label="关节位置" value={pose[selection.joint]} onChange={v => change(setPose(state, actor.id, time, { ...pose, [selection.joint]: v }))} />
          <StudioNumber label="身体朝向 °" value={pose.yaw * 180 / Math.PI} min={-360} max={360} step={1} onChange={n => change(setPose(state, actor.id, time, { ...pose, yaw: n * Math.PI / 180 }))} />
          <StudioNumber label="髋部高度" value={pose.hipHeight} min={-0.6} max={1.5} onChange={hipHeight => change(setPose(state, actor.id, time, { ...pose, hipHeight }))} />
          <button type="button" onClick={() => change(setPose(state, actor.id, time, pose))}><Plus size={14} />记录动作点 {time.toFixed(1)}s</button>
          {studio.performances.find(p => p.actorId === actor.id)?.keys.map(k => <div className={styles.actions} key={k.id}>
            <button type="button" onClick={() => onTime?.(k.timeSec)}>{k.timeSec.toFixed(1)}s</button>
            <input type="range" aria-label={`动作点时间 ${k.id}`} min={0} max={state.masterTake.durationSec} step={0.1} value={k.timeSec} onChange={e => change(retimePose(state, actor.id, k.id, Number(e.target.value)))} />
            <button type="button" aria-label={`删除动作点 ${k.timeSec}`} onClick={() => change(updateStudio(state, { performances: studio.performances.map(p => p.actorId === actor.id ? { ...p, keys: p.keys.filter(item => item.id !== k.id) } : p) }))}><Trash2 size={14} /></button>
          </div>)}
        </>}
      </>}
      {tool === 'multicamera' && <>
        <button type="button" onClick={addCamera}><Copy size={14} />从当前机位添加</button>
        <label className={styles.check}><input type="checkbox" checked={program} disabled={!studio.cameras.length} onChange={e => onProgram(e.target.checked)} />播放 / 导出剪辑结果</label>
        <label>编辑机位<select aria-label="编辑机位" value={selectedCameraId} onChange={e => { onCamera(e.target.value); onProgram(false) }}><option value="">原始机位</option>{studio.cameras.map(c => <option key={c.track.id} value={c.track.id}>{c.name}</option>)}</select></label>
        {studio.cameras.map(c => <div className={styles.actions} key={c.track.id}>
          <button type="button" onClick={() => change(updateStudio(putCut(state, c.track.id, time, crypto.randomUUID()), { programEnabled: true }))}><Aperture size={14} />切入 {c.name}</button>
          <button type="button" aria-label={`移除${c.name}`} onClick={() => { change(updateStudio(state, { cameras: studio.cameras.filter(item => item !== c), cuts: studio.cuts.filter(cut => cut.cameraId !== c.track.id) })); if (selectedCameraId === c.track.id) onCamera('') }}><Trash2 size={14} /></button>
        </div>)}
        <div className={styles.cutline} aria-label="机位切点轨道">{studio.cuts.map(c => <input key={c.id} aria-label={`拖动切点 ${c.id}`} type="range" min={0} max={state.masterTake.durationSec} step={0.1} value={c.timeSec} onChange={e => change(putCut(state, c.cameraId, Number(e.target.value), c.id))} />)}</div>
        {studio.cuts.map(c => <div key={c.id} className={styles.actions}>
          <StudioNumber label={`${studio.cameras.find(item => item.track.id === c.cameraId)?.name} 切入秒`} value={c.timeSec} min={0} max={state.masterTake.durationSec} onChange={n => change(putCut(state, c.cameraId, n, c.id))} />
          <button type="button" aria-label={`删除切点 ${c.id}`} onClick={() => change(updateStudio(state, { cuts: studio.cuts.filter(item => item.id !== c.id) }))}><Trash2 size={14} /></button>
        </div>)}
      </>}
    </fieldset>}
  </div>
}
