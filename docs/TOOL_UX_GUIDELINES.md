# Creator City — Tool UX Interaction Guidelines

**Status:** DRAFT v1  
**Date:** 2026-06-16  
**Scope:** Canvas director tools, generation dialogs, Bible panels, ShotList, Camera Lexicon

---

## Design Principle

> **导演不填表单，导演做决策。**  
> Every tool interaction should feel like choosing, not typing. Replace dropdowns and text inputs wherever a bounded option set exists. Show the options visually so the user understands them without reading documentation.

---

## Interaction Vocabulary

### 1. WheelSelector
**When to use:** 3–8 options in a clear sequential or progressive order.  
**Component:** `apps/web/src/components/toolkit/WheelSelector.tsx`

Best fits:
- Pacing: 🐢 慢 / ⚡ 标准 / 🚀 快
- Shot duration: 3s / 5s / 8s / 10s / 15s
- Emotion intensity: 冷静 → 紧张 → 史诗
- Style strength: Low → Medium → High
- Camera movement sequence (push → pull → pan → tilt → track)

**Affordance:** Prev/next arrows + all options visible, selected highlighted.

---

### 2. VisualTagPicker
**When to use:** 2–8 discrete, non-sequential options. Single-select or multi-select.  
**Component:** `apps/web/src/components/toolkit/VisualTagPicker.tsx`

Best fits:
- Output type: 🖼 图片 / 🎬 混合 / 📹 视频
- Shot size: 全景 / 中景 / 近景 / 特写
- Shot size strategy: 🎯 自动 / 📐 全→特 / 🔍 特写重 / 🌅 全景重
- Character role: 主角 / 反派 / 群演 / 旁观者
- Weather: 晴天 / 阴天 / 雨夜 / 大雪 / 雾霾
- Time of day: 清晨 / 日间 / 黄昏 / 夜晚
- Atmosphere tags: 孤独 / 紧张 / 梦幻 / 史诗 / 温馨
- Lighting style: 逆光 / 霓虹 / 柔光 / 硬光 / 低调光

**Affordance:** Inline pill buttons that look interactive, with optional icon prefix and sublabel.  
**Multi-select:** Pass `multiSelect={true}` with `value: T[]`.

---

### 3. Icon Cards
**When to use:** Tool entry points, panel launchers, mode selectors with meaningful visual identity.

Best fits:
- CanvasToolDock tool entries (already partially done — emoji + label)
- Generation mode selector (image / video / text node type)
- Bible tool selector (角色圣经 / 场景圣经 / 风格圣经)

**Design rule:** Icon/emoji + Chinese label + optional English sublabel + optional badge (soon / internal).

---

### 4. Image Reference Chips
**When to use:** Reference images for characters, scenes, style — wherever a thumbnail conveys more than text.

Best fits:
- CharacterReferenceGridPanel (already exists)
- SceneBible reference images (future)
- Style mood board swatches (future)
- Video node upstream image reference (P2-CANVAS-4, already done)

**Design rule:** Small thumbnail (40–80px) + removable × button + label overlay.

---

### 5. Preview Swatches
**When to use:** Color, style, and LUT selection.

Best fits:
- ColorGradePalettePanel preset strip (already has accent bar — close to done)
- LookPackagePanel look cards (already has color swatch — close to done)
- StyleBible color palette entry (future)

**Design rule:** Small colored strip or square above the label. No pure text dropdowns for colors.

---

## Audit: Current Tool Interaction Types

