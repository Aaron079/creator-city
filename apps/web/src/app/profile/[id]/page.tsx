'use client'

import { use } from 'react'
import { Nav } from '@/components/layout/Nav'
import { ProfileView } from '@/components/profile/ProfileView'

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />
      <div className="pt-14">
        <ProfileView userId={id} />
      </div>
    </main>
  )
}
