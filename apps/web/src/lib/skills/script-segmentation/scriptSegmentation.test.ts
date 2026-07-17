/**
 * Public contract tests for the deterministic script-segmentation Skill.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/script-segmentation/scriptSegmentation.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getExecutableCreatorSkill, runCreatorSkill } from '..'
import type {
  CreatorSkillRunInput,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
} from '..'

type ScriptSceneDraft = {
  sceneId: string
  order: number
  heading: string
  location?: string
  timeOfDay?: string
  characters: string[]
  actionSummary: string
  sourceText: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
}

type SceneBreakdownPayload = {
  format: 'headed-script' | 'paragraph-fallback'
  scenes: ScriptSceneDraft[]
}

function textNode(
  prompt: string,
  overrides: Partial<CreatorSkillSourceNode> = {},
): CreatorSkillSourceNode {
  return {
    id: 'script-1',
    kind: 'text',
    title: 'Test script',
    prompt,
    ...overrides,
  }
}

function runWithText(
  prompt: string,
  overrides: Partial<CreatorSkillSourceNode> = {},
) {
  return runCreatorSkill('script-segmentation', {
    sourceNodes: [textNode(prompt, overrides)],
  })
}

function payloadOf(result: CreatorSkillRunResult) {
  assert.equal(result.artifacts.length, 1)
  return result.artifacts[0]!.payload as SceneBreakdownPayload
}

function assertBlockedWithoutOutput(result: CreatorSkillRunResult) {
  assert.equal(result.status, 'blocked')
  assert.deepEqual(result.artifacts, [])
  assert.deepEqual(result.evidence, [])
  assert.equal(result.blockers.length, 1)
  assert.ok(result.blockers[0]!.message.trim().length > 0)
}

describe('script-segmentation manifest', () => {
  test('is registered as the only independently executable Creator Skill', () => {
    const skill = getExecutableCreatorSkill('script-segmentation')

    assert.deepEqual(skill?.manifest, {
      id: 'script-segmentation',
      version: '1.0.0',
      name: '剧本分场',
      description: '将文本剧本拆分为可审核的场景结构',
      category: 'story',
      executionPolicy: 'deterministic-local',
      acceptedNodeKinds: ['text'],
      acceptedArtifactTypes: [],
      outputArtifactTypes: ['scene-breakdown'],
      independentlyCallable: true,
    })
  })
})

describe('script-segmentation headed scripts', () => {
  test('segments Chinese numbered headings and extracts explicit heading tokens', () => {
    const source = [
      '第一场 外景 城市街道 夜',
      '林夏冲入雨中。',
      '第2场 内景 车站 日',
      '林夏停在检票口。',
      '场景 3 外景 天台 黄昏',
      '风吹过栏杆。',
    ].join('\n')

    const result = runWithText(source)
    const payload = payloadOf(result)

    assert.equal(result.status, 'ready')
    assert.deepEqual(result.warnings, [])
    assert.equal(payload.format, 'headed-script')
    assert.deepEqual(payload.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      order: scene.order,
      heading: scene.heading,
      location: scene.location,
      timeOfDay: scene.timeOfDay,
      actionSummary: scene.actionSummary,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
    })), [
      {
        sceneId: 'scene-001',
        order: 1,
        heading: '第一场 外景 城市街道 夜',
        location: '城市街道',
        timeOfDay: '夜',
        actionSummary: '林夏冲入雨中。',
        lineStart: 1,
        lineEnd: 2,
      },
      {
        sceneId: 'scene-002',
        order: 2,
        heading: '第2场 内景 车站 日',
        location: '车站',
        timeOfDay: '日',
        actionSummary: '林夏停在检票口。',
        lineStart: 3,
        lineEnd: 4,
      },
      {
        sceneId: 'scene-003',
        order: 3,
        heading: '场景 3 外景 天台 黄昏',
        location: '天台',
        timeOfDay: '黄昏',
        actionSummary: '风吹过栏杆。',
        lineStart: 5,
        lineEnd: 6,
      },
    ])
  })

  test('recognizes Chinese headings that start with interior/exterior markers', () => {
    const result = runWithText([
      '外景 码头 深夜',
      '海浪拍打防波堤。',
      '内景 船舱 日',
      '机器低鸣。',
      '内外景 行驶中的巴士 傍晚',
      '城市灯光掠过车窗。',
    ].join('\n'))
    const payload = payloadOf(result)

    assert.equal(result.status, 'ready')
    assert.deepEqual(payload.scenes.map(({ location, timeOfDay }) => ({ location, timeOfDay })), [
      { location: '码头', timeOfDay: '深夜' },
      { location: '船舱', timeOfDay: '日' },
      { location: '行驶中的巴士', timeOfDay: '傍晚' },
    ])
  })

  test('recognizes case-insensitive English INT, EXT, INT/EXT, and I/E headings', () => {
    const result = runWithText([
      'ext. CITY STREET - NIGHT',
      'Rain floods the gutter.',
      'INT. STATION - DAY',
      'Commuters cross the hall.',
      'INT/EXT. MOVING CAR - DUSK',
      'Maya watches the skyline.',
      'I/E. TRAIN - DAWN',
      'The doors slide shut.',
    ].join('\n'))
    const payload = payloadOf(result)

    assert.equal(result.status, 'ready')
    assert.deepEqual(payload.scenes.map(({ heading, location, timeOfDay }) => ({
      heading,
      location,
      timeOfDay,
    })), [
      { heading: 'ext. CITY STREET - NIGHT', location: 'CITY STREET', timeOfDay: 'NIGHT' },
      { heading: 'INT. STATION - DAY', location: 'STATION', timeOfDay: 'DAY' },
      { heading: 'INT/EXT. MOVING CAR - DUSK', location: 'MOVING CAR', timeOfDay: 'DUSK' },
      { heading: 'I/E. TRAIN - DAWN', location: 'TRAIN', timeOfDay: 'DAWN' },
    ])
  })

  test('handles mixed Chinese and English headings without inventing missing tokens', () => {
    const result = runWithText([
      '第1场',
      '门在黑暗中打开。',
      'EXT. ROOFTOP - NIGHT',
      'Wind catches the loose paper.',
    ].join('\n'))
    const payload = payloadOf(result)

    assert.equal(result.status, 'ready')
    assert.equal(payload.scenes[0]!.location, undefined)
    assert.equal(payload.scenes[0]!.timeOfDay, undefined)
    assert.equal(payload.scenes[1]!.location, 'ROOFTOP')
    assert.equal(payload.scenes[1]!.timeOfDay, 'NIGHT')
  })

  test('accepts plausible cue formats and rejects transitions or uppercase action', () => {
    const cases: Array<{
      label: string
      body: string[]
      expectedCharacters: string[]
      expectedActionSummary?: string
    }> = [
      {
        label: 'Latin colon cue',
        body: ['MAYA: Hold the signal.'],
        expectedCharacters: ['MAYA'],
      },
      {
        label: 'Chinese colon cue',
        body: ['林夏：别回头。'],
        expectedCharacters: ['林夏'],
      },
      {
        label: 'first-seen deduplication',
        body: ['MAYA: Hold.', 'MAYA：Keep moving.'],
        expectedCharacters: ['MAYA'],
      },
      {
        label: 'Latin standalone cue with immediate dialogue',
        body: ['ALICE SMITH', 'Stay close.'],
        expectedCharacters: ['ALICE SMITH'],
      },
      {
        label: 'Chinese standalone cue with immediate dialogue',
        body: ['林夏', '别动。'],
        expectedCharacters: ['林夏'],
      },
      {
        label: 'standalone cue without immediate dialogue',
        body: ['MAYA', '', 'The handle turns.'],
        expectedCharacters: [],
      },
      {
        label: 'transition labels',
        body: [
          'FADE IN:',
          'CUT TO:',
          'DISSOLVE TO:',
          'SMASH CUT:',
          'MATCH CUT:',
          'FADE TO WHITE:',
          'FADE OUT',
          'The next shot begins.',
        ],
        expectedCharacters: [],
        expectedActionSummary: 'The next shot begins.',
      },
      {
        label: 'uppercase action',
        body: ['THE DOOR OPENS.', 'Maya steps inside.'],
        expectedCharacters: [],
        expectedActionSummary: 'THE DOOR OPENS.',
      },
      {
        label: 'implausibly long name',
        body: [`${'A'.repeat(41)}: Keep moving.`],
        expectedCharacters: [],
      },
    ]

    for (const scenario of cases) {
      const result = runWithText([
        'INT. CONTROL ROOM - NIGHT',
        ...scenario.body,
      ].join('\n'))

      const scene = payloadOf(result).scenes[0]!
      assert.deepEqual(
        scene.characters,
        scenario.expectedCharacters,
        scenario.label,
      )
      if (scenario.expectedActionSummary !== undefined) {
        assert.equal(scene.actionSummary, scenario.expectedActionSummary, scenario.label)
      }
    }
  })

  test('treats explicit colon delimiters as strong Unicode cue evidence', () => {
    const fortyCharacterName = 'A'.repeat(40)
    const scenes = payloadOf(runWithText([
      'INT. HALL - NIGHT',
      '李冲：快走。',
      'INT. STAIRWELL - NIGHT',
      '小明：别回头。',
      'INT. OFFICE - DAY',
      'LI CHONG: Go now.',
      'INT. STREET - NIGHT',
      'XIAO MING: Do not look back.',
      'INT. GARAGE - NIGHT',
      'MAYA RUN (v.o.): Keep moving.',
      'INT. WAREHOUSE - NIGHT',
      `${fortyCharacterName} (O.S.): Stay there.`,
    ].join('\n'))).scenes

    assert.deepEqual(scenes.map((scene) => scene.characters), [
      ['李冲'],
      ['小明'],
      ['LI CHONG'],
      ['XIAO MING'],
      ['MAYA RUN'],
      [fortyCharacterName],
    ])
    assert.deepEqual(scenes.map((scene) => scene.actionSummary), ['', '', '', '', '', ''])
  })

  test('keeps surname and action-word ambiguity heuristics on standalone cues', () => {
    for (const action of ['李冲', '小明', 'MAYA RUN']) {
      const scene = payloadOf(runWithText([
        'INT. HALL - NIGHT',
        action,
        'Keep moving.',
      ].join('\n'))).scenes[0]!

      assert.deepEqual(scene.characters, [], action)
      assert.equal(scene.actionSummary, action, action)
    }
  })

  test('still rejects explicit colon labels and names with invalid punctuation', () => {
    const cases = [
      'SFX: Door slam.',
      'SFX (V.O.): Door slam.',
      'CUT TO: The hall.',
      'MAYA!: Run.',
      'MAYA/JORDAN: Run.',
    ]

    for (const line of cases) {
      const scene = payloadOf(runWithText([
        'INT. HALL - NIGHT',
        line,
      ].join('\n'))).scenes[0]!
      assert.deepEqual(scene.characters, [], line)
    }
  })

  test('preserves ambiguous Latin and Chinese standalone lines as action', () => {
    const latinCases = [
      'THE DOOR OPENS',
      'THE DOOR',
      'A MAN',
      'AN OFFICER',
      'DOOR OPENS',
      'MAYA RUNS',
    ]
    const chineseCases = [
      '门打开',
      '门关闭',
      '林进入',
      '林离开',
      '林转身',
      '林走开',
      '林跑来',
      '林看门',
      '林推门',
      '林拉门',
      '林坐下',
      '林站起',
      '林笑了',
      '林哭了',
      '林冲出',
    ]

    for (const action of [...latinCases, ...chineseCases]) {
      const scene = payloadOf(runWithText([
        'INT. HALL - NIGHT',
        action,
        'Do not move.',
      ].join('\n'))).scenes[0]!

      assert.deepEqual(scene.characters, [], action)
      assert.equal(scene.actionSummary, action, action)
    }

    const namedScenes = payloadOf(runWithText([
      'INT. HALL - NIGHT',
      '林夏',
      '别动。',
      'INT. STATION - DAY',
      '老警察',
      '请出示证件。',
    ].join('\n'))).scenes
    assert.deepEqual(namedScenes.map((scene) => scene.characters), [['林夏'], ['老警察']])
    assert.deepEqual(namedScenes.map((scene) => scene.actionSummary), ['', ''])
  })

  test('rejects production labels in colon and standalone cue forms', () => {
    const labels = [
      'SFX',
      'VFX',
      'MUSIC',
      'SUPER',
      'TITLE',
      'CHYRON',
      'INSERT',
      'ANGLE',
      'POV',
      'VO',
      'OS',
    ]

    for (const label of labels) {
      const colonScene = payloadOf(runWithText([
        'INT. STUDIO - DAY',
        `${label}: Production direction.`,
      ].join('\n'))).scenes[0]!
      assert.deepEqual(colonScene.characters, [], `${label} colon form`)
      assert.equal(colonScene.actionSummary, `${label}: Production direction.`, `${label} colon form`)

      const standaloneScene = payloadOf(runWithText([
        'INT. STUDIO - DAY',
        label,
        'Production direction.',
      ].join('\n'))).scenes[0]!
      assert.deepEqual(standaloneScene.characters, [], `${label} standalone form`)
      assert.equal(standaloneScene.actionSummary, label, `${label} standalone form`)
    }
  })

  test('ends an active dialogue block at a transition line', () => {
    const scene = payloadOf(runWithText([
      'INT. CONTROL ROOM - NIGHT',
      'MAYA: Run.',
      'CUT TO:',
      'The door opens.',
    ].join('\n'))).scenes[0]!

    assert.deepEqual(scene.characters, ['MAYA'])
    assert.equal(scene.actionSummary, 'The door opens.')
  })

  test('supports controlled English cue qualifiers and stores the base name', () => {
    const scenes = payloadOf(runWithText([
      'INT. RADIO ROOM - NIGHT',
      'MAYA (v.o.)',
      'Can you hear me?',
      'INT. CORRIDOR - NIGHT',
      'JORDAN (O.S.): Stay there.',
      'Do not open the door.',
      'INT. LAB - DAY',
      "MAYA (cont'd):",
      'The signal is back.',
    ].join('\n'))).scenes

    assert.deepEqual(scenes.map((scene) => scene.characters), [
      ['MAYA'],
      ['JORDAN'],
      ['MAYA'],
    ])
    assert.deepEqual(scenes.map((scene) => scene.actionSummary), ['', '', ''])
  })

  test('deduplicates character names with deterministic Unicode uppercase keys', () => {
    const scene = payloadOf(runWithText([
      'INT. CAFE - DAY',
      'Élodie: Bonjour.',
      'ÉLODIE: Encore.',
    ].join('\n'))).scenes[0]!

    assert.deepEqual(scene.characters, ['Élodie'])
    assert.equal(scene.actionSummary, '')
  })

  test('classifies cues and dialogue once before selecting later explicit action', () => {
    const result = runWithText([
      'INT. CONTROL ROOM - NIGHT',
      'MAYA',
      'Do not move.',
      'EXT. PLATFORM - NIGHT',
      '林夏',
      '别动。',
      'INT. OFFICE - DAY',
      'MAYA: Stay here.',
      'EXT. ALLEY - NIGHT',
      'MAYA',
      'Keep quiet.',
      '',
      'THE DOOR OPENS.',
    ].join('\n'))
    const scenes = payloadOf(result).scenes

    assert.deepEqual(scenes.map((scene) => scene.characters), [
      ['MAYA'],
      ['林夏'],
      ['MAYA'],
      ['MAYA'],
    ])
    assert.deepEqual(scenes.map((scene) => scene.actionSummary), [
      '',
      '',
      '',
      'THE DOOR OPENS.',
    ])
  })

  test('supports empty-colon cues and excludes their contiguous dialogue blocks', () => {
    const source = [
      'INT. CONTROL ROOM - NIGHT',
      'MAYA:',
      'Do not move.',
      'Keep your hands visible.',
      '',
      'The warning light changes.',
      'EXT. PLATFORM - NIGHT',
      '林夏：',
      '别动。',
      '我马上回来。',
    ].join('\n')
    const result = runWithText(source)
    const scenes = payloadOf(result).scenes

    assert.deepEqual(scenes.map((scene) => ({
      characters: scene.characters,
      actionSummary: scene.actionSummary,
      sourceText: scene.sourceText,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
    })), [
      {
        characters: ['MAYA'],
        actionSummary: 'The warning light changes.',
        sourceText: [
          'INT. CONTROL ROOM - NIGHT',
          'MAYA:',
          'Do not move.',
          'Keep your hands visible.',
          '',
          'The warning light changes.',
        ].join('\n'),
        lineStart: 1,
        lineEnd: 6,
      },
      {
        characters: ['林夏'],
        actionSummary: '',
        sourceText: [
          'EXT. PLATFORM - NIGHT',
          '林夏：',
          '别动。',
          '我马上回来。',
        ].join('\n'),
        lineStart: 7,
        lineEnd: 10,
      },
    ])
  })

  test('keeps standalone and inline-colon dialogue continuations out of action summaries', () => {
    const source = [
      'INT. OFFICE - DAY',
      'MAYA',
      'Stay here.',
      'Do not answer the phone.',
      'The corridor is not safe.',
      'EXT. ALLEY - NIGHT',
      '林夏',
      '别出声。',
      '他们还在附近。',
      'INT. LAB - NIGHT',
      'MAYA: Watch the monitor.',
      'The signal is getting stronger.',
      'It is almost here.',
      'INT. HALL - NIGHT',
      'MAYA: First channel.',
      'Keep listening.',
      'LIN:',
      'Second channel.',
      'Do not interrupt.',
    ].join('\n')
    const result = runWithText(source)
    const scenes = payloadOf(result).scenes

    assert.deepEqual(scenes.map((scene) => scene.characters), [
      ['MAYA'],
      ['林夏'],
      ['MAYA'],
      ['MAYA', 'LIN'],
    ])
    assert.deepEqual(scenes.map((scene) => scene.actionSummary), ['', '', '', ''])
    assert.deepEqual(scenes.map((scene) => [scene.lineStart, scene.lineEnd]), [
      [1, 5],
      [6, 9],
      [10, 13],
      [14, 19],
    ])
  })

  test('accepts controlled delimiters in Chinese headings', () => {
    const result = runWithText([
      '第一场：外景 街道 夜',
      '雨水漫过路沿。',
      '内景：房间 夜',
      '灯光轻轻闪烁。',
      '第二场、内景：车站 日',
      '人群穿过大厅。',
      '第三场: 外景、天台 黄昏',
      '风吹动晾衣绳。',
    ].join('\n'))
    const payload = payloadOf(result)

    assert.equal(payload.format, 'headed-script')
    assert.deepEqual(payload.scenes.map(({ heading, location, timeOfDay }) => ({
      heading,
      location,
      timeOfDay,
    })), [
      { heading: '第一场：外景 街道 夜', location: '街道', timeOfDay: '夜' },
      { heading: '内景：房间 夜', location: '房间', timeOfDay: '夜' },
      { heading: '第二场、内景：车站 日', location: '车站', timeOfDay: '日' },
      { heading: '第三场: 外景、天台 黄昏', location: '天台', timeOfDay: '黄昏' },
    ])
  })

  test('extracts English heading tokens after Chinese numbered prefixes', () => {
    const source = [
      '第1场 INT. CAFE - DAY',
      'Maya waits beside the window.',
      '第二场：EXT. ROOFTOP - NIGHT',
      'Rain crosses the concrete.',
      '第三场、I/E. TRAIN - DAWN',
      'The doors slide shut.',
    ].join('\n')
    const result = runWithText(source)
    const scenes = payloadOf(result).scenes

    assert.deepEqual(scenes.map((scene) => ({
      heading: scene.heading,
      location: scene.location,
      timeOfDay: scene.timeOfDay,
      sourceText: scene.sourceText,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
    })), [
      {
        heading: '第1场 INT. CAFE - DAY',
        location: 'CAFE',
        timeOfDay: 'DAY',
        sourceText: '第1场 INT. CAFE - DAY\nMaya waits beside the window.',
        lineStart: 1,
        lineEnd: 2,
      },
      {
        heading: '第二场：EXT. ROOFTOP - NIGHT',
        location: 'ROOFTOP',
        timeOfDay: 'NIGHT',
        sourceText: '第二场：EXT. ROOFTOP - NIGHT\nRain crosses the concrete.',
        lineStart: 3,
        lineEnd: 4,
      },
      {
        heading: '第三场、I/E. TRAIN - DAWN',
        location: 'TRAIN',
        timeOfDay: 'DAWN',
        sourceText: '第三场、I/E. TRAIN - DAWN\nThe doors slide shut.',
        lineStart: 5,
        lineEnd: 6,
      },
    ])
  })

  test('does not treat Chinese prose prefixes as headings', () => {
    const result = runWithText([
      '第一场雨落下来。',
      '内景故事继续展开。',
      '外景人物也只是描述。',
    ].join('\n'))
    const payload = payloadOf(result)

    assert.equal(payload.format, 'paragraph-fallback')
    assert.equal(payload.scenes.length, 1)
    assert.equal(payload.scenes[0]!.heading, '')
  })

  test('preserves exact ranges, source text, evidence, and artifact provenance', () => {
    const source = 'EXT. ALLEY - NIGHT\n  Rain hits metal.  \nMAYA: Run.'
    const result = runWithText(source, { id: 'source-node-7' })
    const artifact = result.artifacts[0]!
    const scene = payloadOf(result).scenes[0]!

    assert.deepEqual(artifact, {
      artifactId: 'scene-breakdown-001',
      artifactType: 'scene-breakdown',
      artifactVersion: 1,
      sourceNodeIds: ['source-node-7'],
      sourceArtifactIds: [],
      payload: artifact.payload,
    })
    assert.equal(scene.sourceText, source)
    assert.equal(scene.lineStart, 1)
    assert.equal(scene.lineEnd, 3)
    assert.equal(scene.reviewStatus, 'pending')
    assert.deepEqual(result.evidence, [{
      evidenceId: 'scene-evidence-001',
      ruleId: 'HEADED_SCENE_BOUNDARY',
      sourceNodeId: 'source-node-7',
      lineStart: 1,
      lineEnd: 3,
      excerpt: source,
      explanation: 'Scene 1 follows an explicit script heading.',
    }])
  })

  test('includes nonempty pre-heading content in the first scene and flags review', () => {
    const source = [
      'A torn photograph lies on the table.',
      '',
      'INT. APARTMENT - NIGHT',
      'The window rattles.',
    ].join('\n')
    const result = runWithText(source)
    const firstScene = payloadOf(result).scenes[0]!

    assert.equal(result.status, 'needs-review')
    assert.equal(result.warnings[0]?.code, 'PRE_HEADING_CONTENT_INCLUDED')
    assert.equal(firstScene.heading, 'INT. APARTMENT - NIGHT')
    assert.equal(firstScene.lineStart, 1)
    assert.equal(firstScene.lineEnd, 4)
    assert.equal(firstScene.sourceText, source)
    assert.equal(result.evidence[0]?.excerpt, source)
  })

  test('normalizes CRLF and prefers non-whitespace resultText over prompt', () => {
    const resultText = 'EXT. RIVER - NIGHT\r\nWater moves under the bridge.\r\nMAYA: Listen.'
    const result = runWithText('INT. UNUSED - DAY\nThis prompt must not be used.', { resultText })
    const scene = payloadOf(result).scenes[0]!

    assert.equal(scene.sourceText, resultText.replaceAll('\r\n', '\n'))
    assert.equal(scene.lineStart, 1)
    assert.equal(scene.lineEnd, 3)
    assert.equal(result.evidence[0]?.excerpt, scene.sourceText)
  })

  test('uses prompt when resultText is only whitespace', () => {
    const result = runWithText('EXT. FIELD - DAY\nGrass bends in the wind.', {
      resultText: ' \n\t ',
    })

    assert.equal(payloadOf(result).scenes[0]!.heading, 'EXT. FIELD - DAY')
  })

  test('is deterministic without clocks, randomness, or network access', () => {
    const input: CreatorSkillRunInput = {
      sourceNodes: [textNode('INT. LAB - NIGHT\nA monitor pulses.\nMAYA: Ready.')],
    }
    const originalDateNow = Date.now
    const originalRandom = Math.random
    const originalFetch = globalThis.fetch
    Date.now = () => {
      throw new Error('Clock access is forbidden')
    }
    Math.random = () => {
      throw new Error('Randomness is forbidden')
    }
    globalThis.fetch = async () => {
      throw new Error('Network access is forbidden')
    }

    try {
      const first = runCreatorSkill('script-segmentation', input)
      const second = runCreatorSkill('script-segmentation', input)
      assert.deepEqual(second, first)
    } finally {
      Date.now = originalDateNow
      Math.random = originalRandom
      globalThis.fetch = originalFetch
    }
  })
})

describe('script-segmentation fallback and limits', () => {
  test('splits heading-free text on blank-line groups and preserves paragraph ranges', () => {
    const source = [
      'The platform is empty.',
      'A clock ticks above the gate.',
      '',
      '',
      'A train arrives without lights.',
      'Maya steps back.',
    ].join('\n')
    const result = runWithText(source)
    const payload = payloadOf(result)

    assert.equal(result.status, 'needs-review')
    assert.equal(payload.format, 'paragraph-fallback')
    assert.equal(result.warnings[0]?.code, 'FALLBACK_SCENE_BOUNDARIES')
    assert.deepEqual(payload.scenes.map((scene) => ({
      heading: scene.heading,
      sourceText: scene.sourceText,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
    })), [
      {
        heading: '',
        sourceText: 'The platform is empty.\nA clock ticks above the gate.',
        lineStart: 1,
        lineEnd: 2,
      },
      {
        heading: '',
        sourceText: 'A train arrives without lights.\nMaya steps back.',
        lineStart: 5,
        lineEnd: 6,
      },
    ])
    assert.deepEqual(result.evidence.map((evidence) => ({
      evidenceId: evidence.evidenceId,
      ruleId: evidence.ruleId,
      lineStart: evidence.lineStart,
      lineEnd: evidence.lineEnd,
      excerpt: evidence.excerpt,
    })), [
      {
        evidenceId: 'scene-evidence-001',
        ruleId: 'FALLBACK_PARAGRAPH_BOUNDARY',
        lineStart: 1,
        lineEnd: 2,
        excerpt: 'The platform is empty.\nA clock ticks above the gate.',
      },
      {
        evidenceId: 'scene-evidence-002',
        ruleId: 'FALLBACK_PARAGRAPH_BOUNDARY',
        lineStart: 5,
        lineEnd: 6,
        excerpt: 'A train arrives without lights.\nMaya steps back.',
      },
    ])
  })

  test('caps output at 40 scenes and requests review', () => {
    const source = Array.from({ length: 42 }, (_, index) => (
      `INT. ROOM ${index + 1} - DAY\nAction ${index + 1} continues.`
    )).join('\n')
    const result = runWithText(source)
    const payload = payloadOf(result)

    assert.equal(result.status, 'needs-review')
    assert.equal(payload.scenes.length, 40)
    assert.equal(result.evidence.length, 40)
    assert.equal(payload.scenes[39]?.sceneId, 'scene-040')
    assert.ok(result.warnings.some((warning) => warning.code === 'SCENE_LIMIT_REACHED'))
  })

  test('caps paragraph fallback output at 40 scenes with exact retained ranges', () => {
    const source = Array.from({ length: 42 }, (_, index) => (
      `Paragraph ${index + 1} contains enough source text.`
    )).join('\n\n')
    const result = runWithText(source)
    const payload = payloadOf(result)

    assert.equal(result.status, 'needs-review')
    assert.equal(payload.format, 'paragraph-fallback')
    assert.equal(payload.scenes.length, 40)
    assert.equal(result.evidence.length, 40)
    assert.equal(payload.scenes[39]?.lineStart, 79)
    assert.equal(payload.scenes[39]?.lineEnd, 79)
    assert.ok(result.warnings.some((warning) => warning.code === 'SCENE_LIMIT_REACHED'))
  })
})

describe('script-segmentation blockers', () => {
  test('blocks empty and whitespace-only source text', () => {
    for (const source of ['', ' \n\t ']) {
      const result = runWithText(source)
      assertBlockedWithoutOutput(result)
      assert.equal(result.blockers[0]?.code, 'SCRIPT_SOURCE_EMPTY')
    }
  })

  test('blocks source text with fewer than eight non-whitespace characters', () => {
    const result = runWithText('1 2 3 4 5 6 7')

    assertBlockedWithoutOutput(result)
    assert.equal(result.blockers[0]?.code, 'SCRIPT_SOURCE_TOO_SHORT')
  })

  test('counts the eight-character minimum by Unicode code points', () => {
    const sevenCodePoints = runWithText('😀 😀 😀 😀 😀 😀 😀')
    const eightCodePoints = runWithText('😀 😀 😀 😀 😀 😀 😀 😀')

    assertBlockedWithoutOutput(sevenCodePoints)
    assert.equal(sevenCodePoints.blockers[0]?.code, 'SCRIPT_SOURCE_TOO_SHORT')
    assert.equal(eightCodePoints.status, 'needs-review')
    assert.equal(payloadOf(eightCodePoints).scenes[0]?.actionSummary, '😀 😀 😀 😀 😀 😀 😀 😀')
  })

  test('blocks image-only input without artifacts or evidence', () => {
    const result = runCreatorSkill('script-segmentation', {
      sourceNodes: [{
        id: 'image-1',
        kind: 'image',
        title: 'Reference',
        prompt: 'A reference frame',
      }],
    })

    assertBlockedWithoutOutput(result)
  })

  test('blocks multiple Text source nodes with a clear source-count blocker', () => {
    const result = runCreatorSkill('script-segmentation', {
      sourceNodes: [
        textNode('INT. ROOM - DAY\nThe first source has enough text.', { id: 'text-1' }),
        textNode('EXT. ROAD - NIGHT\nThe second source has enough text.', { id: 'text-2' }),
      ],
    })

    assertBlockedWithoutOutput(result)
    assert.equal(result.blockers[0]?.code, 'SCRIPT_SOURCE_COUNT_INVALID')
    assert.match(result.blockers[0]!.message, /exactly one Text source node/i)
  })
})
