'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, Plus, Trash2, Upload } from 'lucide-react'
import { studioOf, updateStudio } from '@/lib/spatial-previs/studio'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'
import type { ReviewNote } from '@/lib/spatial-previs/studio-types'
import { StudioNumber } from './SpatialStudioTools'
import styles from './spatial-studio-styles'

export function SpatialStudioComparison({ state, time, disabled, onTime, onChange, preview }: {
  state: SpatialPrevisState; time: number; disabled: boolean; onTime?: (time: number) => void
  onChange: (state: SpatialPrevisState) => void; preview: React.ReactNode
}) {
  const review = studioOf(state).review
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const [localName, setLocalName] = useState('')
  const [playing, setPlaying] = useState(false)
  const [overlay, setOverlay] = useState(false)
  const [opacity, setOpacity] = useState(0.5)
  const [videoAspect, setVideoAspect] = useState(16 / 9)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ReviewNote['category']>('composition')
  const [end, setEnd] = useState(time)
  const [error, setError] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const clockTime = useRef(time)
  clockTime.current = time
  const remote = state.scene.references.find(r => r.id === review.referenceId && r.mediaType === 'video')
  const url = localUrl ?? remote?.url
  const changeReview = (patch: Partial<typeof review>) => { if (!disabled) onChange(updateStudio(state, { review: { ...review, ...patch } })) }
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])
  useEffect(() => { if (disabled) setPlaying(false) }, [disabled])
  useEffect(() => {
    if (!playing || disabled) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(state.masterTake.durationSec, clockTime.current + (now - last) / 1000)
      last = now
      clockTime.current = next
      onTime?.(next)
      if (next >= state.masterTake.durationSec) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, disabled, onTime, state.masterTake.durationSec])
  const syncVideo = () => {
    const v = video.current
    if (!v || !Number.isFinite(v.duration)) return
    const desired = time + review.offsetSec
    const target = Math.max(0, Math.min(v.duration, desired))
    if (Math.abs(v.currentTime - target) > (playing ? 0.15 : 0.015)) v.currentTime = target
    if (playing && desired >= 0 && desired < v.duration) void v.play().catch(() => { setPlaying(false); setError('视频无法播放，请检查格式或访问权限。') })
    else v.pause()
  }
  useEffect(syncVideo, [time, review.offsetSec, playing, url])
  const addNote = () => {
    if (!text.trim()) return
    changeReview({ notes: [...review.notes, { id: crypto.randomUUID(), referenceId: localUrl ? null : remote?.id ?? null, localFileName: localName || null, startSec: time, endSec: Math.max(time, Math.min(state.masterTake.durationSec, end)), category, text: text.trim(), resolved: false }] })
    setText('')
  }
  const download = () => {
    const report = { kind: 'spatial-previs-comparison', version: 1, projectId: state.projectId, masterTakeId: state.masterTake.id, resultAssetId: localUrl ? null : remote?.assetId ?? null, localFileName: localName || null, offsetSec: review.offsetSec, notes: review.notes }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'previs-comparison.json'; a.click(); URL.revokeObjectURL(url)
  }
  const result = <video ref={video} key={url ?? 'empty'} src={url} muted playsInline preload="auto" onLoadedMetadata={e => {
    const v = e.currentTarget
    if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight)
    syncVideo()
  }} onError={() => { setPlaying(false); setError('无法读取视频。请重新选择可访问的资产或本地文件。') }} />
  return <section className={styles.comparison} aria-label="生成结果对照台">
    <fieldset disabled={disabled} className={styles.actions}>
      <label>生成视频<select aria-label="对照视频资产" value={review.referenceId ?? ''} onChange={e => { setLocalUrl(null); setLocalName(''); setError(''); changeReview({ referenceId: e.target.value || null }) }}><option value="">选择视频资产</option>{state.scene.references.filter(r => r.mediaType === 'video').map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
      <input ref={file} hidden type="file" accept="video/*" onChange={e => {
        const f = e.target.files?.[0]
        if (f) { setPlaying(false); setLocalName(f.name); setLocalUrl(URL.createObjectURL(f)); setError('') }
        e.target.value = ''
      }} />
      <button type="button" onClick={() => file.current?.click()}><Upload size={14} />本地视频</button>
      <StudioNumber label="视频偏移秒" value={review.offsetSec} min={-180} max={180} onChange={offsetSec => changeReview({ offsetSec })} />
      <label className={styles.check}><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} />叠加对照</label>
      {overlay && <label>透明度<input aria-label="对照透明度" type="range" min={0} max={1} step={0.01} value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>}
      <button type="button" onClick={download}><Download size={14} />导出偏差清单</button>
    </fieldset>
    {localName && <p role="status">本地文件：{localName}（仅本次会话）</p>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.screens} style={overlay ? { gridTemplateColumns: '1fr' } : undefined}>
      <div className={styles.screen} style={{ aspectRatio: videoAspect }}><span>预演 {time.toFixed(1)}s</span>{preview}{overlay && <div style={{ position: 'absolute', inset: 0, opacity }}>{result}</div>}</div>
      {!overlay && <div className={styles.screen} style={{ aspectRatio: videoAspect }}><span>生成结果</span>{result}</div>}
    </div>
    <div className={styles.actions}>
      <button type="button" disabled={disabled || !url} aria-label={playing ? '暂停对照' : '播放对照'} onClick={() => { if (time >= state.masterTake.durationSec) onTime?.(0); setPlaying(v => !v) }}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
      <input aria-label="对照时间" type="range" min={0} max={state.masterTake.durationSec} step={0.05} value={time} disabled={disabled} onChange={e => { setPlaying(false); onTime?.(Number(e.target.value)) }} />
    </div>
    <fieldset disabled={disabled} className={styles.actions}>
      <label>偏差类型<select aria-label="偏差类型" value={category} onChange={e => setCategory(e.target.value as ReviewNote['category'])}><option value="composition">构图</option><option value="actor">人物动作</option><option value="scene">场景参照物</option><option value="lighting">光线</option><option value="timing">时间节奏</option></select></label>
      <StudioNumber label="偏差结束秒" value={Math.max(time, end)} min={time} max={state.masterTake.durationSec} onChange={setEnd} />
      <label style={{ flex: 1, minWidth: 120 }}>偏差描述<input aria-label="偏差描述" value={text} onChange={e => setText(e.target.value)} /></label>
      <button type="button" disabled={!text.trim()} onClick={addNote}><Plus size={14} />记录偏差</button>
    </fieldset>
    <div className={styles.notes}>{review.notes.map(n => <div className={styles.note} key={n.id}>
      <input aria-label={`解决偏差 ${n.text}`} type="checkbox" checked={n.resolved} disabled={disabled} onChange={e => changeReview({ notes: review.notes.map(item => item.id === n.id ? { ...item, resolved: e.target.checked } : item) })} />
      <button type="button" disabled={disabled} onClick={() => { setPlaying(false); onTime?.(n.startSec) }}>{n.startSec.toFixed(1)}–{n.endSec.toFixed(1)}s</button><span style={{ textDecoration: n.resolved ? 'line-through' : undefined }}>{n.text}</span>
      <button type="button" disabled={disabled} aria-label={`删除偏差 ${n.text}`} onClick={() => changeReview({ notes: review.notes.filter(item => item.id !== n.id) })}><Trash2 size={14} /></button>
    </div>)}</div>
  </section>
}
