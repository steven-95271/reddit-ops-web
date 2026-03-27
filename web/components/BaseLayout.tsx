'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import ToastContainer, { showToast } from '@/components/Toast'
import ProjectSetupWizard from '@/components/ProjectSetupWizard'

export default function BaseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || [])
        if (data.projects?.length > 0) {
          setCurrentProject(data.projects[0])
        }
      })
  }, [])

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value
    const project = projects.find(p => p.id === pid)
    setCurrentProject(project)
    router.push(`/dashboard?project_id=${pid}`)
  }

  const handleWizardComplete = (projectId: string) => {
    setShowWizard(false)
    // Refresh projects list
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || [])
        const newProject = data.projects?.find((p: any) => p.id === projectId)
        if (newProject) {
          setCurrentProject(newProject)
          router.push(`/dashboard?project_id=${projectId}`)
        }
      })
  }

  return (
    <>
      <div className="flex h-screen bg-dark-bg">
        <Sidebar projectId={currentProject?.id} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-dark-card border-b border-dark-border px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <select
                value={currentProject?.id || ''}
                onChange={handleProjectChange}
                className="reddit-select text-sm"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowWizard(true)}
              className="btn-primary text-sm"
            >
              + 新建项目
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      <ToastContainer />

      {showWizard && (
        <ProjectSetupWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </>
  )
}
