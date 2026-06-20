import { redirect } from 'next/navigation'

// /create-v2 was the legacy XYFlow canvas — removed 2026-06-20.
// /create (VisualCanvasWorkspace) is the sole production canvas.
export default function LegacyCreateV2Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  // Preserve projectId if present so bookmark/deep-links still land on correct project.
  const projectId = typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  if (projectId) {
    redirect(`/create?projectId=${encodeURIComponent(projectId)}`)
  }
  redirect('/create')
}
