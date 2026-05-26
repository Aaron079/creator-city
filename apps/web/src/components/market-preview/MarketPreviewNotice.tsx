// No POST, no PUT, no DELETE. Static disclaimer card only.
import { DEFAULT_PREVIEW_NOTICE } from './marketPreviewShared'

export function MarketPreviewNotice({ text }: { text?: string }) {
  return (
    <div
      style={{
        background: '#111117',
        border: '1px solid #1e1e24',
        borderLeft: '3px solid #a16207',
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
      }}
    >
      <div
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#ca8a04',
          marginBottom: '0.3rem',
        }}
      >
        当前为预览页
      </div>
      <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.65 }}>
        {text ?? DEFAULT_PREVIEW_NOTICE}
      </div>
    </div>
  )
}
