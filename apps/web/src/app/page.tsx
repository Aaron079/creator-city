import { HomeLanding } from '@/components/home/HomeLanding'
import { TopNavigation } from '@/components/layout/TopNavigation'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <TopNavigation />
      <HomeLanding />
    </div>
  )
}
