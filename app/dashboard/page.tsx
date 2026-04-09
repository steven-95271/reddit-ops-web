'use client'

import { useState, useEffect } from 'react'
import BaseLayout from '@/components/BaseLayout'
import { showToast } from '@/components/Toast'

interface Project {
  id: string
  name: string
}

interface Stats {
  total_projects: number
  total_posts: number
  total_candidates: number
  total_contents: number
  status_counts: { draft: number; approved: number; published: number; rejected: number }
  total_published: number
  total_upvotes: number
  total_replies: number
  total_engagement: number
  grade_stats: { S: number; A: number; B: number; C: number }
  category_stats: { A: number; B: number; C: number; D: number; E: number }
  project_progress: Array<{
    id: string
    name: string
    stats: { total_posts: string; candidates: string; total_contents: string; approved: string; published: string }
  }>
}

const gradeColors: Record<string, string> = {
  S: 'bg-purple-600 text-white',
  A: 'bg-green-600 text-white',
  B: 'bg-blue-600 text-white',
  C: 'bg-gray-400 text-white',
}

const categoryColors: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-red-100 text-red-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-purple-100 text-purple-700',
  E: 'bg-green-100 text-green-700',
}

const categoryNames: Record<string, string> = {
  A: '深度测评',
  B: '场景痛点',
  C: '观点争议',
  D: '竞品KOL',
  E: '平台趋势',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    fetchStats()
  }, [selectedProjectId])

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/projects`)
      const result = await response.json()
      if (result.success) {
        setProjects(result.data)
      }
    } catch (error) {
      showToast('加载项目失败', 'error')
    }
  }

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : ''
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/stats${params}`)
      const result = await response.json()
      if (result.success) {
        setStats(result.data)
      } else {
        showToast(result.error || '加载数据失败', 'error')
      }
    } catch (error) {
      showToast('加载数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const getProjectStage = (projectStats: Stats['project_progress'][0]['stats']): number => {
    if (parseInt(projectStats.total_posts) > 0) return 2
    return 1
  }

  return (
    <BaseLayout>
      {/* Project Selector */}
      <div className="mb-6">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="bg-white/80 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">全部项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_projects}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">项目数</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_posts}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">帖子数</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-purple-600">{stats.total_candidates}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">候选帖</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_contents}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">已生成内容</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-green-600">{stats.total_published}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">已发布</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-2xl md:text-3xl font-black text-blue-600">{stats.total_engagement}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">总互动</div>
            </div>
          </div>

          {/* Content Funnel */}
          <div className="glass-card mb-8">
            <h2 className="text-lg font-black text-slate-900 mb-6">内容漏斗</h2>
            <div className="flex items-center justify-between">
              {[
                { label: '抓取帖子', value: stats.total_posts, color: 'bg-slate-500' },
                { label: '候选帖', value: stats.total_candidates, color: 'bg-purple-500', rate: stats.total_posts > 0 ? (stats.total_candidates / stats.total_posts * 100).toFixed(1) + '%' : '0%' },
                { label: '生成内容', value: stats.total_contents, color: 'bg-blue-500', rate: stats.total_candidates > 0 ? (stats.total_contents / stats.total_candidates * 100).toFixed(1) + '%' : '0%' },
                { label: '审核通过', value: stats.status_counts.approved, color: 'bg-green-500', rate: stats.total_contents > 0 ? (stats.status_counts.approved / stats.total_contents * 100).toFixed(1) + '%' : '0%' },
                { label: '已发布', value: stats.total_published, color: 'bg-emerald-500', rate: stats.status_counts.approved > 0 ? (stats.total_published / stats.status_counts.approved * 100).toFixed(1) + '%' : '0%' },
              ].map((item, index) => (
                <div key={item.label} className="flex items-center">
                  <div className="text-center">
                    <div className={`${item.color} text-white text-sm font-bold px-4 py-2 rounded-lg`}>
                      {item.value}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">{item.label}</div>
                    {item.rate && <div className="text-xs text-slate-400">{item.rate}</div>}
                  </div>
                  {index < 4 && (
                    <div className="mx-2 text-slate-300">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Grade & Category Distribution */}
            <div className="glass-card">
              <h2 className="text-lg font-black text-slate-900 mb-6">评分分布</h2>
              <div className="space-y-3">
                {Object.entries(stats.grade_stats).map(([grade, count]) => (
                  <div key={grade} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${gradeColors[grade]}`}>{grade}</span>
                      <span className="text-sm text-slate-600">级</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>

              <h2 className="text-lg font-black text-slate-900 mt-8 mb-6">分类分布</h2>
              <div className="space-y-3">
                {Object.entries(stats.category_stats).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${categoryColors[cat]}`}>{cat}</span>
                      <span className="text-sm text-slate-600">{categoryNames[cat]}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Status */}
            <div className="glass-card">
              <h2 className="text-lg font-black text-slate-900 mb-6">内容状态</h2>
              <div className="space-y-3">
                {[
                  { status: 'draft', label: '草稿', color: 'bg-slate-400' },
                  { status: 'approved', label: '待发布', color: 'bg-blue-500' },
                  { status: 'published', label: '已发布', color: 'bg-green-500' },
                  { status: 'rejected', label: '已拒绝', color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.status} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="text-sm text-slate-600">{item.label}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">
                      {stats.status_counts[item.status as keyof typeof stats.status_counts] || 0}
                    </span>
                  </div>
                ))}
              </div>

              <h2 className="text-lg font-black text-slate-900 mt-8 mb-6">互动统计</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-black text-slate-900">{stats.total_upvotes}</div>
                  <div className="text-xs text-slate-500 mt-1">总点赞</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-black text-slate-900">{stats.total_replies}</div>
                  <div className="text-xs text-slate-500 mt-1">总评论</div>
                </div>
              </div>
            </div>

            {/* Project Progress */}
            <div className="glass-card">
              <h2 className="text-lg font-black text-slate-900 mb-6">项目进度</h2>
              {stats.project_progress.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>暂无项目数据</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.project_progress.map((project) => {
                    const stage = getProjectStage(project.stats)
                    return (
                      <div key={project.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-slate-800 truncate">{project.name}</span>
                          <span className="text-xs text-slate-500">
                            {stage === 1 ? 'P1 配置' : stage === 2 ? 'P2+ 抓取' : '进行中'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {['P1', 'P2', 'P3', 'P4', 'P5'].map((p, i) => (
                            <div
                              key={p}
                              className={`flex-1 h-2 rounded-full ${
                                i < stage ? 'bg-green-500' : i === stage ? 'bg-slate-400' : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                          <span>{project.stats.total_posts || 0} 帖</span>
                          <span>{project.stats.candidates || 0} 候选</span>
                          <span>{project.stats.published || 0} 发布</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-400">
          <p>暂无数据</p>
        </div>
      )}
    </BaseLayout>
  )
}
