# Director Control Skills — 导演控制参数系统

Creator City 导演控制引擎，让用户在生成前通过镜头语言参数精确控制图片/视频的视觉效果。

---

## 架构概述

```
用户选择参数
    ↓
DirectorControlPanel (UI 层)
    ↓
compileDirectorPrompt (引擎层)
    ↓
finalPrompt 注入 callGenerationApi
    ↓
图片/视频生成 API（prompt 已含导演指令）
    ↓
节点 metadataJson.directorControls 保存参数
    ↓
CanvasNodeCard 显示摘要标签
```

---

## 文件结构

```
apps/web/src/lib/director-controls/
  types.ts                        — TypeScript 类型定义
  presets.ts                      — 各控制项 → prompt 映射表
  compileDirectorPrompt.ts        — 核心引擎函数
  compileDirectorPrompt.test.ts   — 单元测试 (14项)

apps/web/src/components/create/
  DirectorControlPanel.tsx        — 可折叠 UI 面板
```

---

## 控制项说明

### 1. 镜头类型 (ShotType)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `wide` | 远景 | `wide shot, establishing shot, full environment visible, subject small in frame` |
| `medium` | 中景 | `medium shot, waist-up framing, balanced subject and environment` |
| `close` | 近景 | `close shot, subject fills frame, shallow depth of field, detailed expression` |
| `extreme-close` | 特写 | `extreme close-up, ECU, facial detail, eyes in sharp focus, intense emotion` |

### 2. 镜头运动 (CameraMovement)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `push-in` | 推镜 | `slow push-in, camera moves toward subject, building tension` |
| `pull-out` | 拉镜 | `pull-out shot, camera retreats, revealing environment` |
| `pan` | 摇镜 | `pan shot, camera sweeps horizontally, scanning movement` |
| `dolly` | 移镜 | `dolly shot, lateral dolly movement, smooth sideways motion` |
| `tracking` | 跟拍 | `tracking shot, camera follows subject, dynamic motion follow` |
| `overhead` | 俯拍 | `overhead shot, top-down composition, bird's eye view` |

### 3. 风格 (DirectorStyle)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `cinematic` | 电影感 | `cinematic lighting, film still aesthetic, anamorphic lens feel, dramatic composition` |
| `commercial` | 广告感 | `clean commercial lighting, premium product visual, polished finish, high-end brand aesthetic` |
| `short-drama` | 短剧 | `vertical drama framing, emotional tension, direct storytelling` |
| `manhua` | 漫剧 | `manhua-inspired composition, comic panel energy, stylized drama` |
| `realistic` | 写实 | `photorealistic, natural textures, believable lighting, documentary feel` |
| `fantasy` | 幻想 | `fantasy atmosphere, magical realism, epic worldbuilding, ethereal lighting` |

### 4. 光线 (Lighting)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `backlight` | 逆光 | `backlit, rim lighting, glowing outline, silhouette against bright background` |
| `rembrandt` | 伦勃朗 | `Rembrandt lighting, triangular cheek highlight, dramatic shadow, chiaroscuro` |
| `neon` | 霓虹 | `neon lighting, cyberpunk glow, saturated night color` |
| `natural` | 自然光 | `natural daylight, soft realistic illumination, golden hour light` |

### 5. 色彩 (Color)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `cool` | 冷色 | `cool color palette, blue tones, restrained mood, cool shadows` |
| `warm` | 暖色 | `warm color palette, amber tones, golden grade` |
| `high-contrast` | 高对比 | `high contrast, deep crushed blacks, bright highlights, bold shadows` |
| `low-saturation` | 低饱和 | `low saturation, muted color palette, bleach bypass look` |

### 6. 节奏 (Rhythm)

| 值 | 中文 | 核心 prompt 指令 |
|----|------|-----------------|
| `slow-motion` | 慢动作 | `slow motion, graceful suspended movement, time-stretched action` |
| `fast-paced` | 快节奏 | `fast-paced action, energetic motion, rapid visual rhythm` |
| `stable-shot` | 稳定镜头 | `stable camera, smooth movement, gimbal stability, no shaky cam` |

