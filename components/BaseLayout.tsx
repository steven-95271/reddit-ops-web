'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ToastContainer, { showToast } from '@/components/Toast'

export default function BaseLayout({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
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
    const currentPath = window.location.pathname
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.set('project_id', pid)
    router.push(`${currentPath}?${searchParams.toString()}`)
  }

  return (
    <>
      <Sidebar projectId={currentProject?.id} />
      
      <div className="flex-1 ml-52 flex flex-col min-h-screen">
        <header className="bg-transparent px-10 py-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="page-title">{title || 'Dashboard'}</h1>
            <p className="text-slate-500 text-sm font-medium animate-fade">{subtitle || '数据概览'}</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative group">
              <select
                value={currentProject?.id || ''}
                onChange={handleProjectChange}
                className="appearance-none bg-white/60 backdrop-blur-md border border-slate-200 rounded-full px-6 py-2.5 pr-10 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-coral/10 transition-all cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            <button
              onClick={() => setShowNewProject(true)}
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              +
            </button>
          </div>
        </header>

        <main className="flex-1 px-10 pb-12">
          <div className="animate-fade">{children}</div>
        </main>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-6">新建项目</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              placeholder="例如：开放式耳机出海"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">项目背景</label>
            <textarea
              value={bg}
              onChange={e => setBg(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              placeholder="简单描述业务背景..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">搜索关键词</label>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              placeholder="例如：open ear earbuds"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">抓取版块</label>
            <input
              type="text"
              value={subreddits}
              onChange={e => setSubreddits(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              placeholder="例如：headphones, earbuds, running"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 px-4 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors text-sm">
            取消
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors text-sm font-medium">
            创建项目
          </button>
        </div>
      </div>
    </div>
  )
}