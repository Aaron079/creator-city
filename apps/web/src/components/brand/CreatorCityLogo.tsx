// No fetch, no API, no state. Static brand component — server-safe.
import Image from 'next/image'

type LogoSize = 'sm' | 'md' | 'lg'

const SIZE_CONFIG: Record<LogoSize, { icon: number; fontSize: string; gap: string }> = {
  sm: { icon: 24, fontSize: '12px', gap: '0.4rem' },
  md: { icon: 32, fontSize: '14px', gap: '0.5rem' },
  lg: { icon: 44, fontSize: '18px', gap: '0.6rem' },
}

interface CreatorCityLogoProps {
  size?: LogoSize
  showText?: boolean
  className?: string
}

export function CreatorCityLogo({
  size = 'md',
  showText = true,
  className,
}: CreatorCityLogoProps) {
  const { icon, fontSize, gap } = SIZE_CONFIG[size]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        textDecoration: 'none',
      }}
      className={className}
    >
      {/* Icon container — white rounded circle to make deer visible on dark nav */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: icon,
          height: icon,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
        }}
      >
        <Image
          src="/brand/creator-city-logo.png"
          alt="Creator City"
          width={icon}
          height={icon}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          priority
        />
      </span>

      {/* Brand name */}
      {showText && (
        <span
          style={{
            fontSize,
            fontWeight: 700,
            letterSpacing: '0.02em',
            background: 'linear-gradient(90deg, #e8f0fc 0%, #b6c6e1 85%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Creator City
        </span>
      )}
    </span>
  )
}
