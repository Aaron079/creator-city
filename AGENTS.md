# Creator City Agent Rules

每次开发前必须先阅读：

- `docs/product-principles.md`
- `docs/claude.md`

任何改动都必须遵守：

1. Creator City 是专业创作系统，不是 AI 娱乐工具。
2. AI 只能辅助，不能默认替用户决策。
3. 用户必须拥有应用 / 对比 / 忽略 AI 建议的权利。
4. 所有复杂能力必须隐藏在输入框底部工具栏或轻量 panel 中。
5. 主画布必须保持干净。
6. 不得重做已完成模块。
7. 不得改动与任务无关的 `server / payment / chat / team / city` 模块。
8. 改完必须执行：
   - `cd apps/web && npx tsc --noEmit`
   - `cd apps/web && npx next build`