| Tool | Current UX | Pain Points | Recommended |
|---|---|---|---|
| ShotListBuilderPanel — outputMode | `<select>` | Invisible options, no icons | VisualTagPicker ✅ DONE |
| ShotListBuilderPanel — pacing | `<select>` | No progressive feel | VisualTagPicker ✅ DONE |
| ShotListBuilderPanel — shotSizeStrategy | `<select>` | Abstract labels | VisualTagPicker ✅ DONE |
| ShotListBuilderPanel — per-shot shotSize | `<select>` | Cramped, no visual | VisualTagPicker ✅ DONE |
| ShotListBuilderPanel — per-shot duration | `<select>` | Only 2 options | Pill toggle ✅ DONE |
| CameraLexiconPanel — category tabs | Pill tabs | Already good | Fine as-is |
| CameraLexiconPanel — term cards | 2-col card grid | Text only, no visual icon | Add icon/emoji per term (P2-TOOL-UX-2) |
| CharacterBiblePanel — all fields | textarea/input | Pure form, no visual | Chips for role/temperament/props (P2-TOOL-UX-3) |
| SceneBiblePanel — weather/era/atmosphere | textarea/input | Pure form | VisualTagPicker for bounded fields (P2-TOOL-UX-3) |
| ColorGradePalettePanel — presets | Preset strip with accent bar | Close to done | Add mood preview on hover (P2-TOOL-UX-4) |
| LookPackagePanel — look cards | Cards with color swatch | Good base | Fine as-is |
| Generation dialog — provider | `<select>` | Not iconic | Future icon cards (P2-TOOL-UX-5) |
| Generation dialog — aspect ratio | Buttons (unknown) | TBD | Visual ratio cards (P2-TOOL-UX-5) |

---

## Component Placement

```
apps/web/src/components/toolkit/
├── WheelSelector.tsx       ✅ implemented
└── VisualTagPicker.tsx     ✅ implemented
```

**Rules:**
- No business logic in toolkit components
- No API calls
- No Prisma / DB imports
- Keyboard accessible (buttons with type="button")
- Works in dark Tailwind canvas context
- No new external dependencies

---

## First Landing: ShotListBuilderPanel (P2-TOOL-UX-1) ✅ DONE

Replaced 5 `<select>` elements with visual controls:
- `outputMode` → `VisualTagPicker` (3 options with emoji)
- `pacing` → `VisualTagPicker` (3 options with emoji + sublabel)
- `shotSizeStrategy` → `VisualTagPicker` (4 options with emoji)
- per-shot `shotSize` → `VisualTagPicker size="sm"` (4 options)
- per-shot `duration` → pill-toggle (matches kind toggle style)

No generation payload changes. No data model changes. Type-check PASS.

---

## Recommended P2-TOOL-UX Task Queue

| ID | Tool | What to change | Difficulty |
|---|---|---|---|
| P2-TOOL-UX-1 | ShotListBuilderPanel | Replace 5 selects with VisualTagPicker | ✅ DONE |
| P2-TOOL-UX-2 | CameraLexiconPanel | Add emoji icons to term cards; optionally add WheelSelector for progression-based categories | Low |
| P2-TOOL-UX-3 | CharacterBiblePanel + SceneBiblePanel | Replace weather/era/atmosphere/role/temperament with VisualTagPicker chips | Medium |
| P2-TOOL-UX-4 | CharacterBiblePanel | Add reference image chip display (leverages CharacterReferenceGridPanel) | Medium |
| P2-TOOL-UX-5 | Generation dialog | Replace provider selector with icon cards; aspect ratio as visual ratio picker | Medium |
| P2-TOOL-UX-6 | StyleBible | Visual color palette entry instead of text | Medium |
| P2-TOOL-UX-7 | ShotListBuilderPanel | Add WheelSelector for shot duration (3s/5s/8s/10s) once more duration values supported | Low |

---

## Design Anti-Patterns (Avoid)

- **Bare `<select>` for bounded option sets** — always replace with VisualTagPicker or WheelSelector
- **Textarea for field with ≤12 common values** — use chips with free-text fallback
- **Text-only tool entry points** — every tool should have an icon/emoji identity
- **Nested dropdown menus** — flatten into visible pill rows
- **Full-form modal for simple single-value selection** — use inline pickers

---

## Compatibility Rules

All visual controls must:
1. Never change the underlying value type (same TypeScript types in/out)
2. Keep existing state variable names
3. Not affect generation payloads
4. Support keyboard Tab + Enter / Space activation (via `<button>` elements)
5. Work in the existing dark canvas CSS context without new Tailwind plugins
