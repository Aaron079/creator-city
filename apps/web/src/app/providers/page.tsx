import { getChinaProviderRuntimeStatus } from '@/lib/providers/china'

const IMAGE_PROVIDERS = [
  { id: 'volcengine-seedream-image', displayName: 'Volcengine Seedream', brand: '火山方舟 · 即梦图片' },
  { id: 'jimeng-image', displayName: 'Jimeng Image', brand: '即梦 AI · 图片' },
] as const

const VIDEO_PROVIDERS = [
  { id: 'volcengine-seedance-video', displayName: 'Volcengine Seedance', brand: '火山方舟 · 即梦视频' },
  { id: 'jimeng-video', displayName: 'Jimeng Video', brand: '即梦 AI · 视频' },
] as const

function ProviderCard({
  displayName,
  brand,
  configured,
  missingEnv,
  model,
}: {
  displayName: string
  brand: string
  configured: boolean
  missingEnv: string[]
  model: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${configured ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#e8e8f0', letterSpacing: '-0.01em' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: '2px' }}>
            {brand}
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.01em',
            background: configured ? 'rgba(52,211,153,0.12)' : 'rgba(251,146,60,0.1)',
            color: configured ? '#34d399' : '#fb923c',
            border: `1px solid ${configured ? 'rgba(52,211,153,0.22)' : 'rgba(251,146,60,0.2)'}`,
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: configured ? '#34d399' : '#fb923c',
              flexShrink: 0,
            }}
          />
          {configured ? '可用' : '未配置'}
        </span>
      </div>

      {model ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.22)' }}>模型</span>
          <code
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 7px',
              borderRadius: '5px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.02em',
            }}
          >
            {model}
          </code>
        </div>
      ) : null}

      {!configured && missingEnv.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>
            缺少以下环境变量：
          </div>
          {missingEnv.map((key) => (
            <code
              key={key}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                background: 'rgba(251,146,60,0.07)',
                border: '1px solid rgba(251,146,60,0.14)',
                padding: '3px 9px',
                borderRadius: '5px',
                color: '#fb923c',
                letterSpacing: '0.03em',
                display: 'block',
              }}
            >
              {key}
            </code>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StatChip({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '16px 20px',
        minWidth: '110px',
      }}
    >
      <div style={{ fontSize: '24px', fontWeight: 700, color: accent ?? '#e8e8f0', letterSpacing: '-0.03em' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

export default function ProvidersPage() {
  const imageStatuses = IMAGE_PROVIDERS.map((p) => {
    const s = getChinaProviderRuntimeStatus(p.id)
    return {
      ...p,
      configured: s?.configured ?? false,
      missingEnv: s?.missingEnv ?? [],
      model: s?.model ?? '',
    }
  })

  const videoStatuses = VIDEO_PROVIDERS.map((p) => {
    const s = getChinaProviderRuntimeStatus(p.id)
    return {
      ...p,
      configured: s?.configured ?? false,
      missingEnv: s?.missingEnv ?? [],
      model: s?.model ?? '',
    }
  })

  const all = [...imageStatuses, ...videoStatuses]
  const available = all.filter((p) => p.configured).length
  const notConfigured = all.filter((p) => !p.configured).length

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#e8e8f0',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '0 32px',
          height: '60px',
          background: 'rgba(10,10,15,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <a
          href="/create"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            padding: '6px 10px',
            borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            transition: 'color 0.15s',
          }}
        >
          ← 返回画布
        </a>
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />
        <h1 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
          API 中心
        </h1>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>
          只读 · 不发起 API 请求
        </div>
      </header>

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 32px 80px' }}>
        {/* Page title */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e8e8f0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Provider / API 管理中心
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', margin: 0 }}>
            当前图片 &amp; 视频 API 配置状态，仅展示环境变量是否已填写，不发起任何生成请求。
          </p>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
          <StatChip label="图片 API" value={imageStatuses.length} />
          <StatChip label="视频 API" value={videoStatuses.length} />
          <StatChip label="已配置" value={available} accent="#34d399" />
          <StatChip label="未配置" value={notConfigured} accent={notConfigured > 0 ? '#fb923c' : undefined} />
        </div>

        {/* Image providers */}
        <section style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              图片 API
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
            {imageStatuses.map((p) => (
              <ProviderCard
                key={p.id}
                displayName={p.displayName}
                brand={p.brand}
                configured={p.configured}
                missingEnv={p.missingEnv}
                model={p.model}
              />
            ))}
          </div>
        </section>

        {/* Video providers */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              视频 API
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
            {videoStatuses.map((p) => (
              <ProviderCard
                key={p.id}
                displayName={p.displayName}
                brand={p.brand}
                configured={p.configured}
                missingEnv={p.missingEnv}
                model={p.model}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
