'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProjectStore } from '@/store/project.store'
import { apiClient } from '@/lib/api-client'
import { getProjectStatusBadge } from '@/lib/utils'

export function ProjectGrid({ showCreateButton = false, compact = false }: {
  showCreateButton?: boolean
  compact?: boolean
}) {
  const { projects, setProjects, isLoading, setLoading } = useProjectStore()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', description: '', type: 'SHORT_FILM' })

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<typeof projects>('/projects/my')
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [setProjects, setLoading])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const project = await apiClient.post<(typeof projects)[0]>('/projects', createForm)
      useProjectStore.getState().addProject(project)
      setShowCreate(false)
      setCreateForm({ title: '', description: '', type: 'SHORT_FILM' })
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="city-card animate-pulse h-32 bg-city-surface/50" />
        ))}
      </div>
    )
  }

  const displayProjects = compact ? projects.slice(0, 3) : projects

  return (
    <div className="space-y-4">
      {showCreateButton && (
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-city-accent/10 border border-city-accent/30 text-city-accent-glow rounded-lg text-sm font-medium hover:bg-city-accent/20 transition-colors"
        >
          + New Project
        </button>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="city-card space-y-3 animate-slide-up">
          <h3 className="font-semibold">New Project</h3>
          <input
            required
            placeholder="Project title"
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-city-bg border border-city-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-city-accent"
          />
          <textarea
            required
            placeholder="Description..."
            value={createForm.description}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full bg-city-bg border border-city-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-city-accent resize-none h-20"
          />
          <select
            value={createForm.type}
            onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full bg-city-bg border border-city-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-city-accent"
          >
            {['SHORT_FILM','FEATURE_FILM','WEB_SERIES','DOCUMENTARY','ANIMATION','MUSIC_VIDEO'].map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-city-accent text-white rounded-lg text-sm font-medium hover:bg-city-accent-glow transition-colors">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-city-border text-gray-400 rounded-lg text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {displayProjects.length === 0 ? (
        <div className="city-card text-center py-12 text-gray-500">
          <div className="text-3xl mb-2">🎬</div>
          <p>No projects yet. Create your first one!</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {displayProjects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <div className="city-card hover:glow cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm line-clamp-1">{project.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getProjectStatusBadge(project.status)}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{project.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>🎥 {project.type.replace('_', ' ')}</span>
                  <span>👁 {project.views}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
