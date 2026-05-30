# CN Manual Recharge — Operations Guide

## Overview

**人工充值是测试期兜底通道，不是正式主流程。**

用户通过线下转账充值，管理员在后台核对线下到账后手动审批发放 credits。正式主流程将在支付宝/微信商户资质完成后迁移为自动支付回调入账。

---

## 人工充值 vs 自动支付 — 区别

| 维度 | 人工充值（当前主通道） | 自动支付（接入中） |
|------|------------|------------|
| 用户操作 | /billing → 转账充值 → 提交申请 | /billing → 选择支付宝/微信 → 扫码支付 |
| 入账方式 | 管理员核对截图后手动审批 | webhook 回调验签 → 自动入账 |
| Admin 操作 | 必须逐笔人工点击"确认到账并发放 credits" | 仅监控、风控、异常补单 |
| Provider | `PaymentOrder.provider = 'manual'` | `PaymentOrder.provider = 'alipay'/'wechatpay'` |
| CreditLedger type | `ADMIN_ADJUSTMENT` | `PURCHASE` |
| Admin 后台入口 | `/admin/payments/china` → 上方"人工充值申请 — 待审核" | `/admin/payments/china` → 下方"自动支付 / 沙箱订单" |

---

## User Flow（人工充值）

1. 用户进入 `/billing`（或从余额不足 Modal 点击"前往转账充值"）
2. 地区切换为"中国大陆"，支付方式默认选中"转账充值"
3. 在套餐列表选择套餐，点击"提交充值申请"
4. 系统返回 `orderId`（申请编号），显示在页面上
5. 用户通过微信/支付宝/银行转账打款，备注填写 `orderId` 或注册邮箱
6. 用户联系管理员，提供申请编号和转账截图
7. 管理员在 `/admin/payments/china` 上方"人工充值申请 — 待审核"核对并点击"确认到账并发放 credits"
8. 用户刷新页面查看余额变化

---

## Admin Approval Flow

### 管理员入口

管理员后台不在普通用户导航中展示。ADMIN 用户直接访问以下路径：

| 路径 | 说明 |
|------|------|
| `/admin` | Admin Console 首页（显示待审核数量 badge） |
| `/admin/payments/china` | **主要入口**：上方人工审批 + 下方自动支付监控 |
| `/admin/credits` | Credits 管理（直接发放、历史记录） |
| `/admin/users` | 用户列表 |

### 管理员审批步骤

1. 打开 `/admin`，若"待处理充值"卡片显示 `N 待审核`，表示有 N 笔人工充值申请待处理。
2. 点击进入 `/admin/payments/china`，找到上方"人工充值申请 — 待审核"区块。
3. 在表格中找到用户提供的 `orderId`（申请编号）。
4. 核对用户发来的微信/支付宝/银行到账截图。
5. 核对金额与套餐是否吻合。
6. 点击"确认到账并发放 credits"按钮。
7. 在行内弹出的确认框中验证用户邮箱与 credits 数量。
8. 高额订单（>= 15,000 credits）显示"高额，需复核"警告，务必二次确认截图后再操作。
9. 点击"确认发放"完成操作。
10. 操作成功后行内显示绿色确认文字，列表自动刷新。
11. 如遇网络问题可点击"刷新"重新加载待处理列表。

### ⚠️ 注意：两个区块不要混淆

页面下方"自动支付 / 沙箱订单"区块展示支付宝 / 微信自动支付订单，不是人工转账申请。
- 不要在该区块中操作人工充值审批
- 沙箱模拟按钮"沙箱模拟入账"仅用于验证 webhook 链路，不影响人工审批流程

### 错误处理

- 错误订单（金额不符、已取消）：**不要点击确认**，保留 PENDING 状态，联系用户核实。
- 已审批订单（PAID）：重复点击确认不会重复发放 credits（幂等）。
- 如审批按钮报错，检查网络连接后重试，或降级到 curl 命令操作。

---

## Admin Grant API（降级方案：curl 命令）

如页面无法访问，使用以下 curl 命令：

```bash
# 按 orderId 审批（推荐，Credits 以订单记录为准）
curl -X POST https://[domain]/api/admin/credits/grant \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session cookie]" \
  -d '{
    "orderId": "[orderId]",
    "action": "approve",
    "note": "已核对到账截图"
  }'

# 响应
{ "success": true, "action": "approved" }
```

```bash
# 按邮箱直接发放（备用，Credits 数量由管理员指定）
curl -X POST https://[domain]/api/admin/credits/grant \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session cookie]" \
  -d '{
    "targetUserEmail": "user@example.com",
    "amountCredits": 1500,
    "note": "Manual recharge Starter package — orderId: [orderId]"
  }'

# 响应
{ "success": true, "userId": "...", "creditsGranted": 1500, "availableCredits": 1500 }
```

