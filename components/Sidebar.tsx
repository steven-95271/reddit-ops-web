'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const workflowItems = [
  { href: '/workflow/config', icon: '⚙️', label: 'P1 配置', step: 'P1' },
  { href: '/workflow/scraping', icon: '🔍', label: 'P2 抓取', step: 'P2' },
  { href: '/workflow/analysis', icon: '📊', label: 'P3 分析', step: 'P3' },
  { href: '/workflow/persona', icon: '🎭', label: 'P4-1 人设', step: 'P4-1' },
  { href: '/workflow/content', icon: '✍️', label: 'P4-2 创作', step: 'P4-2' },
  { href: '/workflow/publish', icon: '✅', label: 'P5 发布', step: 'P5' },
]

const auxiliaryItems = [
  { href: '/dashboard', icon: '📈', label: '仪表盘' },
  { href: '/history', icon: '📋', label: '历史' },
]

export default function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/history') return pathname === '/history'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('[Sidebar] Failed to logout:', error)
    } finally {
      router.replace('/login')
      router.refresh()
      setIsLoggingOut(false)
    }
  }

  return (
    <aside className="w-52 bg-white/60 backdrop-blur-xl border-r border-slate-200/50 flex flex-col flex-shrink-0 fixed h-full z-20">
      <div className="px-5 py-6 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-lg shadow-lg">🚀</div>
          <div>
            <div className="text-sm font-black text-slate-900">Reddit Ops</div>
            <div className="text-[10px] text-slate-400 font-medium">内容运营系统</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">工作流</div>
          <div className="space-y-1">
            {workflowItems.map(item => (
              <Link
                key={item.href}
                href={`${item.href}${projectId ? `?project_id=${projectId}` : ''}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">辅助</div>
          <div className="space-y-1">
            {auxiliaryItems.map(item => (
              <Link
                key={item.href}
                href={`${item.href}${projectId ? `?project_id=${projectId}` : ''}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-200/50 px-3 py-4">
        <button
          className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          {isLoggingOut ? '退出中...' : '退出登录'}
        </button>
      </div>
    </aside>
  )
}
