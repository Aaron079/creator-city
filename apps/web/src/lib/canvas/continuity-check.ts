// Pure rule-engine for canvas continuity analysis.
// No API calls, no generation, no credits consumed.

export type CheckSeverity = 'pass' | 'info' | 'warn' | 'risk'

export interface ContinuityIssue {
  id: string
  severity: CheckSeverity
  category: 'characters' | 'location' | 'timeline' | 'style' | 'shotLanguage' | 'assetHealth'
  title: string
  description: string
  affectedNodeIds: string[]
  suggestion: string
  canJumpToNode: boolean
}

export interface ContinuitySection {
  category: ContinuityIssue['category']
  label: string
  severity: CheckSeverity
  issueCount: number
  summary: string
}

export interface ContinuityReport {
  totalNodesChecked: number
  overallScore: number
  summary: string
  passCount: number
  warnCount: number
  riskCount: number
  infoCount: number
  sections: ContinuitySection[]
  issues: ContinuityIssue[]
  generatedAt: number
}

// Minimal node shape needed for continuity analysis
export interface ContNode {
  id: string
  kind: string
  title?: string
  prompt?: string
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  assetId?: string
  status?: string
  metadataJson?: unknown
}

// Minimal edge shape
export interface ContEdge {
  id: string
  fromNodeId: string
  toNodeId: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function safeObj(val: unknown): Record<string, unknown> {
  return val != null && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function safeStr(val: unknown): string {
  return typeof val === 'string' ? val : ''
}

function nodeLabel(node: ContNode): string {
  const t = node.title?.trim()
  if (t) return t
  return node.kind === 'text' ? '文本节点' : node.kind === 'image' ? '图片节点' : node.kind === 'video' ? '视频节点' : '节点'
}

function getNodeText(node: ContNode): string {
  const meta = safeObj(node.metadataJson)
  const intel = safeObj(meta['assetIntelligence'])
  const chars = Array.isArray(intel['characters'])
    ? (intel['characters'] as unknown[]).map(safeStr).join(' ')
    : safeStr(intel['characters'])
  const intelText = [
    safeStr(intel['description']),
    safeStr(intel['visualStyle']),
    safeStr(intel['mood']),
    safeStr(intel['cinematography']),
    chars,
  ].filter(Boolean).join(' ')
  return [node.resultText, node.prompt, node.title, intelText].filter(Boolean).join(' ')
}

function isCheckable(node: ContNode): boolean {
  return (
    (node.kind === 'text' || node.kind === 'image' || node.kind === 'video') &&
    Boolean(node.prompt || node.resultText || node.assetId || node.resultImageUrl || node.resultVideoUrl)
  )
}

// Build connected pairs for pairwise checks.
// Uses edges when available; falls back to consecutive order.
function getCheckPairs(nodes: ContNode[], edges: ContEdge[]): Array<[ContNode, ContNode]> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const pairs: Array<[ContNode, ContNode]> = []

  const validEdges = edges.filter((e) => nodeMap.has(e.fromNodeId) && nodeMap.has(e.toNodeId))
  if (validEdges.length > 0) {
    for (const e of validEdges) {
      const a = nodeMap.get(e.fromNodeId)
      const b = nodeMap.get(e.toNodeId)
      if (a && b && isCheckable(a) && isCheckable(b)) {
        pairs.push([a, b])
      }
    }
    if (pairs.length > 0) return pairs
  }

  // Fall back to consecutive pairs
  const checkable = nodes.filter(isCheckable)
  for (let i = 0; i < checkable.length - 1; i++) {
    const a = checkable[i]
    const b = checkable[i + 1]
    if (a && b) pairs.push([a, b])
  }
  return pairs
}

function sectionSeverity(issues: ContinuityIssue[]): CheckSeverity {
  if (issues.some((i) => i.severity === 'risk')) return 'risk'
  if (issues.some((i) => i.severity === 'warn')) return 'warn'
  if (issues.some((i) => i.severity === 'info')) return 'info'
  return 'pass'
}

// ── Check: Characters ─────────────────────────────────────────────────

const CHAR_RE = /女孩|女人|老太|男孩|男人|老头|老人|孩子|机器人|士兵|演员|女主|男主|主角|人物|角色|girl|boy|woman|man|character/i
const FEMALE_RE = /女孩|女人|老太|女主|女性/i
const MALE_RE = /男孩|男人|老头|男主|男性/i

function checkCharacters(pairs: Array<[ContNode, ContNode]>): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  let c = 0

