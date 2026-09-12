import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportPrevisWebM } from './video-export'

type RecorderListener = (event: { data?: Blob }) => void

class FakeMediaRecorder {
  static startEvent: 'data' | 'error' = 'data'

  static isTypeSupported(type: string) {
    return type === 'video/webm;codecs=vp9' || type === 'video/webm'
  }

  private readonly listeners = new Map<string, RecorderListener[]>()
  state: 'inactive' | 'recording' = 'inactive'

  addEventListener(type: string, listener: RecorderListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  removeEventListener(type: string, listener: RecorderListener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((current) => current !== listener))
  }

  start() {
    this.state = 'recording'
    queueMicrotask(() => {
      if (FakeMediaRecorder.startEvent === 'error') this.emit('error', {})
      else this.emit('dataavailable', { data: new Blob(['previs'], { type: 'video/webm' }) })
    })
  }

  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.emit('stop', {})
  }

  protected emit(type: string, event: { data?: Blob }) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function trackableStream() {
  const tracks = [{ stopCalls: 0, stop() { this.stopCalls += 1 } }]
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    tracks,
  }
}

function replaceMediaRecorder(value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder')
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value })
  return () => {
    if (descriptor) Object.defineProperty(globalThis, 'MediaRecorder', descriptor)
    else delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder
  }
}

test('records a canvas stream and returns a WebM blob without mutating the canvas contract', async () => {
  const restoreMediaRecorder = replaceMediaRecorder(FakeMediaRecorder)
  let capturedFps = 0
  const times: number[] = []
  const { stream, tracks } = trackableStream()
  const canvas = {
    captureStream(fps: number) {
      capturedFps = fps
      return stream
    },
  } as HTMLCanvasElement

  try {
    const result = await exportPrevisWebM({ canvas, durationSec: 0.01, fps: 30, onTime: (timeSec) => times.push(timeSec) })

    assert.equal(result.type, 'video/webm')
    assert.ok(result.size > 0)
    assert.equal(capturedFps, 30)
    assert.equal(times[0], 0)
    assert.equal(times.at(-1), 0.01)
    assert.equal(tracks[0]?.stopCalls, 1)
  } finally {
    restoreMediaRecorder()
  }
})

test('reports an unavailable browser recorder instead of claiming a successful video export', async () => {
  const restoreMediaRecorder = replaceMediaRecorder(undefined)
  const canvas = { captureStream: () => ({} as MediaStream) } as HTMLCanvasElement

  try {
    await assert.rejects(
      () => exportPrevisWebM({ canvas, durationSec: 0.01, onTime: () => undefined }),
      /不支持预演视频导出/,
    )
  } finally {
    restoreMediaRecorder()
  }
})

test('reports a cancelled export instead of resolving a video after the recorder stops', async () => {
  const restoreMediaRecorder = replaceMediaRecorder(FakeMediaRecorder)
  const controller = new AbortController()
  const { stream, tracks } = trackableStream()
  const canvas = { captureStream: () => stream } as HTMLCanvasElement

  try {
    const exportPromise = exportPrevisWebM({ canvas, durationSec: 1, signal: controller.signal })
    controller.abort()
    await assert.rejects(exportPromise, /预演视频导出已取消/)
    assert.equal(tracks[0]?.stopCalls, 1)
  } finally {
    restoreMediaRecorder()
  }
})

test('stops capture tracks when the recorder reports an error', async () => {
  const restoreMediaRecorder = replaceMediaRecorder(FakeMediaRecorder)
  const { stream, tracks } = trackableStream()
  const canvas = { captureStream: () => stream } as HTMLCanvasElement
  FakeMediaRecorder.startEvent = 'error'

  try {
    await assert.rejects(() => exportPrevisWebM({ canvas, durationSec: 1 }), /预演视频导出失败/)
    assert.equal(tracks[0]?.stopCalls, 1)
  } finally {
    FakeMediaRecorder.startEvent = 'data'
    restoreMediaRecorder()
  }
})

test('stops capture tracks when no WebM MIME type is available', async () => {
  class NoMimeMediaRecorder extends FakeMediaRecorder {
    static override isTypeSupported(_type: string): _type is 'video/webm;codecs=vp9' | 'video/webm' { return false }
  }

  const restoreMediaRecorder = replaceMediaRecorder(NoMimeMediaRecorder)
  const { stream, tracks } = trackableStream()
  const canvas = { captureStream: () => stream } as HTMLCanvasElement

  try {
    await assert.rejects(() => exportPrevisWebM({ canvas, durationSec: 1 }), /不支持预演视频导出/)
    assert.equal(tracks[0]?.stopCalls, 1)
  } finally {
    restoreMediaRecorder()
  }
})
