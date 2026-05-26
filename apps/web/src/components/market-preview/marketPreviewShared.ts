// No POST, no PUT, no DELETE. Static data only. Shared constants for all market preview pages.

export type MarketChainKey =
  | 'marketplace'
  | 'creator-profile'
  | 'demand-board'
  | 'proposal-flow'
  | 'milestone-delivery'
  | 'escrow'

export const MARKET_CHAIN_ITEMS: Array<{
  key: MarketChainKey
  index: number
  label: string
  href: string
}> = [
  { key: 'marketplace', index: 1, label: '市场总览', href: '/marketplace-preview' },
  { key: 'creator-profile', index: 2, label: '创作者主页', href: '/creator-profile-preview' },
  { key: 'demand-board', index: 3, label: '需求广场', href: '/demand-board-preview' },
  { key: 'proposal-flow', index: 4, label: '报价方案', href: '/proposal-flow-preview' },
  { key: 'milestone-delivery', index: 5, label: '阶段交付', href: '/milestone-delivery-preview' },
  { key: 'escrow', index: 6, label: '托管结算', href: '/escrow-preview' },
]

export const MARKET_ACCENT_COLOR: Record<MarketChainKey, string> = {
  marketplace: '#7c3aed',
  'creator-profile': '#7c3aed',
  'demand-board': '#16a34a',
  'proposal-flow': '#d97706',
  'milestone-delivery': '#0891b2',
  escrow: '#6366f1',
}

export const MARKET_ACCENT_LIGHT: Record<MarketChainKey, string> = {
  marketplace: '#a78bfa',
  'creator-profile': '#a78bfa',
  'demand-board': '#4ade80',
  'proposal-flow': '#fbbf24',
  'milestone-delivery': '#22d3ee',
  escrow: '#818cf8',
}

export const DEFAULT_PREVIEW_NOTICE =
  '当前为静态预览规则，不接支付、不创建订单、不执行结算、不退款、不写数据库。'

export const MARKET_BACK_LINKS: Record<MarketChainKey, { href: string; label: string }> = {
  marketplace: { href: '/', label: '返回首页' },
  'creator-profile': { href: '/marketplace-preview', label: '返回市场总览' },
  'demand-board': { href: '/marketplace-preview', label: '返回市场总览' },
  'proposal-flow': { href: '/demand-board-preview', label: '返回需求广场' },
  'milestone-delivery': { href: '/proposal-flow-preview', label: '返回报价方案' },
  escrow: { href: '/milestone-delivery-preview', label: '返回阶段交付' },
}
