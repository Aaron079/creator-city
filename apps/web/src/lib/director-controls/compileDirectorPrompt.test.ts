import { compileDirectorPrompt, hasDirectorControls } from './compileDirectorPrompt'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

function run() {
  // 1. No controls → finalPrompt equals basePrompt
  {
    const result = compileDirectorPrompt({ basePrompt: '一片草原上有一匹马', target: 'image' })
    assert(result.finalPrompt === '一片草原上有一匹马', 'no controls: finalPrompt should equal basePrompt')
    assert(result.positiveDirectives.length === 0, 'no controls: positiveDirectives should be empty')
    assert(result.metadata.summarySentence === '', 'no controls: summarySentence should be empty')
    console.log('✓ no controls → finalPrompt = basePrompt')
  }

  // 2. Empty basePrompt + no controls → empty finalPrompt
  {
    const result = compileDirectorPrompt({ basePrompt: '' })
    assert(result.finalPrompt === '', 'empty prompt, no controls: finalPrompt should be empty')
    console.log('✓ empty basePrompt + no controls → empty finalPrompt')
  }

  // 3. shotType: wide
  {
    const result = compileDirectorPrompt({ basePrompt: '原创战士', shotType: 'wide', target: 'image' })
    assert(result.finalPrompt.includes('wide shot'), 'wide shot: finalPrompt should include "wide shot"')
    assert(result.metadata.shotTypeLabel === '远景', 'wide shot: label should be 远景')
    console.log('✓ shotType=wide → 远景, includes "wide shot"')
  }

  // 4. shotType: extreme-close
  {
    const result = compileDirectorPrompt({ basePrompt: '战士', shotType: 'extreme-close', target: 'image' })
    assert(result.finalPrompt.includes('extreme close-up'), 'extreme-close: should include "extreme close-up"')
    assert(result.metadata.shotTypeLabel === '特写', 'extreme-close: label should be 特写')
    console.log('✓ shotType=extreme-close → 特写')
  }

  // 5. cameraMovement: push-in (video target uses Chinese comma)
  {
    const result = compileDirectorPrompt({ basePrompt: '战士站立', cameraMovement: 'push-in', target: 'video' })
    assert(result.finalPrompt.includes('push-in'), 'push-in: finalPrompt should include "push-in"')
    assert(result.finalPrompt.startsWith('战士站立，'), 'video target: should use Chinese comma')
    assert(result.metadata.cameraMovementLabel === '推镜', 'push-in: label should be 推镜')
    console.log('✓ cameraMovement=push-in, target=video → 推镜, Chinese comma')
  }

  // 6. image target uses ASCII comma
  {
    const result = compileDirectorPrompt({ basePrompt: 'warrior', cameraMovement: 'overhead', target: 'image' })
    assert(result.finalPrompt.startsWith('warrior, '), 'image target: should use ASCII comma')
    console.log('✓ target=image → ASCII comma')
  }

  // 7. style: cinematic
  {
    const result = compileDirectorPrompt({ basePrompt: 'test', style: 'cinematic' })
    assert(result.finalPrompt.includes('cinematic lighting'), 'cinematic: should include "cinematic lighting"')
    assert(result.metadata.styleLabel === '电影感', 'cinematic: label should be 电影感')
    console.log('✓ style=cinematic → 电影感')
  }

  // 8. lighting: neon
  {
    const result = compileDirectorPrompt({ basePrompt: 'city', lighting: 'neon' })
    assert(result.finalPrompt.includes('neon lighting'), 'neon: should include "neon lighting"')
    assert(result.metadata.lightingLabel === '霓虹', 'neon: label should be 霓虹')
    console.log('✓ lighting=neon → 霓虹')
  }

  // 9. color: cool
  {
    const result = compileDirectorPrompt({ basePrompt: 'scene', color: 'cool' })
    assert(result.finalPrompt.includes('cool color palette'), 'cool: should include "cool color palette"')
    assert(result.metadata.colorLabel === '冷色', 'cool: label should be 冷色')
    console.log('✓ color=cool → 冷色')
  }

  // 10. rhythm: slow-motion
  {
    const result = compileDirectorPrompt({ basePrompt: 'action', rhythm: 'slow-motion' })
    assert(result.finalPrompt.includes('slow motion'), 'slow-motion: should include "slow motion"')
    assert(result.metadata.rhythmLabel === '慢动作', 'slow-motion: label should be 慢动作')
    console.log('✓ rhythm=slow-motion → 慢动作')
  }

  // 11. Multi-control combination: no duplicates
  {
    const result = compileDirectorPrompt({
      basePrompt: '一位原创战士',
      shotType: 'wide',
      cameraMovement: 'push-in',
      style: 'cinematic',
      lighting: 'backlight',
      color: 'cool',
      rhythm: 'slow-motion',
      target: 'video',
    })
    const directives = result.positiveDirectives
    const unique = new Set(directives)
    assert(unique.size === directives.length, 'multi-control: no duplicate directives')
    assert(result.metadata.summarySentence === '远景 · 推镜 · 电影感 · 逆光 · 冷色 · 慢动作', `multi-control: summarySentence should be full combo, got: ${result.metadata.summarySentence}`)
    assert(result.finalPrompt.includes('一位原创战士'), 'multi-control: base prompt preserved')
    console.log('✓ multi-control: no duplicates, full summarySentence, base preserved')
  }

  // 12. Chinese prompt preserved
  {
    const result = compileDirectorPrompt({
      basePrompt: '一位原创东方幻想战士从云层中缓缓降落，身披黑金铠甲，手持发光长枪',
      style: 'fantasy',
      target: 'video',
    })
    assert(result.finalPrompt.startsWith('一位原创东方幻想战士'), 'Chinese prompt preserved at start')
    assert(result.positiveDirectives.some((d) => d.includes('fantasy')), 'fantasy: directive included')
    console.log('✓ Chinese prompt preserved with fantasy style')
  }

  // 13. hasDirectorControls
  {
    assert(!hasDirectorControls({}), 'no params: hasDirectorControls should be false')
    assert(hasDirectorControls({ shotType: 'wide' }), 'with shotType: hasDirectorControls should be true')
    assert(hasDirectorControls({ rhythm: 'slow-motion' }), 'with rhythm: hasDirectorControls should be true')
    console.log('✓ hasDirectorControls works correctly')
  }

  // 14. Only directives, empty basePrompt
  {
    const result = compileDirectorPrompt({ basePrompt: '', shotType: 'close', target: 'image' })
    assert(result.finalPrompt.includes('close shot'), 'empty base + shotType: directives should be finalPrompt')
    assert(!result.finalPrompt.startsWith(','), 'no leading comma when base is empty')
    console.log('✓ empty basePrompt + controls → directives only, no leading comma')
  }

  console.log('\n✅ All tests passed')
}

run()
