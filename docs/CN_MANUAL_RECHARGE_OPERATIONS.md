# CN Manual Recharge — Operations Guide

## Overview

测试期充值方式。用户通过线下转账充值，管理员在后台确认到账后手动发放 credits。

---

## User Flow

1. 用户进入 `/billing`（或从余额不足 Modal 点击"前往转账充值"）
2. 地区切换为"中国大陆"，支付方式默认选中"转账充值"
3. 在套餐列表选择套餐，点击"购买"提交申请
4. 系统返回 `orderId`（申请编号），显示在页面上
5. 用户通过微信/支付宝/银行转账打款，备注填写 `orderId` 或注册邮箱
6. 用户联系管理员，提供申请编号和转账截图
7. 管理员在 `/admin/payments/china` 确认到账，点击"确认到账并发放 credits"
8. 用户刷新页面查看余额变化

---

## Admin Approval Flow（推荐：页面操作）

### 管理员入口

管理员后台不在普通用户导航中展示。ADMIN 用户直接访问以下路径：

| 路径 | 说明 |
|------|------|
| `/admin` | Admin Console 首页，列出所有管理入口 |
| `/admin/payments/china` | 待处理充值申请（主要入口） |
| `/admin/credits` | Credits 管理（直接发放） |
| `/admin/users` | 用户列表 |

### 管理员审批步骤

1. 打开 `/admin`（Admin Console 首页），或直接访问 `/admin/payments/china`（需登录 ADMIN 账户）。
2. 在"人工充值申请 — 待审核"表格中找到用户提供的 `orderId`（申请编号）。
3. 核对用户发来的微信/支付宝/银行到账截图。
4. 核对金额与套餐是否吻合。
5. 点击"确认到账并发放 credits"按钮。
6. 在弹出的确认提示中验证用户邮箱与 credits 数量。
7. 高额订单（>= 15,000 credits）会显示"高额，需复核"警告，务必二次确认截图。
8. 点击"确认发放"完成操作。
9. 操作成功后行内显示绿色确认文字，列表自动刷新。
10. 如遇网络问题可点击"刷新"重新加载待处理列表。

### 错误处理

- 错误订单（金额不符、已取消）：**不要点击确认**，保留 PENDING 状态，联系用户核实。
- 已审批订单（PAID）：重复点击确认不会重复发放 credits（幂等）。
- 如审批按钮报错，检查网络连接后重试，或降级到 curl 命令操作。

---

## Admin Grant API（降级方案：curl 命令）

如页面无法访问，使用以下 curl 命令：

```bash
# 按 orderId 审批（推荐，Credits 以订单记录为准，不传入 amount）
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
- `CreditLedger` 记录 `type = ADMIN_ADJUSTMENT`
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

## Manual Recharge API 说明

`POST /api/credits/manual-recharge` — 创建 PENDING PaymentOrder

### 请求体

```json
{
  "amountCredits": 1500,
  "note": "Billing manual recharge package: Creator"
}
```

### 响应

```json
{ "orderId": "po_xxxxxxxx" }
```

该 `orderId` 是 `PaymentOrder.id`，状态为 `PENDING`。管理员发放 credits 后，`PaymentOrder` 状态仍为 `PENDING`（credits 通过独立的 `ADMIN_ADJUSTMENT` ledger 发放，不自动 fulfill）。

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

- 自动到账确认（需手动 curl）
- 退款（需手动在数据库操作）
- 微信/支付宝自动化（需配置商户资质，见 Phase 3B）