### 约束

- 需要 ADMIN 角色（数据库 `user.role = 'ADMIN'`）
- Auth: 管理员 session cookie（非 Bearer token）
- `CreditLedger` 记录 `type = ADMIN_ADJUSTMENT`（区别于自动支付的 `PURCHASE`）
- 按 orderId 审批：Credits 以 `PaymentOrder.credits` 为准，不可由请求体传入
- 按邮箱直接发放：单次最多 100,000 credits

---

## 套餐参考

| 套餐 | Credits | 参考人民币 |
|------|---------|-----------|
| Starter | 500 | ~¥50 |
| Creator | 1,500 | ~¥100 |
| Studio | 5,500 | ~¥350 |
| Team | 15,000 | ~¥900 |
| Enterprise | 50,000 | ~¥2800 |

> 人民币定价仅作内部参考，测试期无固定汇率。正式定价在 `lib/billing/packages.ts` 对应套餐的 CN Alipay price 字段中配置。

---

## 支付宝自动充值上线条件

当前支付宝后端实现已完整（RSA-SHA256 签名/验签、当面付下单、webhook 验签、`fulfillChinaPaymentOrder` 幂等入账），**阻塞仅在配置层面**：

### 必须完成的前置步骤

1. **商户资质**：在蚂蚁金服开放平台完成应用注册和商户认证
2. **获取密钥对**：下载应用私钥，获取支付宝公钥
3. **配置 Vercel 生产 env**：
   ```
   ALIPAY_APP_ID=<应用 App ID>
   ALIPAY_PRIVATE_KEY=<应用私钥（PKCS8 格式，不含头尾）>
   ALIPAY_PUBLIC_KEY=<支付宝公钥（不含头尾）>
   ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do  # 默认值，可选
   ALIPAY_NOTIFY_URL=https://creator.city/api/payment/china/webhook/alipay  # 可选
   ```
4. **前端解除 hard-lock**：删除 `PaymentMethodSelector.tsx` 中 `CN_COMING_SOON` Set 里的 `'alipay'`
5. **notify_url 可访问**：`/api/payment/china/webhook/alipay` 须可被支付宝公网访问（Vercel 生产域名）

**完成以上 5 步，无需其他后端改动，支付宝自动充值即可上线。**

### 上线后管理员职责变化

| 当前（人工） | 上线后（自动） |
|------------|------------|
| 每笔审批到账截图 | 仅监控 PAID/FAILED 订单 |
| 手动点击"确认到账并发放 credits" | webhook 自动入账，无需操作 |
| 管理员是主要流程节点 | 管理员只处理失败订单和补单 |

---

## 未来正式主流程

```
用户选择套餐 → 扫码支付（支付宝/微信）→ 支付完成
    ↓
支付宝/微信 webhook → /api/payment/china/webhook/{provider}
    ↓
verifyWebhook（RSA-SHA256 / v3 签名验证）→ valid: true
    ↓
fulfillChinaPaymentOrder(outTradeNo)
    ↓
PaymentOrder PENDING → PAID
wallet.balance += credits
CreditLedger.create(type: PURCHASE)
    ↓
用户刷新页面，credits 自动到账
```

**人工充值保留为**：企业大额转账通道 / 支付渠道故障兜底 / webhook 失败补单通道。

---

## Manual Recharge API 说明

`POST /api/credits/manual-recharge` — 创建 PENDING PaymentOrder（provider: manual）

### 请求体

```json
{
  "amountCredits": 1500,
  "note": "Billing manual recharge package: Creator"
}
```

### 响应

```json
{ "orderId": "po_xxxxxxxx", "status": "PENDING" }
```

该 `orderId` 是 `PaymentOrder.id`。管理员发放 credits 后，PaymentOrder 状态变为 `PAID`，CreditLedger 写入 `ADMIN_ADJUSTMENT` 记录。

---

## 验证到账

```sql
-- 查看用户余额
SELECT id, balance, "totalPurchased", "totalConsumed"
FROM "UserCreditWallet"
WHERE "userId" = '[userId]';

-- 查看最近发放记录
SELECT id, type, delta, balance, description, "createdAt"
FROM "CreditLedger"
WHERE "userId" = '[userId]'
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## UI 入口

| 入口 | 路径 |
|------|------|
| 充值页（直接） | `/billing?region=CN&method=manual` |
| 余额不足 Modal 按钮 | 点击"前往转账充值" → 自动跳转上方链接 |
| 充值页默认 | `/billing` → 中国大陆 → 转账充值（默认选中） |

---

## 不支持的操作

- 退款（需手动在数据库操作或新建 REFUND API）
- 微信支付自动化（stub，需实现 v3 signing + AES-GCM webhook 解密）