  for (const [a, b] of pairs) {
    const ta = getNodeText(a)
    const tb = getNodeText(b)
    const hasCharA = CHAR_RE.test(ta)
    const hasCharB = CHAR_RE.test(tb)

    if (hasCharA && !hasCharB && tb.trim().length > 8) {
      issues.push({
        id: `char-${c++}-missing`,
        severity: 'info',
        category: 'characters',
        title: '后续节点未见角色描述',
        description: `「${nodeLabel(a)}」包含角色词汇，但「${nodeLabel(b)}」中未发现角色相关描述。`,
        affectedNodeIds: [b.id],
        suggestion: '如需保持角色连贯，建议在后续节点描述中加入角色标识词。',
        canJumpToNode: true,
      })
    }

    const femaleOnlyA = FEMALE_RE.test(ta) && !MALE_RE.test(ta)
    const maleOnlyA = MALE_RE.test(ta) && !FEMALE_RE.test(ta)
    const femaleOnlyB = FEMALE_RE.test(tb) && !MALE_RE.test(tb)
    const maleOnlyB = MALE_RE.test(tb) && !FEMALE_RE.test(tb)

    if ((femaleOnlyA && maleOnlyB) || (maleOnlyA && femaleOnlyB)) {
      issues.push({
        id: `char-${c++}-gender`,
        severity: 'warn',
        category: 'characters',
        title: '角色性别描述不一致',
        description: `「${nodeLabel(a)}」与「${nodeLabel(b)}」的角色性别指向不同，若无场景切换说明可能引起歧义。`,
        affectedNodeIds: [a.id, b.id],
        suggestion: '确认是否为不同角色或补充场景转换说明。',
        canJumpToNode: true,
      })
    }
  }

  return issues
}

// ── Check: Location ───────────────────────────────────────────────────

const TRANSITION_RE = /转场|切换|来到|走进|离开|跳切|叠化|fade|transition/i

function getLocationCategory(text: string): Set<string> {
  const s = new Set<string>()
  if (/森林|海边|海滩|沙滩|山|草原|河流|湖泊|沙漠|荒野|丛林|自然|户外/i.test(text)) s.add('outdoor-nature')
  if (/城市|街道|广场|楼|建筑|商场|马路|工厂|都市|市区/i.test(text)) s.add('urban')
  if (/室内|房间|客厅|卧室|厨房|实验室|医院|地下|洞穴|内部/i.test(text)) s.add('indoor')
  if (/宇宙|太空|星球|星际|星空/i.test(text)) s.add('space')
  if (/战场|废墟|战区|战壕|轰炸|战争现场/i.test(text)) s.add('battlefield')
  return s
}

function checkLocation(pairs: Array<[ContNode, ContNode]>): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  let c = 0

  for (const [a, b] of pairs) {
    const ta = getNodeText(a)
    const tb = getNodeText(b)
    const catsA = getLocationCategory(ta)
    const catsB = getLocationCategory(tb)

    if (catsA.size === 0 || catsB.size === 0) continue

    const overlap = [...catsA].some((cat) => catsB.has(cat))
    if (!overlap && !TRANSITION_RE.test(ta) && !TRANSITION_RE.test(tb)) {
      issues.push({
        id: `loc-${c++}`,
        severity: 'warn',
        category: 'location',
        title: '场景/地点可能不一致',
        description: `「${nodeLabel(a)}」与「${nodeLabel(b)}」的场景类型差异明显，且未发现转场说明词汇。`,
        affectedNodeIds: [a.id, b.id],
        suggestion: '如为不同场景，建议补充"转场/来到/切换"等过渡说明，或检查是否需要插入转场节点。',
        canJumpToNode: true,
      })
    }
  }

  return issues
}

// ── Check: Timeline ───────────────────────────────────────────────────

const DAY_RE = /白天|清晨|日出|正午|午后|上午|下午|阳光/i
const NIGHT_RE = /夜晚|深夜|午夜|凌晨|夜间|黑夜|黄昏/i

function getTimeOfDay(text: string): 'day' | 'night' | null {
  if (DAY_RE.test(text)) return 'day'
  if (NIGHT_RE.test(text)) return 'night'
  return null
}

