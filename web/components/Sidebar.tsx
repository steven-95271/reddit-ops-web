'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '📊', label: '概览', endpoint: 'dashboard' },
  { href: '/personas', icon: '👤', label: '人设', endpoint: 'personas' },
  { href: '/candidates', icon: '🎯', label: '池子', endpoint: 'candidates' },
  { href: '/editor', icon: '✍️', label: '编辑', endpoint: 'editor' },
  { href: '/history', icon: '📋', label: '记录', endpoint: 'history' },
]

export default function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-48 bg-white border-r border-[#E5E5E5] flex flex-col h-full">
      <div className="p-4 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#FF4500] rounded flex items-center justify-center text-lg font-bold text-white">R</div>
          <div className="text-sm font-semibold text-[#1A1A1B]">Reddit Ops</div>
        </div>
      </div>

      <nav className="flex-1 py-4">
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

      <div className="p-4 border-t border-[#E5E5E5]">
        <button className="btn-primary w-full flex items-center justify-center gap-2">
          <span>▶</span>
          <span>运行流水线</span>
        </button>
      </div>
    </aside>
  )
}