---

## compileDirectorPrompt API

```typescript
import { compileDirectorPrompt, hasDirectorControls } from '@/lib/director-controls/compileDirectorPrompt'

const result = compileDirectorPrompt({
  basePrompt: '一位原创东方幻想战士从云层中缓缓降落',
  shotType: 'wide',
  cameraMovement: 'push-in',
  style: 'cinematic',
  lighting: 'backlight',
  color: 'cool',
  rhythm: 'slow-motion',
  target: 'video',  // 'image' | 'video'
})

// result.finalPrompt:
// "一位原创东方幻想战士从云层中缓缓降落，wide shot, establishing shot, ...slow motion"

// result.metadata.summarySentence:
// "远景 · 推镜 · 电影感 · 逆光 · 冷色 · 慢动作"

// result.positiveDirectives: string[]
// result.negativeDirectives: string[]
```

### target 差异

- `target: 'video'` — 指令用中文逗号 `，` 连接（兼容 Seedance 等中文视频模型）
- `target: 'image'` — 指令用英文逗号 `, ` 连接

---

## 前端集成

### 生成流程

1. 用户在 `DirectorControlPanel` 选择参数
2. 点击生成时，`handleNodeDialogGenerate` 调用 `compileDirectorPrompt`
3. `finalPrompt` 替代原始 prompt 发送到 `/api/generate/image` 或 `/api/generate/video`
4. 生成结果元数据中保存 `directorControls` 对象

### 节点 metadataJson 结构

```json
{
  "directorControls": {
    "shotType": "wide",
    "cameraMovement": "push-in",
    "style": "cinematic",
    "lighting": "backlight",
    "color": "cool",
    "rhythm": "slow-motion",
    "finalPrompt": "一位原创战士，wide shot, ..., slow motion",
    "shotTypeLabel": "远景",
    "cameraMovementLabel": "推镜",
    "styleLabel": "电影感",
    "lightingLabel": "逆光",
    "colorLabel": "冷色",
    "rhythmLabel": "慢动作",
    "summarySentence": "远景 · 推镜 · 电影感 · 逆光 · 冷色 · 慢动作"
  }
}
```

---

## GitHub Skill 调研结果

调研了以下方向的开源资源：

| 分类 | 代表资源 | 集成决策 |
|------|---------|---------|
| ComfyUI Prompt Styler (`twri/sdxl_prompt_styler`) | JSON-based style templates | **参考结构**，不引入依赖 |
| awesome-seedance-2-prompts | Seedance 视频 prompt 词汇库 | **参考词汇**，已融入 presets.ts |
| awesome-ai-video-prompts | 摄像机运动/镜头类型词汇 | **参考词汇**，已融入 presets.ts |
| ComfyUI-LLM-Prompt-Enhancer | LLM 增强，需要 API | **不集成**（不引入不稳定依赖） |
| VideoColorGrading | 基于 LUT 的色彩映射 | **不集成**（超出当前 V1 范围） |

**最终决策**：自实现轻量 Director Control Engine。无新 npm 依赖，纯 TypeScript，零运行时依赖。

---

## 测试

```bash
apps/web/node_modules/.bin/tsx apps/web/src/lib/director-controls/compileDirectorPrompt.test.ts
```

14 个测试项，覆盖：
- 无参数 → finalPrompt = basePrompt
- 各控制项单独验证
- 多控制组合（无重复指令）
- image / video target 差异（中英文逗号）
- 中文 prompt 保留
- 空 basePrompt + 控制项
- `hasDirectorControls` 函数

---

## 安全边界

- 不改动生成 API 路由
- 不改动 cn-executor
- 不改动 canvas save 路由
- 不改动 media proxy 路由
- 不改动 DB schema
- 不新增 npm 依赖
- finalPrompt 不注入版权/IP 词汇（由用户 basePrompt 和本 presets 共同保证）
