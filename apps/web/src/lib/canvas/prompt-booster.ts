// Pure rules engine for single-node prompt quality analysis.
// No API calls, no generation, no credits consumed.

export type PromptBoostCheckStatus = 'pass' | 'warn' | 'missing'
export type PromptBoostSeverity = 'important' | 'useful' | 'optional'

export interface PromptBoostCheck {
  id: string
  status: PromptBoostCheckStatus
  label: string
  description: string
}

export interface PromptBoostSuggestion {
  id: string
  title: string
  reason: string
  appendText: string
  category: string
  suitableFor: Array<'text' | 'image' | 'video'>
  severity: PromptBoostSeverity
}

export interface PromptBoostInput {
  kind: 'text' | 'image' | 'video'
  prompt: string
  providerId?: string | null
  model?: string | null
}

export interface PromptBoostReport {
  score: number
  summary: string
  checks: PromptBoostCheck[]
  suggestions: PromptBoostSuggestion[]
}

// Minimal node shape needed for panel
export interface PromptBoostNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  providerId?: string | null
  model?: string | null
  status?: string | null
  metadataJson?: unknown
}

// ── Helpers ──────────────────────────────────────────────────────────

function pass(id: string, label: string, description: string): PromptBoostCheck {
  return { id, status: 'pass', label, description }
}
function warn(id: string, label: string, description: string): PromptBoostCheck {
  return { id, status: 'warn', label, description }
}
function missing(id: string, label: string, description: string): PromptBoostCheck {
  return { id, status: 'missing', label, description }
}

// ── Image checks ──────────────────────────────────────────────────────

const SUBJECT_RE = /人物|女|男|孩子|主角|角色|物品|产品|动物|猫|狗|机器人|person|woman|man|girl|boy|figure|object|product|animal|robot|character/i
const SCENE_RE = /室内|户外|城市|森林|海边|海滩|沙滩|街道|咖啡|宇宙|太空|荒野|废墟|沙漠|公园|草原|indoor|outdoor|city|forest|beach|street|space|desert|studio|urban|park/i
const FRAMING_RE = /全景|中景|近景|特写|远景|构图|黄金比例|wide.?shot|medium.?shot|close.?up|extreme.?close|establishing|portrait|landscape|centered|overhead|rule.?of.?thirds/i
const LIGHTING_RE = /自然光|逆光|黄昏|日出|阳光|霓虹|柔光|强光|侧光|顶光|暗光|golden.?hour|natural.?light|backlight|neon|soft.?light|hard.?light|rim.?light|studio.?light/i
const STYLE_RE = /暖色|冷色|电影感|写实|胶片|赛博朋克|动漫|卡通|黑白|水彩|油画|warm|cool|cinematic|realistic|film.?grain|cyberpunk|anime|cartoon|monochrome|watercolor|photorealistic/i
const QUALITY_RE = /4k|8k|high.?res|high.?quality|ultra.?detail|sharp|crisp|film.?grain|clean.?detail|professional|masterpiece|best.?quality|hdr|photorealistic/i
const NEGATIVE_RE = /negative|avoid|no.blurr|no.distort|no.watermark|without|不要|避免|低质量|变形|水印|deform|ugly|watermark/i

const ACTION_RE = /走动|跑步|转身|跳跃|推进|移动|说话|行走|运动|飞翔|挥手|walking|running|turning|jumping|moving|speaking|flying|action|motion|gesture/i
const CAMERA_RE = /推镜|拉镜|横移|平移|跟随|固定|摇镜|升降|push.?in|pull.?out|dolly|pan|tracking|static|tilt|crane|handheld|zoom/i
const PACING_RE = /慢节奏|快节奏|5秒|10秒|slow|fast|cinematic.?pacing|smooth|5s|10s|duration|gradually/i
const CONTINUITY_RE = /保持|连续|一致|延续|同样|同一|maintain|consistent|same.?character|same.?style|continuous/i
const VID_NEG_RE = /no.?flicker|no.?morph|stable.?motion|smooth.?motion|no.?jitter|avoid.?blur|no.?shake/i

