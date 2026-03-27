'use client'

import { useEffect, useState } from 'react'
import BaseLayout from '@/components/BaseLayout'
import ProjectSetupWizard from '@/components/ProjectSetupWizard'
import { showToast } from '@/components/Toast'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  background_info: string
  search_query: string
  subreddits: string[]
  created_at: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [showWizard, setShowWizard] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (e) {
      showToast('加载项目失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProjectComplete = (projectId: string) => {
    setShowWizard(false)
    loadProjects()
  }

  const handleRunMigration = async () => {
    try {
      const res = await fetch('/api/migrate', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        showToast('数据库迁移成功', 'success')
        loadProjects()
      } else {
        showToast('迁移失败: ' + data.error, 'error')
      }
    } catch (e) {
      showToast('迁移请求失败', 'error')
    }
  }

  return (
    <BaseLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-dark-text">📁 项目管理</h1>
            <p className="text-dark-muted mt-1">管理你的内容运营项目</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRunMigration}
              className="px-4 py-2 bg-dark-border hover:bg-dark-hover text-dark-text rounded-lg text-sm"
            >
              🔧 数据库迁移
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-reddit-orange hover:bg-[#E63E00] text-white rounded-lg font-medium"
            >
              + 新建项目
            </button>
          </div>
        </div>

        {/* Project List */}
        {isLoading ? (
          <div className="text-center py-12 text-dark-muted">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-dark-text mb-2">暂无项目</h3>
            <p className="text-dark-muted mb-4">创建你的第一个内容运营项目</p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-6 py-2 bg-reddit-orange hover:bg-[#E63E00] text-white rounded-lg font-medium"
            >
              创建项目
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="reddit-panel p-6 hover:border-reddit-orange/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                      <span>📁</span>
                      {project.name}
                    </h3>
                    {project.background_info && (
                      <p className="text-dark-muted text-sm mt-1 line-clamp-2">
                        {project.background_info}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-dark-muted">
                      {project.subreddits && project.subreddits.length > 0 && (
                        <span>
                          📮 {project.subreddits.slice(0, 3).join(', ')}
                          {project.subreddits.length > 3 && ` +${project.subreddits.length - 3}`}
                        </span>
                      )}
                      <span>🕐 {new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard?project_id=${project.id}`}
                      className="px-4 py-2 bg-reddit-orange/20 hover:bg-reddit-orange/30 text-reddit-orange rounded-lg text-sm font-medium"
                    >
                      进入 →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup Wizard Modal */}
      {showWizard && (
        <ProjectSetupWizard
          onComplete={handleProjectComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </BaseLayout>
  )
}