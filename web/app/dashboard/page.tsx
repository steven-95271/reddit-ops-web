'use client'

import { useEffect, useState } from 'react'
import BaseLayout from '@/components/BaseLayout'
import { showToast } from '@/components/Toast'
import ScrapePanel from '@/components/ScrapePanel'
import ScrapeStatus from '@/components/ScrapeStatus'
import ScoringExplanation from '@/components/ScoringExplanation'
import KeywordGenerator from '@/components/KeywordGenerator'

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
  const [refreshKey, setRefreshKey] = useState(0)
  const [scrapeStatusKey, setScrapeStatusKey] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('project_id') || 'default-project-1'
    const d = params.get('date') || new Date().toISOString().split('T')[0]
    setProjectId(pid)
    setDate(d)
    
    loadDashboard(pid, d)
  }, [refreshKey])

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

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <BaseLayout>
      {/* Scrape Panel Button */}
      <div className="mb-6">
        <ScrapePanel projectId={projectId} onScrapeComplete={() => setScrapeStatusKey(k => k + 1)} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-dark-hover flex items-center justify-center text-lg mb-3">📥</div>
          <div className="stat-value text-2xl">{stats?.total_posts || 0}</div>
          <div className="stat-label">今日抓取</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center border-t-4 border-reddit-orange">
          <div className="w-10 h-10 rounded-lg bg-reddit-orange/10 text-reddit-orange flex items-center justify-center text-lg mb-3">🎯</div>
          <div className="stat-value text-2xl">{stats?.total_candidates || 0}</div>
          <div className="stat-label">核心候选</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-dark-hover flex items-center justify-center text-lg mb-3">✍️</div>
          <div className="stat-value text-2xl">{stats?.total_content || 0}</div>
          <div className="stat-label">AI 已生成</div>
        </div>
        <div className="reddit-panel p-4 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-dark-hover flex items-center justify-center text-lg mb-3">✅</div>
          <div className="stat-value text-2xl">{(stats?.approved || 0) + (stats?.published || 0)}</div>
          <div className="stat-label">已通过审核</div>
        </div>
      </div>

      {/* Main Section - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Data & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Keyword Generator */}
          <KeywordGenerator projectId={projectId} />

          {/* Scrape Status / Download */}
          <ScrapeStatus key={scrapeStatusKey} projectId={projectId} onRefresh={handleRefresh} />

          {/* Category Legend */}
          <div className="reddit-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-dark-text">📈 关注维度分布</h2>
              {stats?.is_mock && (
                <span className="badge badge-orange animate-pulse">🧪 模拟模式</span>
              )}
            </div>
            <div className="space-y-3">
              {Object.entries(categoryNames).map(([code, name]) => (
                <div key={code} className="flex items-center justify-between p-3 bg-dark-hover rounded-lg hover:bg-dark-border transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: categoryColors[code] }}>
                      {code}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-dark-text">{name}</div>
                    </div>
                  </div>
                  <span className="text-base font-bold text-dark-text">
                    {stats?.category_counts?.[code] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Scoring Explanation */}
        <div className="space-y-6">
          <ScoringExplanation />
        </div>
      </div>
    </BaseLayout>
  )
}