const FORMAT_RE = /脚本|分镜|广告|文案|旁白|标题|简介|摘要|列表|帖子|script|storyboard|ad.?copy|narration|title|caption|summary|outline|post/i
const AUDIENCE_RE = /小红书|抖音|TikTok|YouTube|Instagram|微博|广告|用户|受众|观众|读者|audience|viewer|reader|platform/i
const TONE_RE = /专业|正式|轻松|幽默|创意|温暖|严肃|活泼|感性|理性|professional|formal|casual|humorous|creative|warm|serious|engaging|playful/i
const STRUCTURE_RE = /列表|三幕|结构|开头|结尾|shot.?list|numbered|outline|three.?act|structured|段落|sections/i
const LENGTH_RE = /字|个字|words|chars|sentences|paragraphs|简短|详细|brief|detailed|约.*字|限.*字|100|200|300|500|1000/i

function checkSubject(t: string, prefix: string, kind: 'image' | 'video'): PromptBoostCheck {
  const id = `${prefix}-subject`
  if (SUBJECT_RE.test(t)) return pass(id, '画面主体', '已包含主体描述（人物/物体等）。')
  if (kind === 'image') return missing(id, '画面主体', '未发现明确主体描述，建议补充人物/物体/动物等核心主体。')
  return missing(id, '画面主体', '未发现明确主体描述，视频主体不明确时生成结果可控性低。')
}

function checkScene(t: string, prefix: string): PromptBoostCheck {
  const id = `${prefix}-scene`
  if (SCENE_RE.test(t)) return pass(id, '场景/环境', '已包含场景或环境描述。')
  return warn(id, '场景/环境', '未发现场景/地点描述，画面背景可能随机生成。')
}

function checkFraming(t: string): PromptBoostCheck {
  if (FRAMING_RE.test(t)) return pass('img-framing', '构图/景别', '已包含景别或构图词汇。')
  return warn('img-framing', '构图/景别', '未发现构图/景别描述，取景方式可能不可控。')
}

function checkLighting(t: string): PromptBoostCheck {
  if (LIGHTING_RE.test(t)) return pass('img-lighting', '光线描述', '已包含光线描述。')
  return warn('img-lighting', '光线描述', '未发现光线描述，光效氛围可能不稳定。')
}

function checkStyle(t: string): PromptBoostCheck {
  if (STYLE_RE.test(t)) return pass('img-style', '色调/风格', '已包含视觉风格或色调描述。')
  return warn('img-style', '色调/风格', '未发现风格词汇，生成图片整体色调可能不一致。')
}

function checkQuality(t: string): PromptBoostCheck {
  if (QUALITY_RE.test(t)) return pass('img-quality', '质量/质感', '已包含质量描述词汇。')
  return missing('img-quality', '质量/质感', '未发现质量控制词（4K/photorealistic等），建议补充以提升细节表现。')
}

function checkNegativeImage(t: string): PromptBoostCheck {
  if (NEGATIVE_RE.test(t)) return pass('img-negative', '负向约束', '已包含负向约束描述。')
  return missing('img-negative', '负向约束', '未发现负向约束（avoid blur/no watermark等），可补充以减少生成缺陷。')
}

// ── Video-specific checks ─────────────────────────────────────────────

function checkAction(t: string): PromptBoostCheck {
  if (ACTION_RE.test(t)) return pass('vid-action', '主体动作', '已包含动作描述。')
  return warn('vid-action', '主体动作', '未发现动作描述（走动/转身/推进等），视频主体可能静止。')
}

function checkCamera(t: string): PromptBoostCheck {
  if (CAMERA_RE.test(t)) return pass('vid-camera', '运镜描述', '已包含运镜描述。')
  return missing('vid-camera', '运镜描述', '未发现运镜词汇（push in/dolly/pan等），运镜方式可能随机。')
}

function checkPacing(t: string): PromptBoostCheck {
  if (PACING_RE.test(t)) return pass('vid-pacing', '时长/节奏', '已包含节奏或时长描述。')
  return warn('vid-pacing', '时长/节奏', '未发现节奏/时长关键词，视频整体节奏可能不可控。')
}

function checkContinuity(t: string): PromptBoostCheck {
  if (CONTINUITY_RE.test(t)) return pass('vid-continuity', '连续性说明', '已包含连续性/一致性描述。')
  return warn('vid-continuity', '连续性说明', '如需保持角色/风格一致，建议补充连续性说明。')
}

function checkNegativeVideo(t: string): PromptBoostCheck {
  if (VID_NEG_RE.test(t)) return pass('vid-negative', '负向约束', '已包含视频负向约束。')
  return missing('vid-negative', '负向约束', '未发现视频负向约束，建议补充以减少闪烁和画面抖动。')
}

