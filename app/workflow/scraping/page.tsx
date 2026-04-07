'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'

interface Project {
  id: string
  name: string
  product_name: string
  keywords?: {
    phase1_brand?: {
      description: string
      queries: string[]
    }
    phase2_competitor?: {
      description: string
      queries: string[]
    }
    phase3_scene_pain?: {
      description: string
      queries: string[]
    }
    phase4_subreddits?: {
      description: string
      targets: Array<{
        subreddit: string
        reason: string
        relevance: 'high' | 'medium'
        search_within: string[]
      }>
    }
  }
}

interface ScrapingRun {
  id: string
  phase: string
  query: string
  subreddit?: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  params: {
    time_range: string
    max_posts: number
    sort_by: string
  }
  total_posts: number
  inserted_posts: number
  skipped_posts: number
  apify_run_id?: string
  apify_dataset_id?: string
  error_message?: string
  started_at?: string
  completed_at?: string
}

interface PhaseConfig {
  time_range: '24h' | '7d' | '30d' | 'year'
  max_posts: number
  sort_by: 'hot' | 'new' | 'top' | 'relevance'
}

const phaseLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  phase1_brand: { label: 'Phase 1 品牌词', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  phase2_competitor: { label: 'Phase 2 竞品词', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  phase3_scene_pain: { label: 'Phase 3 场景词', color: 'text-green-700', bgColor: 'bg-green-100' },
  phase4_subreddits: { label: 'Phase 4 Subreddit', color: 'text-purple-700', bgColor: 'bg-purple-100' }
}

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '等待中', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  running: { label: '进行中', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  succeeded: { label: '已完成', color: 'text-green-700', bgColor: 'bg-green-100' },
  failed: { label: '失败', color: 'text-red-700', bgColor: 'bg-red-100' }
}

export default function ScrapingPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [runs, setRuns] = useState<ScrapingRun[]>([])
  const [isPolling, setIsPolling] = useState(false)

  // 四阶段配置
  const [phaseConfigs, setPhaseConfigs] = useState<Record<string, PhaseConfig>>({
    phase1_brand: { time_range: '7d', max_posts: 100, sort_by: 'hot' },
    phase2_competitor: { time_range: '30d', max_posts: 100, sort_by: 'top' },
    phase3_scene_pain: { time_range: '30d', max_posts: 100, sort_by: 'relevance' },
    phase4_subreddits: { time_range: '30d', max_posts: 100, sort_by: 'hot' }
  })

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

  // 轮询状态
  const pollStatus = useCallback(async (bid: string) => {
    try {
      const res = await fetch(`/api/scraping/batch/${bid}`)
      const data = await res.json()

      if (data.success) {
        setRuns(data.data.runs)
        
        // 检查是否全部完成
        const allCompleted = data.data.runs.every(
          (run: ScrapingRun) => run.status === 'succeeded' || run.status === 'failed'
        )
        
        if (allCompleted) {
          setIsPolling(false)
          showToast('所有抓取任务已完成', 'success')
        } else {
          // 继续轮询
          setTimeout(() => pollStatus(bid), 10000)
        }
      } else {
        showToast(data.error || '查询状态失败', 'error')
        setIsPolling(false)
      }
    } catch (error) {
      console.error('Error polling status:', error)
      setIsPolling(false)
    }
  }, [])

  // 开始批量抓取
  const startBatchScraping = async () => {
    if (!selectedProject) {
      showToast('请先选择一个项目', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/scraping/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          phase_configs: phaseConfigs
        })
      })

      const data = await res.json()

      if (data.success) {
        setBatchId(data.data.batch_id)
        setRuns(data.data.runs)
        setIsPolling(true)
        showToast(`已启动 ${data.data.total_runs} 个抓取任务`, 'success')
        
        // 开始轮询
        setTimeout(() => pollStatus(data.data.batch_id), 5000)
      } else {
        showToast(data.error || '启动抓取失败', 'error')
      }
    } catch (error) {
      console.error('Error starting batch scraping:', error)
      showToast('启动抓取失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 更新阶段配置
  const updatePhaseConfig = (phase: string, key: keyof PhaseConfig, value: any) => {
    setPhaseConfigs(prev => ({
      ...prev,
      [phase]: { ...prev[phase], [key]: value }
    }))
  }

  // 计算统计信息
  const stats = {
    total: runs.length,
    pending: runs.filter(r => r.status === 'pending').length,
    running: runs.filter(r => r.status === 'running').length,
    succeeded: runs.filter(r => r.status === 'succeeded').length,
    failed: runs.filter(r => r.status === 'failed').length
  }

  // 获取四阶段的关键词数量
  const getPhaseCounts = () => {
    if (!selectedProject?.keywords) return {}
    return {
      phase1_brand: selectedProject.keywords.phase1_brand?.queries?.length || 0,
      phase2_competitor: selectedProject.keywords.phase2_competitor?.queries?.length || 0,
      phase3_scene_pain: selectedProject.keywords.phase3_scene_pain?.queries?.length || 0,
      phase4_subreddits: selectedProject.keywords.phase4_subreddits?.targets?.length || 0
    }
  }

  const phaseCounts = getPhaseCounts()
  const totalKeywords = Object.values(phaseCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">P2 内容抓取</h1>
          <p className="text-slate-600 mt-2">
            根据四阶段搜索策略，从 Reddit 批量抓取帖子数据
          </p>
        </div>

        {/* 工作流说明 */}
        <div className="mb-6">
          <WorkflowGuide
            title="P2 内容抓取"
            description="根据四阶段搜索策略配置，批量抓取 Reddit 帖子数据"
            steps={[
              {
                title: '选择项目',
                description: '从 P1 已配置的项目中选择，查看四阶段关键词配置'
              },
              {
                title: '配置抓取参数',
                description: '为每个阶段设置时间范围、抓取数量和排序方式'
              },
              {
                title: '批量启动',
                description: '每个查询词启动独立的 Apify 抓取任务'
              },
              {
                title: '监控进度',
                description: '实时查看所有任务的执行状态，下载原始数据'
              }
            ]}
            details={`【四阶段抓取策略】
• Phase 1 品牌词：宽泛捕网，捕获品牌相关讨论
• Phase 2 竞品词：竞品对比，高价值购买决策情报  
• Phase 3 场景词：真实使用场景和痛点讨论
• Phase 4 Subreddit：精准定向，深度挖掘特定社区

【数据下载】
每个任务完成后可下载 CSV 格式的原始数据（All fields），用于质量把控和后续分析。`}
          />
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
              setBatchId(null)
              setRuns([])
            }}
            disabled={isPolling}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
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
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{phaseCounts.phase1_brand}</div>
                  <div className="text-xs text-slate-500">Phase 1 品牌词</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{phaseCounts.phase2_competitor}</div>
                  <div className="text-xs text-slate-500">Phase 2 竞品词</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{phaseCounts.phase3_scene_pain}</div>
                  <div className="text-xs text-slate-500">Phase 3 场景词</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{phaseCounts.phase4_subreddits}</div>
                  <div className="text-xs text-slate-500">Phase 4 Subreddits</div>
                </div>
              </div>
              {totalKeywords === 0 && (
                <div className="mt-2 text-sm text-orange-600 text-center">
                  ⚠️ 该项目尚未配置四阶段关键词，请先完成 P1 配置
                </div>
              )}
            </div>
          )}
        </div>

        {/* 四阶段参数配置 */}
        {selectedProject && totalKeywords > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">四阶段抓取参数配置</h2>
            
            <div className="space-y-6">
              {Object.entries(phaseConfigs).map(([phase, config]) => {
                const count = phaseCounts[phase as keyof typeof phaseCounts] || 0
                if (count === 0) return null
                
                const phaseInfo = phaseLabels[phase]
                
                return (
                  <div key={phase} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${phaseInfo.bgColor} ${phaseInfo.color}`}>
                          {phaseInfo.label}
                        </span>
                        <span className="text-sm text-slate-500">{count} 个查询词</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">时间范围</label>
                        <select
                          value={config.time_range}
                          onChange={(e) => updatePhaseConfig(phase, 'time_range', e.target.value)}
                          disabled={isPolling}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        >
                          <option value="24h">最近 24 小时</option>
                          <option value="7d">最近 7 天</option>
                          <option value="30d">最近 30 天</option>
                          <option value="year">最近一年</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">最大数量</label>
                        <input
                          type="number"
                          value={config.max_posts}
                          onChange={(e) => updatePhaseConfig(phase, 'max_posts', parseInt(e.target.value) || 100)}
                          min={10}
                          max={1000}
                          disabled={isPolling}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">排序方式</label>
                        <select
                          value={config.sort_by}
                          onChange={(e) => updatePhaseConfig(phase, 'sort_by', e.target.value)}
                          disabled={isPolling}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        >
                          <option value="hot">热门 (Hot)</option>
                          <option value="new">最新 (New)</option>
                          <option value="top">最佳 (Top)</option>
                          <option value="relevance">相关度 (Relevance)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 统计面板 */}
        {runs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">抓取进度</h2>
            
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                <div className="text-sm text-slate-500">总任务</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-gray-600">{stats.pending}</div>
                <div className="text-sm text-gray-600">等待中</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.running}</div>
                <div className="text-sm text-blue-600">进行中</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.succeeded}</div>
                <div className="text-sm text-green-600">已完成</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-red-600">失败</div>
              </div>
            </div>

            {isPolling && (
              <div className="mt-4 flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">正在监控任务状态，每 10 秒自动刷新...</span>
              </div>
            )}
          </div>
        )}

        {/* 任务列表 */}
        {runs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">任务列表</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 font-medium text-slate-700">阶段</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">查询词</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">Subreddit</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">参数</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">状态</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">结果</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const phaseInfo = phaseLabels[run.phase]
                    const statusInfo = statusLabels[run.status]
                    
                    return (
                      <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${phaseInfo?.bgColor} ${phaseInfo?.color}`}>
                            {phaseInfo?.label.split(' ')[0]}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="max-w-xs truncate" title={run.query}>
                            {run.query}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {run.subreddit ? (
                            <span className="text-purple-600">r/{run.subreddit}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs text-slate-500">
                            {run.params.time_range} | {run.params.max_posts}条 | {run.params.sort_by}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo?.bgColor} ${statusInfo?.color}`}>
                            {statusInfo?.label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {run.status === 'succeeded' ? (
                            <div className="text-xs">
                              <span className="text-green-600">{run.inserted_posts}</span>
                              <span className="text-slate-400"> / {run.total_posts}</span>
                            </div>
                          ) : run.status === 'failed' ? (
                            <div className="text-xs text-red-500 truncate max-w-xs" title={run.error_message}>
                              {run.error_message || '失败'}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {run.status === 'succeeded' && (
                            <a
                              href={`/api/scraping/${run.id}/download`}
                              download
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              下载 CSV
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={startBatchScraping}
            disabled={!selectedProject || loading || isPolling || totalKeywords === 0}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                启动中...
              </>
            ) : (
              '🚀 开始批量抓取'
            )}
          </button>

          {stats.succeeded > 0 && !isPolling && (
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