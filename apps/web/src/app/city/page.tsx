'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { CityMap } from '@/components/city/CityMap'

export default function CityPage() {
  return (
    <DashboardShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">City Map</h1>
          <p className="text-gray-400 mt-1">Explore the creative city and visit other bases.</p>
        </div>
        <CityMap />
      </div>
    </DashboardShell>
  )
}
