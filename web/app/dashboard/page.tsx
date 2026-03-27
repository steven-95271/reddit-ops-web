'use client'

import { useEffect, useState } from 'react'
import BaseLayout from '@/components/BaseLayout'
import { showToast } from '@/components/Toast'
import ScrapePanel from '@/components/ScrapePanel'

const categoryColors: Record<string, string> = {
  A: '#ff7e67', B: '#4fd1c5', C: '#f59e0b', D: '#8b5cf6', E: '#10b981'
}

const categoryNames: Record<string, string> = {
  A: '深度测评', B: '场景痛点', C: '观点争议', D: '竞品KOL', E: '平台趋势'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [date, setDate] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('project_id') || 'default-project-1'
    const d = params.get('date') || new Date().toISOString().split('T')[0]
    setProjectId(pid)
    setDate(d)
    
    loadDashboard(pid, d)
  }, [])

  const loadDashboard = async (pid: string, d: string) => {
    try {
      const res = await fetch(`/api/stats?project_id=${pid}&date=${d}`)
      const data = await res.json()
      setStats(data)
    } catch (e) {
      showToast('加载数据失败', 'error')
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = e.target.value
    window.location.href = `/dashboard?project_id=${projectId}&date=${newDate}`
  }

  return (
    <BaseLayout>
      {/* Scrape Panel Button */}
      <div className="mb-6">
        <ScrapePanel projectId={projectId} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-[#F6F7F8] flex items-center justify-center text-lg mb-3">📥</div>
          <div className="stat-value text-2xl">{stats?.total_posts || 0}</div>
          <div className="stat-label">今日抓取</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center border-t-4 border-[#FF4500]">
          <div className="w-10 h-10 rounded-lg bg-[#FF4500]/10 text-[#FF4500] flex items-center justify-center text-lg mb-3">🎯</div>
          <div className="stat-value text-2xl">{stats?.total_candidates || 0}</div>
          <div className="stat-label">核心候选</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-[#F6F7F8] flex items-center justify-center text-lg mb-3">✍️</div>
          <div className="stat-value text-2xl">{stats?.total_content || 0}</div>
          <div className="stat-label">AI 已生成</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-[#F6F7F8] flex items-center justify-center text-lg mb-3">✅</div>
          <div className="stat-value text-2xl">{(stats?.approved || 0) + (stats?.published || 0)}</div>
          <div className="stat-label">已通过审核</div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Panel */}
        <div className="lg:col-span-2 reddit-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1A1A1B]">趋势分布</h2>
            {stats?.is_mock && (
              <span className="badge badge-orange animate-pulse">🧪 模拟模式</span>
            )}
          </div>
          <div className="h-64 flex flex-col items-center justify-center text-[#787C7E]">
            <span className="text-4xl mb-4">📊</span>
            <p className="font-medium">暂无今日洞察，请执行流水线</p>
          </div>
        </div>

        {/* Legend */}
        <div className="reddit-panel p-6">
          <h2 className="text-lg font-bold text-[#1A1A1B] mb-6">关注维度</h2>
          <div className="space-y-3">
            {Object.entries(categoryNames).map(([code, name]) => (
              <div key={code} className="flex items-center justify-between p-3 bg-[#F6F7F8] rounded-lg hover:bg-[#E5E5E5] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[code] }} />
                  <div>
                    <div className="text-sm font-medium text-[#1A1A1B]">{name}</div>
                  </div>
                </div>
                <span className="text-base font-bold text-[#1A1A1B]">
                  {stats?.category_counts?.[code] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}