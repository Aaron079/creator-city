# 交付引用记录：本地验收

日期：2026-10-12

更新：用户随后授权“检查后，不足的地方补写，进行试用，没问题后推送和部署”。以下本地记录保留为首轮证据；发布复核见文末。

结论：首项实现及本地验证通过；真实数据库保存回读未完成，不宣称线上整体验收通过。未提交、推送或部署，未启动付费生成。

Confirmed experience impact: none

## 改动范围

- 新增 `apps/web/src/lib/spatial-previs/delivery-provenance.ts`。
- `delivery.ts` 仅增加导入、可选类型字段及快照构建调用三处。
- 新增数据测试 `delivery-provenance.test.ts` 与浏览器测试 `SpatialPrevisDelivery.test.tsx`。
- 主画布、导演台组件、按钮、轨道、LIVE、导出视频、生成 API、登录、数据库配置和依赖均未修改。
- `delivery.ts` 原有 geometry/imageDrafts/analysisAssetIds 深拷贝修改保留。与实施前完整 tracked diff 对比，仅 delivery.ts 有业务增量；测试生成的 tsbuildinfo 已还原到实施前内容。

## 实现边界

交付包仍为 v1，新 provenance 清单独立标为 v1，并保持可选以兼容旧包。清单记录参考资产身份与来源、资产集、人物轨道 ID、场景确认时间、多机位切点区间、灯光配方版本及已有几何摘要。

普通参考图没有可信内容版本，明确为 `contentVersion: null` / `unverified`。人物与参考图缺少实体映射，明确为 unresolved。无多机位节目时记录已有两套相机计划，不把临时选中机位误记成已导出镜头；节拍和轨道关键帧不充当剪辑切点。

已有几何摘要只被记录，本轮没有重新下载并校验远端文件。新 provenance 不复制签名 URL；原交付包原有 reference URL 字段保持原样，因此这不是整个文件的敏感 URL 清理功能，也不是远端素材永久备份。

## 验证结果

证据目录：`.superpowers/qa/director-provenance-20261012/`。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 新增测试红灯 | 8 项因缺少 provenance 失败 | red.log |
| 数据层绿灯 | 41 项通过 | green.log |
| 导演台、Studio、Viewport、交付、持久化组合回归 | 140 项通过，包含上行 41 项，不重复累计 | regression.log |
| 实际交付按钮及桌面/手机布局测试 | 2 项通过 | browser.log |
| 画布布局、右键序列、视频可靠性边界 | 25 项通过 | locks.log |
| 体验锁校验器测试 | 15 项通过 | node --test scripts/verify-confirmed-experience-locks.test.mjs |
| 体验锁注册检查 | 8 个锁通过 | pnpm experience:check |
| TypeScript | 通过 | typecheck.log |
| Next production build | 通过，保留仓库既有非阻断 warnings | build.log |

浏览器测试使用真实 DirectorPanel 与从现有 VisualCanvasWorkspace 提取的原样交付回调。真实点击“生成预演节点”“下载交付包”“保存到素材库”：节点 metadata、下载 JSON 和本地测试 HTTP 资产回读内容一致；增加人物后旧节点及旧资产保持原快照；刷新后本地节点可读；保存失败没有覆盖先前资产；未触发生成请求。

该测试替代了 createNode 的完整画布实现及数据库后端，使用 localStorage 和临时 JSON 文件。不能视为已认证生产/Preview 数据库读写证据。真实 mapCanvasNode / serializeAsset 的 metadata 保留另由数据测试验证。

桌面 1440x1100、手机 390x844 对比：每个 button/input/select/tab 的文字、标签及矩形位置尺寸完全一致。总览和 LIVE 各自完成 WebGL 像素多样性检查后再截图，避免空白首帧。截图为 `1440-baseline.png`、`1440-current.png`、`390-baseline.png`、`390-current.png`；手机初始视口沿用原有可滚动面板布局，不因本轮改造。

