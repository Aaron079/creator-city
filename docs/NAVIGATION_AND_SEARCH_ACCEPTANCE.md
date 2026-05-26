# Creator City Navigation & Search Acceptance Rules

## 1. 当前已确认的顶部主导航

当前顶部主导航必须保持为：

- 创作
- 市场
- 工作台
- 平台
- 社区与帮助

Creator City 品牌入口必须保留在左侧，用户账户区域必须保留在右侧。

## 2. 已删除/禁止重新加入的顶部独立按钮

以下按钮已验收删除，不得重新作为顶部独立按钮加入：

- Quick Open
- Projects 独立按钮
- Notifications / 铃铛独立按钮
- Explore 大杂烩按钮
- 企业版预览独立按钮

如果未来确实需要恢复，必须先说明：
- 实际用途
- 用户价值
- 为什么不能归入现有主导航子菜单
- 是否会造成导航拥挤
- 是否会影响 /create 或生成链路

## 3. 子导航归类规则

创作：
- AI 画布 -> /create
- Canvas V2 -> 保持现有安全入口逻辑
- 生成任务 -> /tasks
- API 中心 -> /providers

市场：
- 市场总览 -> /marketplace-preview
- 创作者主页 -> /creator-profile-preview
- 需求广场 -> /demand-board-preview
- 报价方案 -> /proposal-flow-preview
- 阶段交付 -> /milestone-delivery-preview
- 托管结算 -> /escrow-preview

工作台：
- 项目中心 -> /projects
- 资产中心 -> /assets
- Dashboard -> /dashboard
- 任务相关入口如存在，归入工作台或创作，不得重复顶级显示

平台：
- 路线图 -> /roadmap
- 商业模式 -> /pricing-preview
- 协议版权 -> /terms-preview
- 本地部署 -> /local-deploy-preview
- 企业版 -> /enterprise-preview

社区与帮助：
- 社区 -> /community
- 诊断帮助 -> /help

禁止加入不存在页面，例如：
- /about

## 4. 首页市场主链路规则

首页 Hero 下方必须清晰显示"创作者市场"入口区块，至少包含：

- 市场总览 -> /marketplace-preview
- 创作者主页 -> /creator-profile-preview
- 需求广场 -> /demand-board-preview
- 报价方案 -> /proposal-flow-preview
- 阶段交付 -> /milestone-delivery-preview
- 托管结算 -> /escrow-preview

用户不能依赖 Explore 或隐藏菜单才能找到这些入口。

## 5. 搜索入口规则

顶部用户区前必须保留搜索入口。

搜索必须满足：
- 只使用本地静态数组
- 不 fetch
- 不调用 API
- 不写数据库
- 不写 localStorage
- 不写 cookie
- 不触发生成
- 不触发 canvas PUT/PATCH
- 不调用 media proxy
- 不加入不存在页面
- 搜索结果只能跳转已有页面

搜索必须至少支持这些关键词：
- 画布 / 生成 / canvas
- 市场 / 创作者
- 需求 / brief
- 报价 / 方案
- 阶段 / 交付 / 里程碑
- 托管 / 结算
- 项目 / 资产
- 路线图 / 商业模式 / 协议
- 社区 / 帮助

## 6. 用户账户区域规则

用户头像只显示：
- 用户名首字
- 中文首字
- 邮箱首字
- 无数据时显示 U

禁止：
- 显示完整 UUID
- 显示过长邮箱撑开导航
- 让账户区域挤压主导航
- 把通知铃铛重新作为独立顶级按钮

用户名称如果显示，必须 max-width + truncate。

## 7. Hover Dropdown 规则

所有主导航 dropdown 必须：
- 鼠标进入按钮时展开
- 鼠标进入菜单时保持
- 鼠标移出后约 150ms 关闭
- 不遮挡异常
- z-index 高于页面内容
- 文字横向正常显示，不竖排
- 暗色玻璃风格但可读性足够
- 移动端不崩

## 8. 禁止事项

导航和搜索相关任务禁止修改：

- apps/web/src/components/create/**
- apps/web/src/app/create/**
- apps/web/src/app/api/**
- apps/cn-executor/**
- apps/web/src/app/api/media/proxy/**
- 任何 generate route
- 任何 canvas API
- provider fallback
- auth/session helper
- package.json
- pnpm-lock.yaml
- 配置文件

禁止行为：
- 删除页面文件
- 删除路由文件
- 接入支付
- 创建订单
- 写数据库
- 触发生成
- 修改生成 payload
- 修改 media proxy
- 修改 cn-executor

## 9. 未来导航修改前置检查

任何未来导航修改前，必须先回答：

1. 这个入口属于创作、市场、工作台、平台、社区与帮助中的哪一类？
2. 是否已有同类入口？
3. 是否会造成顶部导航拥挤？
4. 是否可以放入子导航而不是新增顶级按钮？
5. 是否页面真实存在？
6. 是否会触发 API / 生成 / DB / 支付？
7. 是否会影响 /create？
8. 是否会影响图片/视频生成节点？
9. 是否会影响 media proxy？
10. 是否会影响 cn-executor？

## 10. 浏览器验收清单

每次导航或搜索相关修改后，必须浏览器确认：

1. 首页能看到"创作者市场"6 张入口卡片。
2. 顶部主导航只保留：创作 / 市场 / 工作台 / 平台 / 社区与帮助。
3. Quick Open / Projects / Notifications / Explore / 企业版预览 不作为顶部独立按钮出现。
4. Hover 市场可看到完整市场链路。
5. Hover 工作台可看到项目、资产、Dashboard 等入口。
6. Hover 平台可看到路线图、商业模式、协议版权、本地部署、企业版。
7. Hover 社区与帮助可看到社区和诊断帮助。
8. 搜索"需求 / 报价 / 托管 / 项目 / 画布"能找到对应入口。
9. 用户头像不显示长 UUID。
10. /create 图片和视频节点仍正常。
11. Network 无异常 generate、canvas、media proxy、POST/PUT/PATCH。
