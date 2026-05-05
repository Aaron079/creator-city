import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getChinaInfrastructureStatus } from '@/lib/china/status'

function badge(status: string) {
  if (status.includes('configured') && !status.includes('not-configured')) {
    return 'bg-emerald-400/15 text-emerald-200'
  }
  if (status.includes('overseas') || status.includes('not-started')) {
    return 'bg-amber-400/15 text-amber-200'
  }
  return 'bg-white/10 text-white/55'
}

function StatusCard({
  title,
  status,
  missing,
  nextStep,
  detail,
}: {
  title: string
  status: string
  missing: string[]
  nextStep: string
  detail?: string
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {detail ? <p className="mt-2 text-xs leading-5 text-white/42">{detail}</p> : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${badge(status)}`}>{status}</span>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/30">Missing Variables</div>
      <div className="mt-2 text-sm leading-6 text-white/55">
        {missing.length > 0 ? missing.join(', ') : 'none'}
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/30">Next Step</div>
      <p className="mt-2 text-sm leading-6 text-white/62">{nextStep}</p>
    </section>
  )
}

export default async function AdminChinaPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-semibold text-white">中国化配置中心</h1>
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
        <main className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-semibold text-white">中国化配置中心</h1>
          <div className="mt-5 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            403：仅管理员可访问。
          </div>
        </main>
      </DashboardShell>
    )
  }

  const status = getChinaInfrastructureStatus()

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">China Infrastructure</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">中国化配置中心</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
              统一查看国内数据库、对象存储、支付、CDN、备案、KMS 和日志配置状态。页面只显示变量名和缺失项，不显示任何密钥值。
            </p>
          </div>
          <Link
            href="https://github.com/Aaron079/creator-city/blob/main/docs/china-infra-migration.md"
            className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:text-white"
          >
            迁移步骤
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] p-5 text-sm text-white/55">
          迁移状态：<span className="text-white">{status.migration.status}</span>
          <span className="mx-2 text-white/25">·</span>
          文档：{status.migration.documentPath}
          <p className="mt-2 leading-6 text-white/50">{status.migration.nextStep}</p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatusCard
            title="数据库"
            status={status.database.status}
            missing={status.database.missing}
            nextStep={status.database.nextStep}
            detail={`activeEnv: ${status.database.activeEnv ?? 'none'} · chinaReady: ${status.database.chinaReady ? 'true' : 'false'}`}
          />
          <StatusCard
            title="对象存储"
            status={status.storage.status}
            missing={status.storage.missing}
            nextStep={status.storage.nextStep}
            detail={`provider: ${status.storage.provider}`}
          />
          <StatusCard
            title="支付宝"
            status={status.payments.alipay.status}
            missing={status.payments.alipay.missing}
            nextStep={status.payments.alipay.nextStep}
          />
          <StatusCard
            title="微信支付"
            status={status.payments.wechatpay.status}
            missing={status.payments.wechatpay.missing}
            nextStep={status.payments.wechatpay.nextStep}
          />
          <StatusCard
            title="CDN"
            status={status.compliance.cdn.status}
            missing={status.compliance.cdn.missing}
            nextStep={status.compliance.cdn.nextStep}
          />
          <StatusCard
            title="域名备案"
            status={status.compliance.icp.status}
            missing={status.compliance.icp.missing}
            nextStep={status.compliance.icp.nextStep}
          />
          <StatusCard
            title="KMS / Secret Manager"
            status={status.compliance.kms.status}
            missing={status.compliance.kms.missing}
            nextStep={status.compliance.kms.nextStep}
          />
          <StatusCard
            title="日志服务"
            status={status.compliance.logs.status}
            missing={status.compliance.logs.missing}
            nextStep={status.compliance.logs.nextStep}
          />
        </div>
      </main>
    </DashboardShell>
  )
}
