import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

type CardProps = {
  href: string
  title: string
  description: string
  badge?: string
  alertBadge?: string
}

function AdminCard({ href, title, description, badge, alertBadge }: CardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white group-hover:text-white/90">{title}</span>
        {alertBadge && (
          <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {alertBadge}
          </span>
        )}
        {!alertBadge && badge && (
          <span className="shrink-0 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-200">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">{description}</p>
    </Link>
  )
}

export default async function AdminIndexPage() {
  const user = await getCurrentUser()

  let pendingManualCount = 0
  let pendingRefundCount = 0
  if (user?.role === 'ADMIN') {
    try {
      pendingManualCount = await db.paymentOrder.count({
        where: { provider: 'manual', status: 'PENDING' },
      })
    } catch {
      // non-fatal — badge will not show count
    }
    try {
      pendingRefundCount = await db.marketplaceRefundRequest.count({
        where: { status: 'PENDING' },
      })
    } catch {
      // non-fatal
    }
  }

  if (!user) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold text-white">Creator City Admin Console</h1>
          <div className="mt-5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            请先登录管理员账户。
          </div>
        </main>
      </DashboardShell>
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold text-white">Creator City Admin Console</h1>
          <div className="mt-5 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            403：无权限访问管理员后台。
          </div>
        </main>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/30">Admin Console</div>
        <h1 className="text-2xl font-semibold text-white">Creator City Admin Console</h1>
        <p className="mt-2 text-sm text-white/50">
          独立管理员面板。用于管理充值、用户、Provider、系统健康与中国区配置。
        </p>

        <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/35">
          此页面不在普通用户导航中展示，仅管理员直接访问。当前登录：
          <span className="ml-1 text-white/55">{user.email}</span>
        </div>

        {/* Core operations */}
        <div className="mt-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">核心运营</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminCard
              href="/admin/usage"
              title="生成用量观察"
              description="BYOK 与平台额度调用量统计。基于 UsageLog，不含收费逻辑。"
              badge="只读"
            />
            <AdminCard
              href="/admin/payments/china"
              title="待处理充值"
              description="查看转账充值申请，确认到账并发放 credits。"
              alertBadge={pendingManualCount > 0 ? `${pendingManualCount} 待审核` : undefined}
              badge={pendingManualCount === 0 ? '主要入口' : undefined}
            />
            <AdminCard
              href="/admin/credits"
              title="Credits 管理"
              description="查看人工充值订单，直接给用户发放 credits。"
            />
            <AdminCard
              href="/admin/users"
              title="用户管理"
              description="查看用户列表、角色和状态。"
            />
            <AdminCard
              href="/admin/marketplace"
              title="市场管理"
              description="查看 Marketplace 订单、退款申请与执行状态。退款执行不可逆，请谨慎操作。"
              alertBadge={pendingRefundCount > 0 ? `待处理退款 ${pendingRefundCount}` : undefined}
              badge={pendingRefundCount === 0 ? 'Marketplace' : undefined}
            />
          </div>
        </div>

        {/* System & config */}
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">系统与配置</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminCard
              href="/admin/providers"
              title="Provider 管理"
              description="查看和测试 AI provider 状态与配置。"
            />
            <AdminCard
              href="/admin/billing"
              title="Billing 概览"
              description="查看订单、钱包和收入概览。"
            />
            <AdminCard
              href="/admin/china"
              title="中国区配置"
              description="DB、OSS、支付、CDN、ICP备案等配置状态。"
            />
            <AdminCard
              href="/admin/storage/china"
              title="中国对象存储"
              description="查看中国区对象存储配置（OSS/COS）。"
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminCard
              href="/admin/health"
              title="系统健康"
              description="检查系统各子模块健康状态。"
            />
          </div>
        </div>

      </main>
    </DashboardShell>
  )
}