function checkTimeline(pairs: Array<[ContNode, ContNode]>): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  let c = 0

  for (const [a, b] of pairs) {
    const ta = getNodeText(a)
    const tb = getNodeText(b)
    const timeA = getTimeOfDay(ta)
    const timeB = getTimeOfDay(tb)

    if (timeA && timeB && timeA !== timeB && !TRANSITION_RE.test(ta) && !TRANSITION_RE.test(tb)) {
      issues.push({
        id: `time-${c++}`,
        severity: 'info',
        category: 'timeline',
        title: '昼夜时段发生变化',
        description: `「${nodeLabel(a)}」为${timeA === 'day' ? '白天' : '夜晚'}场景，「${nodeLabel(b)}」切换为${timeB === 'day' ? '白天' : '夜晚'}，但未发现时间过渡说明。`,
        affectedNodeIds: [a.id, b.id],
        suggestion: '若为时间跳转，建议补充时间说明词或插入说明节点；若为连续拍摄，请确认是否合理。',
        canJumpToNode: true,
      })
    }
  }

  return issues
}

// ── Check: Style / Tone ───────────────────────────────────────────────

const STYLE_GROUPS: Array<[RegExp, string]> = [
  [/暖色|暖调|金色调|橙色调|日系暖/i, 'warm'],
  [/冷色|冷调|蓝调|冷峻|冰蓝/i, 'cool'],
  [/黑白|单色|去色|monochrome/i, 'bw'],
  [/霓虹|赛博朋克|cyberpunk|neon/i, 'neon'],
  [/胶片|电影感|cinematic|film grain/i, 'film'],
  [/动漫|卡通|anime|cartoon|二次元/i, 'anime'],
  [/写实|照片级|photorealistic|realistic/i, 'realism'],
  [/水彩|油画|素描|插画|手绘/i, 'illustration'],
  [/废墟风|末世|后启示录|apocalyptic/i, 'postapoc'],
  [/梦幻|奇幻|fantasy|仙境/i, 'fantasy'],
]

function getStyles(text: string): Set<string> {
  const s = new Set<string>()
  for (const [re, name] of STYLE_GROUPS) {
    if (re.test(text)) s.add(name)
  }
  return s
}

function checkStyle(nodes: ContNode[]): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  const checkable = nodes.filter(isCheckable)
  if (checkable.length < 2) return issues

  const stylesPerNode = checkable.map((n) => ({ node: n, styles: getStyles(getNodeText(n)) }))
  const hasStyleDefs = stylesPerNode.filter((s) => s.styles.size > 0)
  if (hasStyleDefs.length < 2) return issues

  const allStyles = new Set<string>()
  for (const { styles } of hasStyleDefs) {
    for (const s of styles) allStyles.add(s)
  }

  // If more than 2 distinct style groups are spread across nodes → WARN
  if (allStyles.size >= 3) {
    const styleNodeMap = new Map<string, string[]>()
    for (const { node, styles } of hasStyleDefs) {
      for (const s of styles) {
        if (!styleNodeMap.has(s)) styleNodeMap.set(s, [])
        styleNodeMap.get(s)!.push(node.id)
      }
    }
    const conflictingStyles = [...allStyles].join('、')
    issues.push({
      id: 'style-drift',
      severity: 'warn',
      category: 'style',
      title: '风格/色调多样性偏高',
      description: `画布节点中检测到 ${allStyles.size} 种不同视觉风格（${conflictingStyles}），可能影响整体视觉一致性。`,
      affectedNodeIds: hasStyleDefs.map((s) => s.node.id),
      suggestion: '建议统一主基调，或为风格切换节点添加明确说明。',
      canJumpToNode: true,
    })
  } else {
    // Check pairwise style conflict
    for (let i = 0; i < hasStyleDefs.length - 1; i++) {
      const a = hasStyleDefs[i]
      const b = hasStyleDefs[i + 1]
      if (!a || !b) continue
      const overlap = [...a.styles].some((s) => b.styles.has(s))
      if (!overlap && a.styles.size > 0 && b.styles.size > 0) {
        issues.push({
          id: `style-pair-${i}`,
          severity: 'info',
          category: 'style',
          title: '相邻节点视觉风格不同',
          description: `「${nodeLabel(a.node)}」与「${nodeLabel(b.node)}」的视觉风格描述无重叠。`,
          affectedNodeIds: [a.node.id, b.node.id],
          suggestion: '可接受，但建议确认整体视觉一致性是否符合预期。',
          canJumpToNode: true,
        })
      }
    }
  }

  return issues
}

