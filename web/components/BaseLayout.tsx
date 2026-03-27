'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ToastContainer, { showToast } from '@/components/Toast'

export default function BaseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [showNewProject, setShowNewProject] = useState(false)

  useState(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || [])
        if (data.projects?.length > 0) {
          setCurrentProject(data.projects[0])
        }
      })
  })

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value
    const project = projects.find(p => p.id === pid)
    setCurrentProject(project)
    router.push(`/dashboard?project_id=${pid}`)
  }

  return (
    <>
      <div className="flex min-h-screen bg-[#F6F7F8]">
        <Sidebar projectId={currentProject?.id} />
        
        <div className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
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
              onClick={() => setShowNewProject(true)}
              className="btn-primary text-sm"
            >
              + 新建项目
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6 max-w-[1400px]">
            {children}
          </main>
        </div>
      </div>

      <ToastContainer />

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
    </>
  )
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [bg, setBg] = useState('')
  const [query, setQuery] = useState('')
  const [subreddits, setSubreddits] = useState('')

  const handleSubmit = async () => {
    if (!name) {
      showToast('项目名称不能为空', 'error')
      return
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          background_info: bg,
          search_query: query || 'open ear earbuds',
          subreddits: subreddits.split(',').map(s => s.trim()).filter(Boolean)
        })
      })

      if (res.ok) {
        const data = await res.json()
        showToast('项目创建成功！', 'success')
        router.push(`/dashboard?project_id=${data.project_id}`)
        onClose()
      }
    } catch (e) {
      showToast('创建失败', 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">新建项目</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="reddit-input"
              placeholder="例如：开放式耳机出海"
            />
          </div>
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">项目背景</label>
            <textarea
              value={bg}
              onChange={e => setBg(e.target.value)}
              rows={3}
              className="reddit-input"
              placeholder="简单描述业务背景..."
            />
          </div>
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">搜索关键词</label>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="reddit-input"
              placeholder="例如：open ear earbuds"
            />
          </div>
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">抓取版块</label>
            <input
              type="text"
              value={subreddits}
              onChange={e => setSubreddits(e.target.value)}
              className="reddit-input"
              placeholder="例如：headphones, earbuds, running"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button onClick={handleSubmit} className="btn-primary flex-1">
            创建项目
          </button>
        </div>
      </div>
    </div>
  )
}