下载实物：`spatial-previs-delivery.json`。本地 HTTP 回读实物：`local-asset-readback.json`。这些均为测试合成数据，不是用户资产。

## 尚未验证

在该工作区启动 Next 服务进行完整应用连接检查时，Prisma 明确报 `Environment variable not found: DATABASE_URL`。工作区仅有环境配置示例文件。为遵守本轮不改数据库、登录及部署的边界，已停止该临时 Next 服务，没有借用其它运行项目的数据库配置、复制凭据或绕过认证。

下一步只需在已配置且获授权的环境中，使用测试项目从完整画布创建交付节点、保存交付资产，刷新并通过已认证 API 读回验证；节点与资产均需保留 provenance。这一步完成前，不提交首项为线上最终验收，不提前扩大到下一项功能。

## 复核

完成范围、兼容、字段白名单、快照隔离、切点边界和失败行为的自查，未发现本轮代码阻断问题。无可用独立子代理审查工具，因此不声称已通过独立人工或子代理复核。现存白模质量问题与用户场景还原验收不属于本轮结论。

## 独立发布复核

发布基线：`5f8f7ce6eaef9f07e5fc61f0001f28d69c4072cd`，原分支 `codex/seedance-spatial-previs-p0`，仅 Preview。

为避免把未完成白模工作一起发布，使用 Git 已发布内容创建临时源码包，只叠加本项生产代码、测试和文档。没有打包整个脏工作区。

复核确实发现并修复两处问题：

1. provenance 直接使用未发布的 scene.geometry/confirmedAt 和 light.rig 类型，干净基线 TypeScript 失败。改为本模块的可选元数据兼容视图，不引入白模草稿模块、不修改共享状态类型。
2. 干净基线浅拷贝附加场景元数据会让 deep-freeze 连带冻结可编辑原状态。隔离性测试复现 `Cannot assign to read only property 'sha256'` 后，补为场景深拷贝；工作区原有白模改动仍保留、不一起发布。

独立发布包验证：39 项数据测试、87 项浏览器/导演台回归、25 项画布及视频边界检查，共 151 项通过；类型检查及 Next 构建通过。干净基线的原 7 个体验锁检查通过；工作区额外的未提交锁记录没有被回滚或改写。证据在 `.superpowers/qa/director-provenance-20261012/release/`。

原 Vercel 项目经 CLI 验证可访问，项目 `prj_I2m11p7CA1BUNFiAxJfPDgfMnUOg`，团队 `aarons-projects-e26427fd`。连接器仍报 403，但 CLI 与已登录浏览器可用。Preview Secret 在云端有配置，本地 env pull 得到空值，因此不把本地缺值误报成线上数据库配置丢失，不复制或改动云端密钥。

真实 Preview 已创建独立测试项目 `2644ebbc-9968-4974-a737-0425ba2f81b5`，标题“QA 交付引用独立验收 2026-10-12”。通过原有 UI 创建地面、人物、旧版交付节点，保存素材与预演，页面返回成功。尚需新版本发布后的刷新、下载内容及云端保存回读核验；当前段落不作为新版本线上通过结论。

### 真实试用追加修复

刷新后主动选择服务器版本，旧交付节点仍可恢复；独立资产详情也读回旧版交付 JSON。试用发现原保存回调把 JSON 正文写入 dataUrl，详情页下载链接因此不是有效文件 URL。这不是元数据丢失，但会影响实际下载。

只修改预演保存回调的一行，编码为 application/json 的 UTF-8 data URL，保留 metadataJson 中原始交付快照。不改资产中心界面、数据库结构、登录或用户旧资产。旧测试资产原样保留作为兼容性证据。

浏览器回归先增加有效 data URL 及实际下载内容断言，旧实现复现失败；修复后两项浏览器测试通过，保存后下载的 JSON 与节点/直接下载内容完全一致。类型检查通过。证据：`/tmp/director-asset-download-red.log`、`/tmp/director-asset-download-green.log`。部署后的最终证据另存本地 QA 目录，避免仅为补记验收报告再次触发部署。