// ── Text-node checks ──────────────────────────────────────────────────

function checkTopic(t: string): PromptBoostCheck {
  const len = t.trim().length
  if (len >= 25) return pass('txt-topic', '主题明确', 'Prompt 长度充足，主题可识别。')
  if (len >= 8) return warn('txt-topic', '主题明确', 'Prompt 较短，主题可能不够清晰，建议补充背景信息。')
  return missing('txt-topic', '主题明确', 'Prompt 太短，AI 无法判断主题意图。')
}

function checkFormat(t: string): PromptBoostCheck {
  if (FORMAT_RE.test(t)) return pass('txt-format', '目标格式', '已明确输出格式（脚本/文案/标题等）。')
  return warn('txt-format', '目标格式', '未明确输出格式，AI 可能产出任意格式内容。')
}

function checkAudience(t: string): PromptBoostCheck {
  if (AUDIENCE_RE.test(t)) return pass('txt-audience', '受众/平台', '已包含受众或平台说明。')
  return warn('txt-audience', '受众/平台', '未指定受众或平台，内容风格可能偏通用。')
}

function checkTone(t: string): PromptBoostCheck {
  if (TONE_RE.test(t)) return pass('txt-tone', '语气/风格', '已包含语气或风格描述。')
  return warn('txt-tone', '语气/风格', '未指定语气/风格，输出语调可能不符合预期。')
}

function checkStructure(t: string): PromptBoostCheck {
  if (STRUCTURE_RE.test(t)) return pass('txt-structure', '输出结构', '已包含结构要求说明。')
  return warn('txt-structure', '输出结构', '未指定输出结构（列表/段落/三幕等），可能影响可读性。')
}

function checkLength(t: string): PromptBoostCheck {
  if (LENGTH_RE.test(t)) return pass('txt-length', '长度约束', '已包含长度或详略要求。')
  return warn('txt-length', '长度约束', '未指定输出长度，AI 可能产出过长或过短的内容。')
}

// ── Score ─────────────────────────────────────────────────────────────

function calcScore(checks: PromptBoostCheck[]): number {
  let score = 100
  for (const c of checks) {
    if (c.status === 'missing') score -= 15
    else if (c.status === 'warn') score -= 8
  }
  return Math.max(0, Math.round(score))
}

function scoreSummary(score: number): string {
  if (score >= 80) return 'Prompt 结构较完整，可直接生成。'
  if (score >= 50) return '建议补充关键描述后再生成，可提升生成稳定性。'
  return '缺少多项关键描述，生成质量可能不稳定，建议先增强 Prompt。'
}

// ── Suggestions ───────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<PromptBoostSeverity, number> = { important: 0, useful: 1, optional: 2 }