// ── Check: Shot Language ──────────────────────────────────────────────

const SHOT_SIZES: Array<[RegExp, string]> = [
  [/全景|远景|wide shot|establishing/i, 'wide'],
  [/中景|medium shot/i, 'medium'],
  [/近景|close shot(?! up)/i, 'close'],
  [/特写|close.?up|极近/i, 'extreme-close'],
]

function getShotSize(text: string): string | null {
  for (const [re, size] of SHOT_SIZES) {
    if (re.test(text)) return size
  }
  return null
}

function checkShotLanguage(nodes: ContNode[]): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  const checkable = nodes.filter(isCheckable)
  const sized = checkable
    .map((n) => ({ node: n, size: getShotSize(getNodeText(n)) }))
    .filter((s) => s.size !== null)

  if (sized.length < 3) return issues

  // Detect runs of same shot size (3+ in a row)
  let runStart = 0
  for (let i = 1; i < sized.length; i++) {
    const prev = sized[i - 1]
    const curr = sized[i]
    if (!prev || !curr) continue
    if (curr.size !== prev.size) {
      runStart = i
    } else {
      const runLength = i - runStart + 1
      if (runLength === 3) {
        issues.push({
          id: `shot-run-${i}`,
          severity: 'info',
          category: 'shotLanguage',
          title: '镜头景别可能单调',
          description: `连续 ${runLength} 个节点均为「${curr.size === 'wide' ? '全景' : curr.size === 'medium' ? '中景' : curr.size === 'close' ? '近景' : '特写'}」，节奏可能偏单一。`,
          affectedNodeIds: sized.slice(runStart, i + 1).map((s) => s.node.id),
          suggestion: '建议适当变换景别以增加视觉节奏，如全景→中景→特写的经典结构。',
          canJumpToNode: true,
        })
      }
    }
  }

  return issues
}

// ── Check: Asset Health ───────────────────────────────────────────────

function checkAssetHealth(nodes: ContNode[]): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []

  for (const node of nodes) {
    if (!isCheckable(node)) continue
    const meta = safeObj(node.metadataJson)
    const errorCode = safeStr(meta['errorCode'])

    if (node.status === 'error' || node.status === 'failed' || errorCode) {
      issues.push({
        id: `asset-error-${node.id}`,
        severity: 'risk',
        category: 'assetHealth',
        title: '节点生成失败',
        description: `「${nodeLabel(node)}」处于错误状态${errorCode ? `（${errorCode}）` : ''}，该节点的内容可能无法参与后续流程。`,
        affectedNodeIds: [node.id],
        suggestion: '建议检查节点生成原因并重新生成，或创建替代节点。',
        canJumpToNode: true,
      })
    } else if (
      node.status === 'done' &&
      !node.assetId &&
      !node.resultImageUrl &&
      !node.resultVideoUrl &&
      !node.resultText
    ) {
      issues.push({
        id: `asset-done-nourl-${node.id}`,
        severity: 'warn',
        category: 'assetHealth',
        title: '节点已完成但无输出内容',
        description: `「${nodeLabel(node)}」状态为 done，但未找到输出 URL 或文本内容。`,
        affectedNodeIds: [node.id],
        suggestion: '建议重新生成该节点或检查资产链路是否正常。',
        canJumpToNode: true,
      })
    } else if (
      (node.kind === 'image' || node.kind === 'video') &&
      node.status === 'done' &&
      !node.assetId
    ) {
      issues.push({
        id: `asset-no-id-${node.id}`,
        severity: 'info',
        category: 'assetHealth',
        title: '节点缺少资产 ID',
        description: `「${nodeLabel(node)}」已生成结果，但未关联 assetId，历史记录可能无法恢复。`,
        affectedNodeIds: [node.id],
        suggestion: '资产 ID 缺失通常不影响当前使用，但历史检索和导出时可能有限制。',
        canJumpToNode: true,
      })
    }
  }

  return issues
}

// ── Overall score ─────────────────────────────────────────────────────

function calcScore(issues: ContinuityIssue[]): number {
  let score = 100
  for (const issue of issues) {
    if (issue.severity === 'risk') score -= 20
    else if (issue.severity === 'warn') score -= 10
    else if (issue.severity === 'info') score -= 3
  }
  return Math.max(0, Math.round(score))
}

