import { compileDirectorPrompt, hasDirectorControls, compileAssetPreview } from './compileDirectorPrompt'

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

  // 15. cameraBody: cinema
  {
    const result = compileDirectorPrompt({ basePrompt: 'warrior', cameraBody: 'cinema', target: 'image' })
    assert(result.finalPrompt.includes('cinema camera'), 'cinema: should include "cinema camera"')
    assert(result.metadata.cameraBodyLabel === '电影机', 'cinema: label should be 电影机')
    console.log('✓ cameraBody=cinema → 电影机, includes "cinema camera"')
  }

  // 16. lensType: telephoto
  {
    const result = compileDirectorPrompt({ basePrompt: 'portrait', lensType: 'telephoto', target: 'image' })
    assert(result.finalPrompt.includes('telephoto lens'), 'telephoto: should include "telephoto lens"')
    assert(result.metadata.lensTypeLabel === '长焦', 'telephoto: label should be 长焦')
    console.log('✓ lensType=telephoto → 长焦, includes "telephoto lens"')
  }

  // 17. focalLength: 85mm
  {
    const result = compileDirectorPrompt({ basePrompt: 'portrait', focalLength: '85mm', target: 'image' })
    assert(result.finalPrompt.includes('85mm'), 'focalLength=85mm: should include "85mm"')
    assert(result.metadata.focalLengthLabel === '85mm', 'focalLength=85mm: label should be 85mm')
    console.log('✓ focalLength=85mm → label 85mm, directive included')
  }

  // 18. aperture: f1.4
  {
    const result = compileDirectorPrompt({ basePrompt: 'bokeh shot', aperture: 'f1.4', target: 'image' })
    assert(result.finalPrompt.includes('f/1.4'), 'f1.4: should include "f/1.4"')
    assert(result.metadata.apertureLabel === 'f/1.4', 'f1.4: label should be f/1.4')
    console.log('✓ aperture=f1.4 → f/1.4, includes directive')
  }

  // 19. hasDirectorControls now detects new fields
  {
    assert(hasDirectorControls({ cameraBody: 'drone' }), 'cameraBody=drone: hasDirectorControls should be true')
    assert(hasDirectorControls({ lensType: 'macro' }), 'lensType=macro: hasDirectorControls should be true')
    assert(hasDirectorControls({ focalLength: '35mm' }), 'focalLength=35mm: hasDirectorControls should be true')
    assert(hasDirectorControls({ aperture: 'f8' }), 'aperture=f8: hasDirectorControls should be true')
    assert(!hasDirectorControls({}), 'empty: hasDirectorControls should be false')
    console.log('✓ hasDirectorControls detects all new fields')
  }

  // 20. compileAssetPreview: color=cool → CSS filter
  {
    const preview = compileAssetPreview({ color: 'cool' })
    assert(typeof preview.filter === 'string' && preview.filter.includes('saturate'), 'cool: filter should include saturate')
    assert(preview.playbackRate === undefined, 'cool: no playbackRate without rhythm')
    console.log('✓ compileAssetPreview color=cool → CSS filter with saturate')
  }

  // 21. compileAssetPreview: rhythm=slow-motion → playbackRate 0.5
  {
    const preview = compileAssetPreview({ rhythm: 'slow-motion' })
    assert(preview.playbackRate === 0.5, 'slow-motion: playbackRate should be 0.5')
    console.log('✓ compileAssetPreview rhythm=slow-motion → playbackRate 0.5')
  }

  // 22. compileAssetPreview: cameraMovement=push-in → animation
  {
    const preview = compileAssetPreview({ cameraMovement: 'push-in' })
    assert(typeof preview.animation === 'string' && preview.animation.includes('dc-push-in'), 'push-in: animation should include dc-push-in')
    console.log('✓ compileAssetPreview cameraMovement=push-in → dc-push-in animation')
  }

  // 23. summarySentence includes cameraBody/lensType/focalLength/aperture when set
  {
    const result = compileDirectorPrompt({
      basePrompt: 'test',
      cameraBody: 'cinema',
      focalLength: '85mm',
      aperture: 'f2.8',
      target: 'image',
    })
    assert(result.metadata.summarySentence.includes('电影机'), 'summarySentence: should include 电影机')
    assert(result.metadata.summarySentence.includes('85mm'), 'summarySentence: should include 85mm')
    assert(result.metadata.summarySentence.includes('f/2.8'), 'summarySentence: should include f/2.8')
    console.log('✓ summarySentence includes new camera fields')
  }

  console.log('\n✅ All tests passed')
}

run()
