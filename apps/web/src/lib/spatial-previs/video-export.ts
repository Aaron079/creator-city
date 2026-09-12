export type PrevisVideoExportOptions = {
  canvas: Pick<HTMLCanvasElement, 'captureStream'>
  durationSec: number
  fps?: number
  onTime?: (timeSec: number) => void
  signal?: AbortSignal
}

function unsupported() {
  return new Error('此浏览器不支持预演视频导出。')
}

function cancelled() {
  return new Error('预演视频导出已取消。')
}

function failed() {
  return new Error('预演视频导出失败。')
}

function selectMimeType(Recorder: typeof MediaRecorder) {
  return Recorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : Recorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : null
}

function stopStreamTracks(stream: MediaStream) {
  for (const track of stream.getTracks?.() ?? []) track.stop()
}

export async function exportPrevisWebM({
  canvas,
  durationSec,
  fps = 30,
  onTime = () => undefined,
  signal,
}: PrevisVideoExportOptions): Promise<Blob> {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw failed()
  if (signal?.aborted) throw cancelled()
  const Recorder = globalThis.MediaRecorder
  if (!Recorder || typeof canvas.captureStream !== 'function') throw unsupported()

  let stream: MediaStream
  try {
    stream = canvas.captureStream(fps)
  } catch {
    throw failed()
  }
  const mimeType = selectMimeType(Recorder)
  if (!stream || !mimeType) {
    if (stream) stopStreamTracks(stream)
    throw unsupported()
  }

  let recorder: MediaRecorder
  try {
    recorder = new Recorder(stream, { mimeType })
  } catch {
    stopStreamTracks(stream)
    throw failed()
  }

  return new Promise<Blob>((resolve, reject) => {
    const chunks: BlobPart[] = []
    const startedAt = globalThis.performance?.now?.() ?? Date.now()
    let animationFrame: number | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const requestFrame = globalThis.requestAnimationFrame
      ?? ((callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16) as unknown as number)
    const cancelFrame = globalThis.cancelAnimationFrame ?? clearTimeout

    const cleanup = () => {
      if (animationFrame !== undefined) cancelFrame(animationFrame)
      if (timeout !== undefined) clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      recorder.removeEventListener('dataavailable', onData)
      recorder.removeEventListener('error', onError)
      recorder.removeEventListener('stop', onStop)
      stopStreamTracks(stream)
    }

    const stopRecorder = () => {
      if (recorder.state !== 'recording') return true
      try {
        recorder.stop()
        return true
      } catch {
        return false
      }
    }

    const rejectOnce = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const resolveOnce = (blob: Blob) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(blob)
    }

    const updateTime = () => {
      const now = globalThis.performance?.now?.() ?? Date.now()
      const timeSec = Math.min(durationSec, Math.max(0, (now - startedAt) / 1_000))
      onTime(timeSec)
      if (!settled && recorder.state === 'recording') animationFrame = requestFrame(updateTime)
    }

    const onData = (event: BlobEvent) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const onError = () => {
      rejectOnce(failed())
      stopRecorder()
    }
    const onStop = () => {
      onTime(durationSec)
      const blob = new Blob(chunks, { type: 'video/webm' })
      if (blob.size === 0) rejectOnce(failed())
      else resolveOnce(blob)
    }
    const onAbort = () => {
      rejectOnce(cancelled())
      stopRecorder()
    }

    recorder.addEventListener('dataavailable', onData)
    recorder.addEventListener('error', onError)
    recorder.addEventListener('stop', onStop)
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      onTime(0)
      recorder.start()
      animationFrame = requestFrame(updateTime)
      timeout = setTimeout(() => {
        try {
          if (!stopRecorder()) rejectOnce(failed())
        } catch {
          rejectOnce(failed())
        }
      }, durationSec * 1_000)
    } catch {
      rejectOnce(failed())
      stopRecorder()
    }
  })
}