function scoreSummary(score: number): string {
  if (score >= 85) return '连贯性良好，未发现明显冲突。'
  if (score >= 70) return '整体连贯，有少量需关注的地方。'
  if (score >= 50) return '存在一些连贯性问题，建议检查标注节点。'
  return '连贯性风险较高，建议仔细检查各分类问题。'
}

function makeSections(
  issueMap: Record<ContinuityIssue['category'], ContinuityIssue[]>,
): ContinuitySection[] {
  const defs: Array<[ContinuityIssue['category'], string]> = [
    ['characters', '角色一致性'],
    ['location', '场景 / 地点'],
    ['timeline', '时间线'],
    ['style', '风格 / 色调'],
    ['shotLanguage', '镜头语言'],
    ['assetHealth', '资产状态'],
  ]

  return defs.map(([category, label]) => {
    const issues = issueMap[category] ?? []
    const sev = sectionSeverity(issues)
    return {
      category,
      label,
      severity: sev,
      issueCount: issues.length,
      summary: issues.length === 0 ? '未发现明显问题' : `发现 ${issues.length} 个需关注项`,
    }
  })
}

// ── Main entry point ──────────────────────────────────────────────────

export function analyzeContinuity(nodes: ContNode[], edges: ContEdge[]): ContinuityReport {
  const checkable = nodes.filter(isCheckable)

  if (checkable.length < 2) {
    return {
      totalNodesChecked: checkable.length,
      overallScore: 100,
      summary: '节点数量不足，无法进行连贯性分析。',
      passCount: 0,
      warnCount: 0,
      riskCount: 0,
      infoCount: 0,
      sections: [],
      issues: [],
      generatedAt: Date.now(),
    }
  }

  const pairs = getCheckPairs(nodes, edges)

  const charIssues = checkCharacters(pairs)
  const locIssues = checkLocation(pairs)
  const timeIssues = checkTimeline(pairs)
  const styleIssues = checkStyle(nodes)
  const shotIssues = checkShotLanguage(nodes)
  const assetIssues = checkAssetHealth(nodes)

  const issueMap: Record<ContinuityIssue['category'], ContinuityIssue[]> = {
    characters: charIssues,
    location: locIssues,
    timeline: timeIssues,
    style: styleIssues,
    shotLanguage: shotIssues,
    assetHealth: assetIssues,
  }

  const allIssues = [
    ...charIssues, ...locIssues, ...timeIssues,
    ...styleIssues, ...shotIssues, ...assetIssues,
  ]

  const score = calcScore(allIssues)

  return {
    totalNodesChecked: checkable.length,
    overallScore: score,
    summary: scoreSummary(score),
    passCount: allIssues.filter((i) => i.severity === 'pass').length,
    warnCount: allIssues.filter((i) => i.severity === 'warn').length,
    riskCount: allIssues.filter((i) => i.severity === 'risk').length,
    infoCount: allIssues.filter((i) => i.severity === 'info').length,
    sections: makeSections(issueMap),
    issues: allIssues,
    generatedAt: Date.now(),
  }
}

// ── Text report for clipboard ─────────────────────────────────────────

const SEVERITY_LABEL: Record<CheckSeverity, string> = {
  pass: 'PASS',
  info: 'INFO',
  warn: 'WARN',
  risk: 'RISK',
}

export function buildContinuityReportText(report: ContinuityReport): string {
  const lines = [
    '=== 连贯性检查报告 — Creator City ===',
    `检查时间：${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
    `综合评分：${report.overallScore}/100`,
    `检查节点数：${report.totalNodesChecked}`,
    `问题统计：WARN ${report.warnCount} / RISK ${report.riskCount} / INFO ${report.infoCount}`,
    `总结：${report.summary}`,
    '',
    '── 分类摘要 ──',
  ]

  for (const sec of report.sections) {
    lines.push(`${sec.label}：${SEVERITY_LABEL[sec.severity]} — ${sec.summary}`)
  }

  if (report.issues.length > 0) {
    lines.push('', '── 问题详情 ──')
    for (const issue of report.issues) {
      lines.push(`[${SEVERITY_LABEL[issue.severity]}] ${issue.title}`)
      lines.push(`  描述：${issue.description}`)
      lines.push(`  建议：${issue.suggestion}`)
      lines.push('')
    }
  }

  lines.push('备注：本报告由 Creator City Continuity Checker 生成，只读分析，不自动生成，不消耗 credits。')
  return lines.join('\n')
}
