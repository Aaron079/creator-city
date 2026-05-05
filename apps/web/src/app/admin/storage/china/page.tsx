import { DashboardShell } from '@/components/layout/DashboardShell'
import { getChinaStorageConfigurations, getConfiguredChinaStorageProvider } from '@/lib/storage/china/gateway'

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${configured ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
      {configured ? 'configured' : 'not-configured'}
    </span>
  )
}

export default function AdminChinaStoragePage() {
  const configs = getChinaStorageConfigurations()
  const activeProvider = getConfiguredChinaStorageProvider()

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">中国对象存储</h1>
        <p className="mt-2 text-sm text-white/50">
          当前数据库仍使用 DATABASE_URL，迁移状态 not-started。未来生成图片、视频和资产文件写入 OSS/COS。
        </p>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
          当前选择：{activeProvider} · Supabase / DATABASE_URL 仍是现有数据路径
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.values(configs).map((config) => (
            <section key={config.provider} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-white">
                  {config.provider === 'aliyun-oss' ? '阿里云 OSS' : '腾讯云 COS'}
                </div>
                <StatusBadge configured={config.configured} />
              </div>
              <div className="mt-4 text-sm text-white/50">mode: {config.mode}</div>
              <div className="mt-3 text-xs leading-6 text-white/40">
                missing: {config.missing.length > 0 ? config.missing.join(', ') : 'none'}
              </div>
            </section>
          ))}
        </div>
      </main>
    </DashboardShell>
  )
}
