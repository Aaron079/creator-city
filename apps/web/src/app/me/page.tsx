'use client'

import { Nav } from '@/components/layout/Nav'
import { ProfileView } from '@/components/profile/ProfileView'
import { InvitationInbox } from '@/components/team/InvitationInbox'
import { useAuthStore } from '@/store/auth.store'
import { useProfileStore } from '@/store/profile.store'
import { useTeamStore } from '@/store/team.store'

export default function MePage() {
  const currentUserId = useProfileStore((s) => s.currentUserId)
  const authUser = useAuthStore((s) => s.user)
  const inboxProfileId = authUser?.id ?? currentUserId
  const invitations = useTeamStore((s) => s.getInvitationsForProfile(inboxProfileId))
  const acceptInvitation = useTeamStore((s) => s.acceptInvitation)
  const declineInvitation = useTeamStore((s) => s.declineInvitation)

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />
      <div className="space-y-6 pt-14">
        <ProfileView userId={currentUserId} />
        <div className="mx-auto max-w-6xl px-4 pb-10">
          <InvitationInbox
            invitations={invitations}
            onAccept={acceptInvitation}
            onDecline={declineInvitation}
          />
        </div>
      </div>
    </main>
  )
}
