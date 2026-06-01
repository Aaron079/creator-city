'use client'

import { useState } from 'react'

const QA_ITEMS: Array<{
  id: string
  q: string
  a: string
  link?: { href: string; label: string }
}> = [
  {
    id: 'start',
    q: '我第一次使用，应该从哪里开始？',
    a: '第一步：点击左侧「+」添加一个「文本」节点，在弹出的对话框里输入你的创作想法（例如"写一段山地越野广告词"），然后点击「生成」。中国版默认使用 DeepSeek，不需要额外配置。',
  },
  {
    id: 'deepseek',
    q: '如何用 DeepSeek 生成第一段文本？',
    a: '新建文本节点后，点击节点卡片打开编辑对话框，在 Provider 一栏会显示「DeepSeek V4 Flash（推荐）」，直接输入 Prompt 并点击「生成」即可。中国版已将 DeepSeek 设为默认，无需手动切换。',
  },
  {
    id: 'image-video',
    q: '如何继续生成图片或视频？',
    a: '文本节点生成完成后，拖动节点右侧的连线圆点，选择「图片生成」或「视频生成」新建下游节点，填写 Prompt 后点击生成。图片使用 Volcengine Seedream，视频使用 Volcengine Seedance，均为中国版默认 Provider。',
  },
  {
    id: 'fail',
    q: '生成失败了怎么办？',
    a: '看到「Provider 额度不足」→ 在节点对话框切换至 DeepSeek 或其他可用 Provider；看到「数据库连接繁忙」→ 稍等几秒再重试，系统会自动降低保存频率；看到网络错误 → 刷新页面后重试。',
  },
  {
    id: 'assets',
    q: '素材在哪里找回？',
    a: '所有生成成功的图片/视频都会保存到资产库。即使节点状态显示失败，只要曾经生成成功，也可以前往 /assets 找回最近所有生成的素材。',
    link: { href: '/assets', label: '→ 打开资产库' },
  },
  {
    id: 'provider',
    q: '如何切换 Provider？',
    a: '点击节点卡片，打开编辑对话框，在顶部的 Provider 下拉框中可以选择 DeepSeek、Kimi、Volcengine 等可用 Provider，当前选择会自动保存到节点，不会影响其他节点。',
  },
]

export function BeginnerGuidePanel() {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>('start')

  return (
    <>
      {/* Floating guide button — bottom-right of canvas */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-no-node-drag="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          background: open ? 'rgba(99,102,241,0.22)' : 'rgba(8,10,20,0.84)',
          border: `1px solid ${open ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.10)'}`,
          borderRadius: 999,
          color: open ? '#c7d2fe' : 'rgba(255,255,255,0.52)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.42)',
          letterSpacing: 0.3,
          transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
          userSelect: 'none',
        }}
        title={open ? '关闭新手引导' : '新手创作引导'}
        aria-label={open ? '关闭新手引导' : '新手创作引导'}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>✦</span>
        <span>新手引导</span>
      </button>

      {/* Guide panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Creator City 新手创作助手"
          data-no-node-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 60,
            right: 20,
            zIndex: 200,
            width: 360,
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            background: 'rgba(8,10,20,0.96)',
            border: '1px solid rgba(99,102,241,0.28)',
            borderRadius: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.64)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: -0.2 }}>
                Creator City 新手创作助手
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                固定引导 · 无 AI 调用 · 点击问题展开答案
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.32)',
                fontSize: 20,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 6,
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-label="关闭新手引导"
            >
              ×
            </button>
          </div>

          {/* Q&A accordion */}
          <div style={{ padding: '6px 0' }}>
            {QA_ITEMS.map(({ id, q, a, link }) => {
              const expanded = expandedId === id
              return (
                <div key={id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '11px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: expanded ? '#c7d2fe' : '#94a3b8',
                      lineHeight: 1.45,
                      flex: 1,
                    }}>
                      {q}
                    </span>
                    <span style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.25)',
                      flexShrink: 0,
                      marginTop: 1,
                      transform: expanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s ease',
                      display: 'inline-block',
                    }}>
                      ›
                    </span>
                  </button>

                  {expanded && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.60)',
                        lineHeight: 1.75,
                        margin: 0,
                      }}>
                        {a}
                      </p>
                      {link && (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: 11,
                            color: '#6ee7b7',
                            fontWeight: 600,
                            textDecoration: 'none',
                            letterSpacing: 0.2,
                          }}
                        >
                          {link.label}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer CTA */}
          <div style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <a
              href="/providers"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.40)',
                textDecoration: 'none',
                padding: '4px 10px',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Provider 状态
            </a>
            <a
              href="/assets"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: '#6ee7b7',
                textDecoration: 'none',
                padding: '4px 10px',
                border: '1px solid rgba(110,231,183,0.22)',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              资产库
            </a>
          </div>
        </div>
      )}
    </>
  )
}
