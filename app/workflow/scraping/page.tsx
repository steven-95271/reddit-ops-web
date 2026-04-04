'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'

interface Project {
  id: string
  name: string
  product_name: string
  keywords?: {
    core?: string[]
    longTail?: string[]
    competitor?: string[]
    scenario?: string[]
    seed?: string[]
  }
  subreddits?: {
    high?: Array<{ name: string; reason: string }>
    medium?: Array<{ name: string; reason: string }>
    low?: Array<{ name: string; reason: string }>
  }
}

type ScrapingStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed'

export default function ScrapingPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  
  // 抓取参数
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [maxPosts, setMaxPosts] = useState(100)
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot')
  
  // 抓取状态
  const [scrapingStatus, setScrapingStatus] = useState<ScrapingStatus>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [results, setResults] = useState<{ total: number; inserted: number; skipped: number } | null>(null)

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      
      if (data.success) {
        setProjects(data.data || [])
      } else {
        showToast(data.error || '获取项目列表失败', 'error')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      showToast('获取项目列表失败', 'error')
    }
  }

  // 轮询抓取状态
  const pollStatus = useCallback(async (rid: string, projectId: string) => {
    try {
      const res = await fetch(`/api/scraping/${rid}`)
      const data = await res.json()

      if (!data.success) {
        setScrapingStatus('failed')
        setStatusMessage(data.error || '查询状态失败')
        showToast(data.error || '查询状态失败', 'error')
        return
      }

      const status = data.data.status
      setStatusMessage(`当前状态: ${status}`)

      if (status === 'SUCCEEDED') {
        setScrapingStatus('succeeded')
        showToast('抓取完成，正在保存数据...', 'success')
        
        // 自动保存结果
        await saveResults(rid, projectId)
      } else if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED') {
        setScrapingStatus('failed')
        setStatusMessage(`抓取失败: ${data.data.errorMessage || status}`)
        showToast(`抓取失败: ${data.data.errorMessage || status}`, 'error')
      } else {
        // 继续轮询
        setTimeout(() => pollStatus(rid, projectId), 10000)
      }
    } catch (error) {
      console.error('Error polling status:', error)
      setScrapingStatus('failed')
      setStatusMessage('轮询状态失败')
      showToast('轮询状态失败', 'error')
    }
  }, [])

  // 保存抓取结果
  const saveResults = async (rid: string, projectId: string) => {
    try {
      const res = await fetch(`/api/scraping/${rid}/results?project_id=${projectId}`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setResults(data.data)
        showToast(`数据保存完成！新增 ${data.data.inserted} 条，跳过 ${data.data.skipped} 条`, 'success')
      } else {
        showToast(data.error || '保存数据失败', 'error')
      }
    } catch (error) {
      console.error('Error saving results:', error)
      showToast('保存数据失败', 'error')
    }
  }

  // 开始抓取
  const startScraping = async () => {
    if (!selectedProject) {
      showToast('请先选择一个项目', 'error')
      return
    }

    // 检查项目是否有配置
    const hasKeywords = selectedProject.keywords && 
      (selectedProject.keywords.core?.length || 
       selectedProject.keywords.longTail?.length ||
       selectedProject.keywords.seed?.length)
    
    const hasSubreddits = selectedProject.subreddits &&
      (selectedProject.subreddits.high?.length ||
       selectedProject.subreddits.medium?.length)

    if (!hasKeywords && !hasSubreddits) {
      showToast('该项目尚未配置关键词和 Subreddit，请先完成 P1 配置', 'error')
      return
    }

    setLoading(true)
    setScrapingStatus('pending')
    setStatusMessage('启动抓取任务...')
    setResults(null)

    try {
      const res = await fetch('/api/scraping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          time_range: timeRange,
          max_posts: maxPosts,
          sort_by: sortBy
        })
      })

      const data = await res.json()

      if (data.success) {
        const rid = data.data.run_id
        setRunId(rid)
        setScrapingStatus('running')
        setStatusMessage('抓取任务已启动，正在等待...')
        showToast('抓取任务已启动', 'success')
        
        // 开始轮询
        setTimeout(() => pollStatus(rid, selectedProject.id), 5000)
      } else {
        setScrapingStatus('failed')
        setStatusMessage(data.error || '启动抓取失败')
        showToast(data.error || '启动抓取失败', 'error')
      }
    } catch (error) {
      console.error('Error starting scraping:', error)
      setScrapingStatus('failed')
      setStatusMessage('启动抓取失败')
      showToast('启动抓取失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 计算总关键词数和 subreddit 数
  const getTotalKeywords = (project: Project) => {
    if (!project.keywords) return 0
    return (project.keywords.core?.length || 0) +
           (project.keywords.longTail?.length || 0) +
           (project.keywords.competitor?.length || 0) +
           (project.keywords.scenario?.length || 0) +
           (project.keywords.seed?.length || 0)
  }

  const getTotalSubreddits = (project: Project) => {
    if (!project.subreddits) return 0
    return (project.subreddits.high?.length || 0) +
           (project.subreddits.medium?.length || 0) +
           (project.subreddits.low?.length || 0)
  }

  const getStatusColor = (status: ScrapingStatus) => {
    switch (status) {
      case 'idle': return 'text-slate-500'
      case 'pending': return 'text-yellow-600'
      case 'running': return 'text-blue-600'
      case 'succeeded': return 'text-green-600'
      case 'failed': return 'text-red-600'
      default: return 'text-slate-500'
    }
  }

  const getStatusBg = (status: ScrapingStatus) => {
    switch (status) {
      case 'idle': return 'bg-slate-100'
      case 'pending': return 'bg-yellow-50'
      case 'running': return 'bg-blue-50'
      case 'succeeded': return 'bg-green-50'
      case 'failed': return 'bg-red-50'
      default: return 'bg-slate-100'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">P2 内容抓取</h1>
          <p className="text-slate-600 mt-2">
            根据项目配置的关键词和 Subreddit，从 Reddit 抓取帖子数据
          </p>
        </div>

        {/* 项目选择器 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            选择项目 <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === e.target.value)
              setSelectedProject(project || null)
              setScrapingStatus('idle')
              setResults(null)
            }}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择一个项目</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} - {project.product_name}
              </option>
            ))}
          </select>

          {/* 项目配置摘要 */}
          {selectedProject && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-500">关键词数量：</span>
                  <span className="text-sm font-semibold text-slate-700">{getTotalKeywords(selectedProject)} 个</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Subreddit 数量：</span>
                  <span className="text-sm font-semibold text-slate-700">{getTotalSubreddits(selectedProject)} 个</span>
                </div>
              </div>
              {getTotalKeywords(selectedProject) === 0 && getTotalSubreddits(selectedProject) === 0 && (
                <div className="mt-2 text-sm text-orange-600">
                  ⚠️ 该项目尚未配置关键词和 Subreddit，请先完成 P1 配置
                </div>
              )}
            </div>
          )}
        </div>

        {/* 参数设置面板 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">抓取参数设置</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 时间范围 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                时间范围
              </label>
              <div className="space-y-2">
                {[
                  { value: '24h', label: '最近 24 小时' },
                  { value: '7d', label: '最近 7 天' },
                  { value: '30d', label: '最近 30 天' }
                ].map(option => (
                  <label key={option.value} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="timeRange"
                      value={option.value}
                      checked={timeRange === option.value}
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={scrapingStatus === 'running' || scrapingStatus === 'pending'}
                    />
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 最大抓取数量 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                最大抓取数量
              </label>
              <input
                type="number"
                value={maxPosts}
                onChange={(e) => setMaxPosts(Math.max(10, Math.min(500, parseInt(e.target.value) || 100)))}
                min={10}
                max={500}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={scrapingStatus === 'running' || scrapingStatus === 'pending'}
              />
              <p className="text-xs text-slate-500 mt-1">范围：10 - 500</p>
            </div>

            {/* 排序方式 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                排序方式
              </label>
              <div className="space-y-2">
                {[
                  { value: 'hot', label: '热门 (Hot)' },
                  { value: 'new', label: '最新 (New)' },
                  { value: 'top', label: '最佳 (Top)' }
                ].map(option => (
                  <label key={option.value} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="sortBy"
                      value={option.value}
                      checked={sortBy === option.value}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={scrapingStatus === 'running' || scrapingStatus === 'pending'}
                    />
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 抓取状态展示 */}
        {scrapingStatus !== 'idle' && (
          <div className={`${getStatusBg(scrapingStatus)} rounded-xl border border-slate-200 p-6 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${getStatusColor(scrapingStatus)}`}>
                抓取状态
              </h2>
              {(scrapingStatus === 'running' || scrapingStatus === 'pending') && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </div>
            
            <p className="text-slate-700 mb-2">{statusMessage}</p>
            
            {runId && (
              <p className="text-xs text-slate-500 font-mono">
                Run ID: {runId}
              </p>
            )}

            {/* 进度条 */}
            {(scrapingStatus === 'running' || scrapingStatus === 'pending') && (
              <div className="mt-4">
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">正在抓取数据，每 10 秒自动刷新状态...</p>
              </div>
            )}
          </div>
        )}

        {/* 结果展示 */}
        {results && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">抓取结果</h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{results.total}</div>
                <div className="text-sm text-slate-500">抓取总数</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{results.inserted}</div>
                <div className="text-sm text-green-600">新增帖子</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-slate-600">{results.skipped}</div>
                <div className="text-sm text-slate-500">已存在（跳过）</div>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={startScraping}
            disabled={!selectedProject || loading || scrapingStatus === 'running' || scrapingStatus === 'pending'}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
          >
            {loading || scrapingStatus === 'running' || scrapingStatus === 'pending' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {scrapingStatus === 'pending' ? '启动中...' : '抓取中...'}
              </>
            ) : (
              '🚀 开始抓取'
            )}
          </button>

          {results && (
            <button
              onClick={() => window.location.href = '/workflow/analysis'}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-lg"
            >
              下一步：分析筛选 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
