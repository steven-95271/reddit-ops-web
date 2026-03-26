'use client'

import { useEffect, useState } from 'react'
import BaseLayout from '@/components/BaseLayout'
import { showToast } from '@/components/Toast'

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
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <div className="glass-card flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl mb-4">📥</div>
          <div className="stat-value" id="stat-posts">{stats?.total_posts || 0}</div>
          <div className="stat-label">今日抓取</div>
        </div>
        <div className="glass-card flex flex-col items-center text-center border-t-4 border-coral">
          <div className="w-12 h-12 rounded-2xl bg-coral/10 text-coral flex items-center justify-center text-xl mb-4">🎯</div>
          <div className="stat-value" id="stat-candidates">{stats?.total_candidates || 0}</div>
          <div className="stat-label">核心候选</div>
        </div>
        <div className="glass-card flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl mb-4">✍️</div>
          <div className="stat-value" id="stat-content">{stats?.total_content || 0}</div>
          <div className="stat-label">AI 已生成</div>
        </div>
        <div className="glass-card flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl mb-4">✅</div>
          <div className="stat-value" id="stat-approved">{(stats?.approved || 0) + (stats?.published || 0)}</div>
          <div className="stat-label">已通过审核</div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Panel */}
        <div className="lg:col-span-2 glass-card">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900">趋势分布</h2>
            {stats?.is_mock && (
              <span className="badge badge-coral animate-pulse">🧪 模拟模式</span>
            )}
          </div>
          <div className="relative h-72 flex items-center justify-center text-slate-400">
            <span className="text-4xl mb-4">📊</span>
            <p className="font-bold">暂无今日洞察，请执行流水线</p>
          </div>
        </div>

        {/* Legend */}
        <div className="glass-card">
          <h2 className="text-xl font-black text-slate-900 mb-8">关注维度</h2>
          <div className="space-y-4">
            {Object.entries(categoryNames).map(([code, name]) => (
              <div key={code} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                <div className="flex items-center gap-4">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[code] }} />
                  <div>
                    <div className="text-sm font-bold text-slate-800">{name}</div>
                  </div>
                </div>
                <span className="text-lg font-black text-slate-900">
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