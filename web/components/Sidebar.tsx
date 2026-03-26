'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '📊', label: '概览', endpoint: 'dashboard' },
  { href: '/candidates', icon: '🎯', label: '池子', endpoint: 'candidates' },
  { href: '/editor', icon: '✍️', label: '编辑', endpoint: 'editor' },
  { href: '/history', icon: '📋', label: '记录', endpoint: 'history' },
]

export default function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-20 bg-white/40 backdrop-blur-xl border-r border-slate-200/50 flex flex-col items-center flex-shrink-0 fixed h-full z-20 py-8">
      <div className="mb-12">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-lg">🚀</div>
      </div>

      <nav className="flex-1 w-full px-2 space-y-4">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={`${item.href}${projectId ? `?project_id=${projectId}` : ''}`}
            className={`nav-link ${pathname === item.href ? 'nav-active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-2 w-full">
        <button className="nav-link w-full text-slate-900 hover:text-coral transition-colors">
          <span className="nav-icon">⚡</span>
          <span className="nav-label">运行</span>
        </button>
      </div>
    </aside>
  )
}