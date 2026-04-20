'use client'

import { Nav } from '@/components/layout/Nav'
import { ProfileView } from '@/components/profile/ProfileView'
import { useProfileStore } from '@/store/profile.store'

export default function MePage() {
  const currentUserId = useProfileStore((s) => s.currentUserId)
  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />
      <div className="pt-14">
        <ProfileView userId={currentUserId} />
      </div>
    </main>
  )
}
