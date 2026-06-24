'use client'

import { useRef } from 'react'
import type { LocalRefEntry } from '@/lib/canvas/localImageImport'
import type { LocalScriptEntry } from '@/lib/canvas/localScriptImport'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

interface LocalReferenceStripProps {
  nodeKind: string
  refs: LocalRefEntry[]
  scriptInputs: LocalScriptEntry[]
  onImageUpload: (file: File) => void
  onRemoveRef: (inputId: string) => void
  onScriptUpload: (file: File) => void
  onRemoveScript: (inputId: string) => void
  onApplyScript: (text: string) => void
}

function friendlyUploadError(msg: string | undefined): string {
  if (!msg) return '上传失败'
  if (msg.includes('UPLOAD_TIMEOUT') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('超时')) return '超时，请重试'
  if (msg.includes('STORAGE_UPLOAD_FAILED') || msg.includes('存储失败')) return '存储失败'
  if (msg.includes('PROJECT_CHECK_FAILED') || msg.includes('验证失败')) return '验证失败'
  if (msg.includes('ASSET_RECORD_FAILED') || msg.includes('记录失败')) return '记录失败'
  if (msg.includes('FILE_TOO_LARGE') || msg.includes('20MB')) return '文件过大'
  if (msg.includes('UNAUTHORIZED') || msg.includes('登录')) return '请先登录'
  if (msg.includes('prisma') || msg.includes('Prisma') || msg.includes('Invalid `')) return '上传失败'
  return '上传失败'
}

function RefCard({ entry, onRemove }: { entry: LocalRefEntry; onRemove: (id: string) => void }) {
  const isUploading = entry.status === 'uploading'
  const isError = entry.status === 'error'
  const isDone = entry.status === 'done'
  const thumbUrl = isDone && entry.mediaUrl ? getProxiedMediaUrl(entry.mediaUrl) : null
  const shortName = entry.originalFileName.length > 12
    ? `${entry.originalFileName.slice(0, 10)}…`
    : entry.originalFileName

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 8,
        background: isError ? 'rgba(255,60,60,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isError ? 'rgba(255,60,60,0.18)' : 'rgba(255,255,255,0.07)'}`,
        width: 76,
        minWidth: 76,
        flex: 'none',
      }}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(entry.inputId)}
        aria-label="移除"
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Thumbnail / spinner / error */}
      <div
        style={{
          width: 52,
          height: 38,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {isUploading && (
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }}>◌</span>
        )}
        {isDone && thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {isDone && !thumbUrl && (
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>🖼</span>
        )}
        {isError && (
          <span style={{ fontSize: 14, color: 'rgba(255,60,60,0.7)' }}>✗</span>
        )}
      </div>

      {/* Filename */}
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          textAlign: 'center',
        }}
        title={entry.originalFileName}
      >
        {shortName}
      </div>

      {/* Status badge */}
      <span
        style={{
          fontSize: 9,
          color: isError ? 'rgba(255,100,100,0.7)' : isUploading ? 'rgba(255,220,100,0.7)' : 'rgba(100,220,100,0.7)',
          background: isError ? 'rgba(255,60,60,0.06)' : isUploading ? 'rgba(255,220,100,0.06)' : 'rgba(100,220,100,0.06)',
          border: `1px solid ${isError ? 'rgba(255,60,60,0.15)' : isUploading ? 'rgba(255,220,100,0.15)' : 'rgba(100,220,100,0.15)'}`,
          borderRadius: 3,
          padding: '1px 4px',
        }}
      >
        {isUploading ? '上传中' : isError ? '失败' : '已上传'}
      </span>

      {/* Error message */}
      {isError && (
        <div
          style={{ fontSize: 8, color: 'rgba(255,100,100,0.6)', textAlign: 'center', maxWidth: '100%', wordBreak: 'break-all' }}
          title={entry.errorMessage ?? '上传失败'}
        >
          {friendlyUploadError(entry.errorMessage)}
        </div>
      )}
    </div>
  )
}

function ScriptCard({
  entry,
  onRemove,
  onApply,
}: {
  entry: LocalScriptEntry
  onRemove: (id: string) => void
  onApply: (text: string) => void
}) {
  return (
    <div
      style={{
        padding: '6px 8px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        minWidth: 200,
        maxWidth: 280,
        flex: 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
          {entry.fileName}
        </span>
        <button
          type="button"
          onClick={() => onRemove(entry.inputId)}
          aria-label="移除"
          style={{
            width: 16, height: 16, borderRadius: '50%',
            border: 'none', background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Char count */}
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
        {entry.charCount.toLocaleString()} 字符
      </div>

      {/* Preview */}
      <div
        style={{
          fontSize: 9, color: 'rgba(255,255,255,0.45)',
          background: 'rgba(255,255,255,0.03)', borderRadius: 4,
          padding: '4px 6px', marginBottom: 6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 48, overflow: 'hidden',
          lineHeight: 1.4,
        }}
      >
        {entry.textPreview || '（空文件）'}
      </div>

      {/* Apply button */}
      <button
        type="button"
        onClick={() => onApply(entry.fullText)}
        style={{
          width: '100%',
          padding: '3px 0',
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 10,
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        应用到 Prompt
      </button>
    </div>
  )
}

export function LocalReferenceStrip({
  nodeKind,
  refs,
  scriptInputs,
  onImageUpload,
  onRemoveRef,
  onScriptUpload,
  onRemoveScript,
  onApplyScript,
}: LocalReferenceStripProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const scriptInputRef = useRef<HTMLInputElement | null>(null)

  const showImageSection = nodeKind === 'image' || nodeKind === 'video'
  const showScriptSection = nodeKind === 'text'

  if (!showImageSection && !showScriptSection) return null

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 600,
  }

  const uploadBtnStyle: React.CSSProperties = {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: '16px',
  }

  return (
    <div
      data-no-node-drag="true"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.012)',
      }}
    >
      {/* Image reference section */}
      {showImageSection && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: refs.length > 0 ? 8 : 0 }}>
            <div style={labelStyle}>
              本地参考输入{refs.length > 0 ? ` (${refs.length})` : ''}
            </div>
            <button
              type="button"
              style={uploadBtnStyle}
              onClick={() => imageInputRef.current?.click()}
            >
              + 上传参考图
            </button>
          </div>

          {refs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {refs.map((ref) => (
                <RefCard key={ref.inputId} entry={ref} onRemove={onRemoveRef} />
              ))}
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImageUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* Script / text section */}
      {showScriptSection && (
        <div style={{ marginTop: showImageSection ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: scriptInputs.length > 0 ? 8 : 0 }}>
            <div style={labelStyle}>
              剧本 / 文本输入{scriptInputs.length > 0 ? ` (${scriptInputs.length})` : ''}
            </div>
            <button
              type="button"
              style={uploadBtnStyle}
              onClick={() => scriptInputRef.current?.click()}
            >
              + 上传文本文件
            </button>
          </div>

          {scriptInputs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {scriptInputs.map((s) => (
                <ScriptCard key={s.inputId} entry={s} onRemove={onRemoveScript} onApply={onApplyScript} />
              ))}
            </div>
          )}

          <input
            ref={scriptInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onScriptUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
