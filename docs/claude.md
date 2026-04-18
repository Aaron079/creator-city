# Creator City 项目说明

## 当前目标
把 create 页面做成 AI 导演工作台，参考 TapNow 的工作流画布模式。

## 当前技术栈
- Next.js
- Tailwind CSS
- Vercel 部署
- 自定义 canvas 组件（nodes + edges）

## 当前已完成
- /create 页面已经成功部署
- 构建链路已打通
- 之前 ESLint 报错已逐步修复

## 下一步要做
- create 页面改成左右分栏
- 左侧：创意输入、风格选择、生成按钮
- 右侧：横向节点画布
- 节点包括：创意、编剧、导演、选角、摄影、输出

## 注意事项
- 不要乱改项目路径
- 优先修改 apps/web/src/app/create/page.tsx
- 尽量少动现有 canvas 组件内部逻辑
- 改完后确保可构建