function buildSuggestions(checks: PromptBoostCheck[]): PromptBoostSuggestion[] {
  const suggs: PromptBoostSuggestion[] = []

  for (const check of checks) {
    if (check.status === 'pass') continue

    switch (check.id) {
      case 'img-subject':
        suggs.push({ id: 'sugg-img-subject', title: '补充画面主体', reason: '明确主体可显著提升生成一致性和可控性。', appendText: 'a person standing in the foreground, clear and detailed subject', category: 'subject', suitableFor: ['image'], severity: 'important' })
        break
      case 'vid-subject':
        suggs.push({ id: 'sugg-vid-subject', title: '补充画面主体', reason: '明确主体可控制视频主角的一致性。', appendText: 'a person as the main subject, clearly visible throughout the scene', category: 'subject', suitableFor: ['video'], severity: 'important' })
        break
      case 'img-scene':
        suggs.push({ id: 'sugg-img-scene', title: '补充场景/环境', reason: '明确场景背景可避免随机或混乱的背景。', appendText: 'in a modern urban environment, clear background with detailed setting', category: 'scene', suitableFor: ['image'], severity: 'useful' })
        break
      case 'vid-scene':
        suggs.push({ id: 'sugg-vid-scene', title: '补充场景/环境', reason: '明确场景可让视频背景更稳定和一致。', appendText: 'set in a realistic environment with clear background context', category: 'scene', suitableFor: ['video'], severity: 'useful' })
        break
      case 'img-framing':
        suggs.push({ id: 'sugg-img-framing', title: '补充构图/景别', reason: '景别描述可控制取景范围，避免随机构图。', appendText: 'medium shot, centered composition, rule of thirds', category: 'framing', suitableFor: ['image'], severity: 'useful' })
        break
      case 'img-lighting':
        suggs.push({ id: 'sugg-img-lighting', title: '补充光线描述', reason: '光线是决定氛围的关键因素，缺少时光效难以预测。', appendText: 'cinematic lighting, soft natural light, golden hour atmosphere', category: 'lighting', suitableFor: ['image'], severity: 'useful' })
        break
      case 'img-style':
        suggs.push({ id: 'sugg-img-style', title: '补充视觉风格', reason: '风格词汇可锁定整体色调和视觉基调。', appendText: 'cinematic, photorealistic, warm tone, film grain texture', category: 'style', suitableFor: ['image'], severity: 'useful' })
        break
      case 'img-quality':
        suggs.push({ id: 'sugg-img-quality', title: '补充质量描述', reason: '质量关键词可提升细节表现和锐利度。', appendText: 'high quality, 4k, sharp details, professional photography', category: 'quality', suitableFor: ['image'], severity: 'optional' })
        break
      case 'img-negative':
        suggs.push({ id: 'sugg-img-negative', title: '补充负向约束', reason: '负向约束可减少变形、水印和低质量输出。', appendText: 'avoid blur, no distortion, no watermark, clean composition', category: 'negative', suitableFor: ['image'], severity: 'optional' })
        break
      case 'vid-action':
        suggs.push({ id: 'sugg-vid-action', title: '补充主体动作', reason: '动作描述可让视频内容更生动，避免静态画面。', appendText: 'natural walking motion, smooth movement, subtle gestures', category: 'action', suitableFor: ['video'], severity: 'useful' })
        break
      case 'vid-camera':
        suggs.push({ id: 'sugg-vid-camera', title: '补充运镜描述', reason: '运镜词汇可控制镜头运动方式，提升电影感。', appendText: 'slow dolly in, stable camera movement, cinematic pacing', category: 'camera', suitableFor: ['video'], severity: 'important' })
        break
      case 'vid-pacing':
        suggs.push({ id: 'sugg-vid-pacing', title: '补充节奏描述', reason: '节奏描述可控制视频的整体快慢感和时长预期。', appendText: 'slow cinematic pacing, smooth transitions, 5 seconds duration', category: 'pacing', suitableFor: ['video'], severity: 'useful' })
        break
      case 'vid-continuity':
        suggs.push({ id: 'sugg-vid-continuity', title: '补充连续性说明', reason: '如需与上游节点保持一致，建议明确说明。', appendText: 'maintain consistent visual style, same character appearance throughout', category: 'continuity', suitableFor: ['video'], severity: 'optional' })
        break
      case 'vid-negative':
        suggs.push({ id: 'sugg-vid-negative', title: '补充视频负向约束', reason: '负向约束可减少视频闪烁、变形和画面抖动。', appendText: 'no flicker, stable motion, no morphing, smooth camera movement', category: 'negative', suitableFor: ['video'], severity: 'optional' })
        break
      case 'txt-topic':
        suggs.push({ id: 'sugg-txt-topic', title: '补充主题背景', reason: '充足的背景说明可帮助 AI 更准确理解创作意图。', appendText: '请根据以上背景创作内容，确保主题聚焦、逻辑清晰。', category: 'topic', suitableFor: ['text'], severity: 'important' })
        break
      case 'txt-format':
        suggs.push({ id: 'sugg-txt-format', title: '指定输出格式', reason: '明确格式可减少 AI 自由发挥，确保输出可用性。', appendText: '请以脚本形式输出，每段标注镜头序号和画面描述。', category: 'format', suitableFor: ['text'], severity: 'useful' })
        break
      case 'txt-audience':
        suggs.push({ id: 'sugg-txt-audience', title: '指定受众/平台', reason: '受众/平台信息可帮助 AI 选择合适的语气和内容风格。', appendText: '面向小红书/短视频平台受众，语言简洁有感染力。', category: 'audience', suitableFor: ['text'], severity: 'useful' })
        break
      case 'txt-tone':
        suggs.push({ id: 'sugg-txt-tone', title: '指定语气/风格', reason: '语气描述可确保内容符合品牌调性和场景需要。', appendText: '语气专业且亲切，创意感强，避免过于正式。', category: 'tone', suitableFor: ['text'], severity: 'useful' })
        break
      case 'txt-structure':
        suggs.push({ id: 'sugg-txt-structure', title: '指定输出结构', reason: '结构化要求可让输出更易阅读和使用。', appendText: '请分段输出，包含开头（钩子）、主体（核心内容）、结尾（行动号召）三部分。', category: 'structure', suitableFor: ['text'], severity: 'optional' })
        break
      case 'txt-length':
        suggs.push({ id: 'sugg-txt-length', title: '指定长度约束', reason: '长度约束可防止输出过长或过短，提升可用性。', appendText: '总字数控制在 200-300 字，简洁有力。', category: 'length', suitableFor: ['text'], severity: 'optional' })
        break
    }
  }

  suggs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return suggs
}

