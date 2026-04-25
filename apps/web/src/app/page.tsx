import { HomeLanding } from '@/components/home/HomeLanding'
import { TopNavigation } from '@/components/layout/TopNavigation'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TopNavigation />
      <HomeLanding />
    </div>
  )
}
