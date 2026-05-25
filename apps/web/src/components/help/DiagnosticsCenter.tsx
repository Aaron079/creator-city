'use client'

import { useState } from 'react'
import {
  diagnosticCategories,
  errorCodes,
  networkChecks,
  guardrailRules,
  type DiagnosticCategory,
  type ErrorCodeEntry,
} from './diagnosticData'

// ─── Shared style tokens ────────────────────────────────────────────────────

const CARD_BASE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '20px 22px',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.3)',
  marginBottom: 14,
}

const CHIP_BASE: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  padding: '2px 8px',
  borderRadius: 6,
  textTransform: 'uppercase' as const,
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  )
}

function DiagCard({ cat, isOpen, onToggle }: {
  cat: DiagnosticCategory
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ ...CARD_BASE, cursor: 'pointer', transition: 'border-color 0.15s' }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{cat.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{cat.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.5 }}>{cat.summary}</div>
          </div>
        </div>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 2 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...SECTION_LABEL }}>先检查</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
              {cat.checks.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 5, lineHeight: 1.6 }}>{c}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ ...SECTION_LABEL, color: 'rgba(239,68,68,0.7)' }}>不要做</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
              {cat.doNot.map((d, i) => (
                <li key={i} style={{ fontSize: 12, color: 'rgba(239,68,68,0.65)', marginBottom: 5, lineHeight: 1.6 }}>{d}</li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ ...SECTION_LABEL, color: 'rgba(52,211,153,0.7)' }}>处理步骤</div>
            <ol style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
              {cat.steps.map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6, lineHeight: 1.6, display: 'flex', gap: 8 }}>
                  <span style={{ color: 'rgba(52,211,153,0.6)', flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span>
                  <span>{s.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorCodeRow({ entry }: { entry: ErrorCodeEntry }) {
  const [expanded, setExpanded] = useState(false)

  const severityColor = entry.stage === 'auth'
    ? 'rgba(251,191,36,0.85)'
    : entry.stage === 'database'
      ? 'rgba(239,68,68,0.85)'
      : 'rgba(147,197,253,0.85)'

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '14px 0', cursor: 'pointer', display: 'flex', gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <code style={{
          fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
          color: severityColor,
          background: 'rgba(255,255,255,0.06)',
          padding: '2px 6px', borderRadius: 4, flexShrink: 0,
          maxWidth: 240, wordBreak: 'break-all' as const,
          whiteSpace: 'pre-wrap' as const,
        }}>{entry.code}</code>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{entry.meaning}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
            stage: {entry.stage} · 点击展开
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ paddingBottom: 16, paddingLeft: 0 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <span style={{ ...CHIP_BASE, background: 'rgba(147,197,253,0.1)', color: 'rgba(147,197,253,0.8)', marginBottom: 6, display: 'inline-block' }}>用户看到的表现</span>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{entry.symptom}</div>
            </div>
            <div>
              <span style={{ ...CHIP_BASE, background: 'rgba(251,191,36,0.1)', color: 'rgba(251,191,36,0.8)', marginBottom: 6, display: 'inline-block' }}>优先排查</span>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{entry.checkFirst}</div>
            </div>
            <div>
              <span style={{ ...CHIP_BASE, background: 'rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.7)', marginBottom: 6, display: 'inline-block' }}>不要做</span>
              <div style={{ fontSize: 12, color: 'rgba(239,68,68,0.6)', lineHeight: 1.5 }}>{entry.doNot}</div>
            </div>
            <div>
              <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.7)', marginBottom: 6, display: 'inline-block' }}>处理步骤</span>
              <ol style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
                {entry.steps.map((s, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4, lineHeight: 1.6, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'rgba(52,211,153,0.5)', flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DiagnosticsCenter() {
  const [openDiag, setOpenDiag] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'network' | 'guardrails'>('overview')

  const tabs = [
    { id: 'overview' as const, label: '快速诊断' },
    { id: 'errors' as const, label: '错误码参考' },
    { id: 'network' as const, label: 'Network 指南' },
    { id: 'guardrails' as const, label: '开发红线' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 20px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...SECTION_LABEL, marginBottom: 10 }}>Creator City</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          诊断帮助中心
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: 480 }}>
          快速定位图片、视频、资产、任务、登录与部署问题 · 只读，不触发生成
        </p>

        {/* Quick nav */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { label: '工作台', href: '/dashboard' },
            { label: '创作画布', href: '/create' },
            { label: '项目中心', href: '/projects' },
            { label: '资产中心', href: '/assets' },
            { label: '生成任务', href: '/tasks' },
            { label: 'API 中心', href: '/providers' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none',
                padding: '6px 14px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                transition: 'border-color 0.15s',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* System baseline banner */}
      <div style={{
        ...CARD_BASE,
        borderColor: 'rgba(52,211,153,0.2)',
        background: 'rgba(52,211,153,0.04)',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.9)' }}>
            系统稳定基线 2026-05-25
          </span>
          <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.7)' }}>
            图片生成 ✓
          </span>
          <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.7)' }}>
            视频生成 ✓
          </span>
          <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.7)' }}>
            OSS 持久化 ✓
          </span>
        </div>
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>图片链路:</span>
            Prompt → POST /api/generate/image → cn-executor → Seedream → OSS → Canvas 节点
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>视频链路:</span>
            Prompt → POST /api/generate/video → cn-executor → Seedance → OSS → Canvas 节点
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
              padding: '8px 14px',
              borderBottom: activeTab === tab.id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: 快速诊断 */}
      {activeTab === 'overview' && (
        <div>
          <SectionHeader>快速诊断卡片</SectionHeader>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>
            点击展开对应问题，查看排查清单和处理步骤
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {diagnosticCategories.map((cat) => (
              <DiagCard
                key={cat.id}
                cat={cat}
                isOpen={openDiag === cat.id}
                onToggle={() => setOpenDiag(openDiag === cat.id ? null : cat.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab: 错误码参考 */}
      {activeTab === 'errors' && (
        <div>
          <SectionHeader>错误码参考表</SectionHeader>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>
            点击展开每个错误码，查看用户表现、排查位置和处理步骤
          </p>
          <div style={{ ...CARD_BASE, padding: 0 }}>
            <div style={{ padding: '0 22px' }}>
              {errorCodes.map((entry, i) => (
                <ErrorCodeRow key={i} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Network 指南 */}
      {activeTab === 'network' && (
        <div>
          <SectionHeader>Network 面板检查指南</SectionHeader>

          <div style={{ ...CARD_BASE, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>打开 DevTools</div>
            <ol style={{ margin: 0, padding: '0 0 0 20px' }}>
              {[
                'Chrome: F12 或 Cmd+Option+I (Mac) → 切换到 Network 标签',
                '勾选"Preserve log"避免页面跳转时日志消失',
                '在过滤框中输入关键词搜索请求',
                '点击请求 → Response 标签查看响应 JSON',
                '点击请求 → Timing 标签查看耗时（慢网络排查）',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8, lineHeight: 1.6 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {networkChecks.map((check, i) => (
              <div key={i} style={{ ...CARD_BASE, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{check.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ ...CHIP_BASE, background: 'rgba(147,197,253,0.1)', color: 'rgba(147,197,253,0.8)' }}>
                      {check.method}
                    </span>
                    {check.tokenDrain && (
                      <span style={{ ...CHIP_BASE, background: 'rgba(239,68,68,0.12)', color: 'rgba(239,68,68,0.8)' }}>
                        消耗 token
                      </span>
                    )}
                    {!check.tokenDrain && (
                      <span style={{ ...CHIP_BASE, background: 'rgba(52,211,153,0.1)', color: 'rgba(52,211,153,0.7)' }}>
                        不消耗
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(251,191,36,0.8)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                    {check.filter}
                  </code>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.6 }}>
                    {check.expectation}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...CARD_BASE, marginTop: 16, borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(239,68,68,0.9)', marginBottom: 10 }}>⚠️ Token 消耗判断</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                <strong style={{ color: 'rgba(239,68,68,0.7)' }}>会消耗 token：</strong> POST /api/generate/image 或 POST /api/generate/video。每次 POST = 一次生成请求 = 消耗额度。
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                <strong style={{ color: 'rgba(52,211,153,0.7)' }}>不消耗 token：</strong> GET 请求（状态轮询、auth 检查）、PUT 请求（canvas 保存）、只读页面的任何请求。
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                <strong style={{ color: 'rgba(251,191,36,0.7)' }}>反证检查：</strong> 在 /dashboard、/projects、/assets、/tasks、/help 等只读页面加载时，Network 不应出现 POST /api/generate/*。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 开发红线 */}
      {activeTab === 'guardrails' && (
        <div>
          <SectionHeader>开发保护红线</SectionHeader>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>
            以下规则保护稳定生成链路，违反可能导致生成失败或 token 损耗
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {guardrailRules.map((rule) => {
              const severityStyle: React.CSSProperties = rule.severity === 'critical'
                ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }
                : rule.severity === 'high'
                  ? { background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.18)' }
                  : { background: 'rgba(147,197,253,0.04)', borderColor: 'rgba(147,197,253,0.15)' }
              const chipColor = rule.severity === 'critical'
                ? { background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.9)' }
                : rule.severity === 'high'
                  ? { background: 'rgba(251,191,36,0.12)', color: 'rgba(251,191,36,0.85)' }
                  : { background: 'rgba(147,197,253,0.1)', color: 'rgba(147,197,253,0.8)' }
              return (
                <div key={rule.id} style={{ ...CARD_BASE, ...severityStyle }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <span style={{ ...CHIP_BASE, ...chipColor, flexShrink: 0 }}>{rule.severity}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>{rule.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 5, lineHeight: 1.6 }}>{rule.description}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Frozen file list */}
          <div style={{ ...CARD_BASE, marginTop: 20, borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(239,68,68,0.9)', marginBottom: 12 }}>
              🚫 冻结文件 — 修改前必须获得明确授权
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                'apps/web/src/app/api/generate/image/route.ts',
                'apps/web/src/app/api/generate/video/route.ts',
                'apps/web/src/app/api/generate/image/status/route.ts',
                'apps/web/src/app/api/generate/video/status/route.ts',
                'apps/web/src/components/create/VisualCanvasWorkspace.tsx',
                'apps/web/src/components/create/CanvasNodeCard.tsx',
                'apps/cn-executor/src/handlers/generateImage.ts',
                'apps/cn-executor/src/handlers/jobRunner.ts',
                'apps/cn-executor/src/oss.ts',
                'apps/cn-executor/src/volcengine.ts',
                'apps/web/src/lib/auth/session.ts',
              ].map((f) => (
                <code key={f} style={{
                  fontSize: 11, fontFamily: 'monospace',
                  color: 'rgba(239,68,68,0.7)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '3px 8px', borderRadius: 4, display: 'block',
                  wordBreak: 'break-all' as const,
                }}>{f}</code>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            诊断帮助中心 · 只读 · 不触发生成 · Creator City
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '← 工作台', href: '/dashboard' },
              { label: '创作画布', href: '/create' },
              { label: '资产中心', href: '/assets' },
              { label: '生成任务', href: '/tasks' },
              { label: 'API 中心', href: '/providers' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.3)',
                  textDecoration: 'none',
                  padding: '4px 10px',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 6,
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
