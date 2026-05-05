# Creator City 中国基础设施迁移准备

本文件用于把支付中台和数据保存方向切换到中国服务商体系。当前阶段只做抽象层和迁移准备，不直接迁移 Supabase 数据，也不删除 Stripe / Paddle / Supabase / Vercel 配置。

## 推荐生产架构

- 数据库：阿里云 RDS PostgreSQL 或腾讯云 PostgreSQL。
- 对象存储：阿里云 OSS 或腾讯云 COS。
- CDN：阿里云 CDN 或腾讯云 CDN，绑定已备案域名。
- 密钥管理：阿里云 KMS / Secret Manager 或腾讯云 KMS / Secret Manager。
- 日志：阿里云日志服务 SLS 或腾讯云 CLS。
- 支付：支付宝开放平台 + 微信支付商户平台。
- 域名：中国大陆生产域名需要完成 ICP 备案。

## 迁移步骤

1. 从 Supabase 导出 PostgreSQL 数据，保留 schema、索引、枚举与约束。
2. 在阿里云 RDS PostgreSQL 或腾讯云 PostgreSQL 创建目标实例。
3. 导入 Supabase dump 到国内 RDS PostgreSQL。
4. 配置 `DATABASE_URL_CN`，先在预发环境验证连接与 Prisma schema。
5. 跑 schema 验证 SQL，重点检查 User、UserCreditWallet、CreditLedger、PaymentOrder、Project、CanvasWorkflow、CanvasNode、CanvasEdge、Asset。
6. 配置中国对象存储环境变量，选择 `CHINA_STORAGE_PROVIDER=aliyun-oss` 或 `tencent-cos`。
7. 新生成的图片、视频和资产文件逐步写入 OSS/COS，旧的 `Asset.url/dataUrl` 保持兼容。
8. 配置支付宝和微信支付商户参数，在验签打通前保持 not-configured/stub。
9. 切换 Vercel 或国内部署环境变量，确认 `DATABASE_URL`/`DATABASE_URL_CN` 的实际指向。
10. 验证用户登录、积分钱包、人工充值、项目列表、画布保存、Provider Gateway、Provider 成本后台。

## 环境变量清单

```env
DATABASE_URL_CN=

CHINA_STORAGE_PROVIDER=
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_OSS_BUCKET=
ALIYUN_OSS_REGION=
ALIYUN_OSS_ENDPOINT=

TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=

ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=
ALIPAY_RETURN_URL=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do

WECHAT_PAY_APP_ID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_CERT_SERIAL_NO=
WECHAT_PAY_NOTIFY_URL=
```

## 合规提醒

- 中国大陆生产域名需要备案。
- 用户数据、项目数据、积分账本、支付订单和对象存储应优先存储在境内。
- 日志、备份、对象存储、CDN 缓存也应境内化。
- 不要把用户敏感数据写入海外日志、第三方监控或 AI prompt。
- 支付 webhook 必须完成平台验签、幂等入账和异常审计后才能进入生产。