// ── Main entry point ──────────────────────────────────────────────────

export function analyzePromptBoost(input: PromptBoostInput): PromptBoostReport {
  const t = input.prompt.trim()
  let checks: PromptBoostCheck[]

  if (input.kind === 'image') {
    checks = [
      checkSubject(t, 'img', 'image'),
      checkScene(t, 'img'),
      checkFraming(t),
      checkLighting(t),
      checkStyle(t),
      checkQuality(t),
      checkNegativeImage(t),
    ]
  } else if (input.kind === 'video') {
    checks = [
      checkSubject(t, 'vid', 'video'),
      checkScene(t, 'vid'),
      checkAction(t),
      checkCamera(t),
      checkPacing(t),
      checkContinuity(t),
      checkNegativeVideo(t),
    ]
  } else {
    checks = [
      checkTopic(t),
      checkFormat(t),
      checkAudience(t),
      checkTone(t),
      checkStructure(t),
      checkLength(t),
    ]
  }

  const score = calcScore(checks)
  return {
    score,
    summary: scoreSummary(score),
    checks,
    suggestions: buildSuggestions(checks),
  }
}

// ── Clipboard report ──────────────────────────────────────────────────

const STATUS_LABEL: Record<PromptBoostCheckStatus, string> = {
  pass: 'PASS',
  warn: 'WARN',
  missing: 'MISSING',
}

const KIND_LABEL: Record<string, string> = {
  image: '图片节点',
  video: '视频节点',
  text: '文本节点',
}

export function buildPromptBoostReportText(
  report: PromptBoostReport,
  promptPreview: string,
  kind: string,
): string {
  const lines = [
    '=== Prompt 增强检查报告 — Creator City ===',
    `节点类型：${KIND_LABEL[kind] ?? kind}`,
    `Prompt 完整度评分：${report.score}/100`,
    `总结：${report.summary}`,
    `Prompt 摘要：${promptPreview.slice(0, 120)}${promptPreview.length > 120 ? '…' : ''}`,
    '',
    '── 检查清单 ──',
  ]
  for (const c of report.checks) {
    lines.push(`[${STATUS_LABEL[c.status]}] ${c.label}：${c.description}`)
  }
  if (report.suggestions.length > 0) {
    lines.push('', '── 增强建议 ──')
    for (const s of report.suggestions) {
      lines.push(`【${s.title}】（${s.severity === 'important' ? '重要' : s.severity === 'useful' ? '建议' : '可选'}）`)
      lines.push(`  理由：${s.reason}`)
      lines.push(`  建议追加：${s.appendText}`)
      lines.push('')
    }
  }
  lines.push('备注：本报告由 Creator City Prompt Booster 生成，只读分析，不自动生成，不消耗 credits。')
  return lines.join('\n')
}

// ── Node helpers ──────────────────────────────────────────────────────

export function getBoostPromptText(node: PromptBoostNode): string {
  return node.prompt?.trim() || node.resultText?.trim() || ''
}

export function isBoostableNode(node: PromptBoostNode): boolean {
  return (
    (node.kind === 'text' || node.kind === 'image' || node.kind === 'video') &&
    Boolean(node.prompt?.trim() || node.resultText?.trim())
  )
}

export function textAlreadyContains(currentPrompt: string, appendText: string): boolean {
  const sample = appendText.trim().slice(0, 28).toLowerCase()
  if (!sample) return false
  return currentPrompt.toLowerCase().includes(sample)
}
