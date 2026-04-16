'use client'

import { useState, useEffect, useRef } from 'react'
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
  batch_id: string
  project_id: string
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
  apify_run_id?: string | null
  apify_dataset_id?: string | null
  apify_status?: string | null
  error_message?: string
  started_at?: string
  completed_at?: string
  cost_usd?: number
  created_at?: string
  last_checked_at?: string | null
  results_synced_at?: string | null
}

interface PhaseConfig {
  time_range: '24h' | '7d' | '30d' | 'year'
  max_posts: number
  sort_by: 'hot' | 'new' | 'top' | 'relevance'
}

const defaultPhaseConfig: PhaseConfig = {
  time_range: '7d',
  max_posts: 100,
  sort_by: 'hot'
}

// Apify Actor ID (URL 中 / 改为 ~)
const REDDIT_SCRAPER_ACTOR_ID = 'automation-lab~reddit-scraper'

const phaseLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  phase1_brand: { label: 'Phase 1 品牌词', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  phase2_competitor: { label: 'Phase 2 竞品词', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  phase3_scene_pain: { label: 'Phase 3 场景词', color: 'text-green-700', bgColor: 'bg-green-100' },
  phase4_subreddits: { label: 'Phase 4 Subreddit', color: 'text-purple-700', bgColor: 'bg-purple-100' }
}

// Phase 名称到数组索引的映射
const phaseToIndex: Record<string, number> = {
  phase1_brand: 0,
  phase2_competitor: 1,
  phase3_scene_pain: 2,
  phase4_subreddits: 3
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
  const [runs, setRuns] = useState<ScrapingRun[]>([])
  const [autoPollingEnabled, setAutoPollingEnabled] = useState(true)
  const [isSyncingRuns, setIsSyncingRuns] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const autoPollingRef = useRef<NodeJS.Timeout | null>(null)

  // 四阶段配置 - 数组结构便于索引访问
  const [phaseConfigs, setPhaseConfigs] = useState<PhaseConfig[]>([
    { ...defaultPhaseConfig, sort_by: 'hot',       time_range: '7d'   },  // Phase 1
    { ...defaultPhaseConfig, sort_by: 'top',       time_range: '30d'  },  // Phase 2
    { ...defaultPhaseConfig, sort_by: 'relevance', time_range: '30d'  },  // Phase 3
    { ...defaultPhaseConfig, sort_by: 'hot',       time_range: '30d'  },  // Phase 4
  ])

  // 高级 Apify 配置
  const [advancedConfig, setAdvancedConfig] = useState({
    includeComments: true,
    maxCommentsPerPost: 20,
    commentDepth: 3,
    deduplicatePosts: true,
    maxRetries: 5
  })

  // 展开的 Phase
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})

  // 选中的抓取项: phase -> Set of query/subreddit identifiers
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({
    phase1_brand: new Set(),
    phase2_competitor: new Set(),
    phase3_scene_pain: new Set(),
    phase4_subreddits: new Set()
  })

  // 抓取单个 Subreddit（为每个关键词启动独立 Run）
  const handleScrapeSubreddit = async (subredditName: string, searchKeywords: string[]) => {
    if (!selectedProject) return

    try {
      const items = (searchKeywords.length > 0 ? searchKeywords : ['']).map((keyword) => ({
        phase: 'phase4_subreddits',
        query: keyword,
        subreddit: subredditName,
      }))

      const res = await fetch('/api/scraping/custom-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          phase_configs: {
            phase1_brand: phaseConfigs[0],
            phase2_competitor: phaseConfigs[1],
            phase3_scene_pain: phaseConfigs[2],
            phase4_subreddits: phaseConfigs[3],
          },
          items,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAutoPollingEnabled(true)
        await loadHistoryRuns(selectedProject.id)
        showToast(`已为 r/${subredditName} 启动 ${data.runs.length} 个任务`, 'success')
      } else {
        showToast(data.error || '启动失败', 'error')
      }
    } catch (error) {
      showToast('启动失败', 'error')
    }
  }

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  // 页面加载时从 DB 读取历史任务
  useEffect(() => {
    if (selectedProject?.id) {
      loadHistoryRuns(selectedProject.id)
    }
  }, [selectedProject?.id])

  useEffect(() => {
    const hasActiveRuns = runs.some((run) => run.status === 'pending' || run.status === 'running')

    if (!selectedProject?.id || !autoPollingEnabled || !hasActiveRuns) {
      if (autoPollingRef.current) {
        clearInterval(autoPollingRef.current)
        autoPollingRef.current = null
      }
      return
    }

    autoPollingRef.current = setInterval(() => {
      syncRuns({ silent: true })
    }, 10000)

    return () => {
      if (autoPollingRef.current) {
        clearInterval(autoPollingRef.current)
        autoPollingRef.current = null
      }
    }
  }, [autoPollingEnabled, runs, selectedProject?.id])

  async function loadHistoryRuns(projectId: string) {
    try {
      const res = await fetch(`/api/scraping/runs?projectId=${projectId}`)
      const data = await res.json()
      
      console.log('[loadHistoryRuns] Loaded', data.runs?.length, 'runs for project', projectId)
      
      if (data.runs && data.runs.length > 0) {
        setRuns(data.runs)
      } else {
        setRuns([])
      }
    } catch (e) {
      console.error('[loadHistoryRuns] Error:', e)
    }
  }

  async function syncRuns(options?: { silent?: boolean }) {
    if (!selectedProject?.id) {
      return
    }

    if (!options?.silent) {
      setIsSyncingRuns(true)
    }

    try {
      const res = await fetch('/api/scraping/runs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || '同步任务状态失败')
      }

      setRuns(data.data.runs || [])
      setLastSyncAt(new Date().toISOString())
    } catch (error) {
      console.error('[syncRuns] Error:', error)
      if (!options?.silent) {
        showToast(error instanceof Error ? error.message : '同步任务状态失败', 'error')
      }
    } finally {
      if (!options?.silent) {
        setIsSyncingRuns(false)
      }
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/projects`)
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

  // 切换 Phase 展开/折叠
  const togglePhaseExpand = (phase: string) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }

  // 切换单个抓取项的选中状态
  const toggleItemSelection = (phase: string, itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev[phase] || [])
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return { ...prev, [phase]: newSet }
    })
  }

  // 全选某 Phase 的所有项
  const selectAllInPhase = (phase: string) => {
    if (!selectedProject?.keywords) return
    let items: string[] = []
    if (phase === 'phase4_subreddits') {
      items = (selectedProject.keywords.phase4_subreddits?.targets || []).map(t => t.subreddit)
    } else {
      const phaseKey = phase as 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain'
      items = (selectedProject.keywords[phaseKey]?.queries || []).map((q, i) => `q_${i}`)
    }
    setSelectedItems(prev => ({ ...prev, [phase]: new Set(items) }))
  }

  // 取消全选某 Phase
  const deselectAllInPhase = (phase: string) => {
    setSelectedItems(prev => ({ ...prev, [phase]: new Set() }))
  }

  // 启动单项抓取（单个关键词或单个 subreddit）
  const startSingleScraping = async (phase: string, itemId: string, query: string, subreddit?: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/scraping/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject?.id,
          phase,
          query,
          subreddit,
          config: {
            ...(phaseConfigs[phaseToIndex[phase]] ?? defaultPhaseConfig),
            ...advancedConfig
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast(`已启动抓取任务: ${query}`, 'success')
        if (selectedProject?.id) {
          setAutoPollingEnabled(true)
          await loadHistoryRuns(selectedProject.id)
        }
      } else {
        showToast(data.error || '启动失败', 'error')
      }
    } catch (error) {
      showToast('启动失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 启动选中项抓取
  const startSelectedScraping = async () => {
    const totalSelected = Object.values(selectedItems).reduce((sum, set) => sum + Array.from(set).length, 0)
    if (totalSelected === 0) {
      showToast('请先选择要抓取的项', 'error')
      return
    }
    setLoading(true)
    try {
      const itemsToScrape: Array<{ phase: string; query: string; subreddit?: string }> = []
      for (const [phase, itemSet] of Object.entries(selectedItems)) {
        if (itemSet.size === 0) continue
        if (phase === 'phase4_subreddits') {
          const targets = selectedProject?.keywords?.phase4_subreddits?.targets || []
          for (const target of targets) {
            if (itemSet.has(target.subreddit)) {
              itemsToScrape.push({
                phase,
                query: target.search_within?.[0] || '',
                subreddit: target.subreddit
              })
            }
          }
        } else {
          const phaseKey = phase as 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain'
          const queries = selectedProject?.keywords?.[phaseKey]?.queries || []
          for (let i = 0; i < queries.length; i++) {
            if (itemSet.has(`q_${i}`)) {
              itemsToScrape.push({ phase, query: queries[i] })
            }
          }
        }
      }
      const res = await fetch('/api/scraping/custom-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject?.id,
          phase_configs: {
            phase1_brand: phaseConfigs[0],
            phase2_competitor: phaseConfigs[1],
            phase3_scene_pain: phaseConfigs[2],
            phase4_subreddits: phaseConfigs[3]
          },
          items: itemsToScrape
        })
      })
      const data = await res.json()
      if (data.success) {
        setAutoPollingEnabled(true)
        if (selectedProject?.id) {
          await loadHistoryRuns(selectedProject.id)
        }
        showToast(`已启动 ${data.data.total_runs} 个抓取任务`, 'success')
      } else {
        showToast(data.error || '启动失败', 'error')
      }
    } catch (error) {
      showToast('启动失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 开始批量抓取（全部）
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
          phase_configs: {
            phase1_brand: phaseConfigs[0],
            phase2_competitor: phaseConfigs[1],
            phase3_scene_pain: phaseConfigs[2],
            phase4_subreddits: phaseConfigs[3]
          }
        })
      })

      const data = await res.json()

      if (data.success) {
        setAutoPollingEnabled(true)
        await loadHistoryRuns(selectedProject.id)
        showToast(`已启动 ${data.data.total_runs} 个抓取任务`, 'success')
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
    const index = phaseToIndex[phase]
    if (index === undefined) return
    setPhaseConfigs(prev => {
      const newConfigs = [...prev]
      newConfigs[index] = { ...newConfigs[index], [key]: value }
      return newConfigs
    })
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
  const hasActiveRuns = runs.some((run) => run.status === 'pending' || run.status === 'running')

  const getRunsForSubreddit = (subredditName: string) =>
    runs.filter((run) => run.phase === 'phase4_subreddits' && run.subreddit === subredditName)

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
              setRuns([])
            }}
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

        {/* 四阶段关键词详情 + 抓取控制 */}
        {selectedProject && totalKeywords > 0 && (
          <div className="space-y-4 mb-6">
            {/* 顶部操作栏 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => window.location.href = '/workflow/config'}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    ← 返回 P1 修改关键词
                  </button>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm text-slate-500">
                    已选择 {Object.values(selectedItems).reduce((s, set) => s + set.size, 0)} / {totalKeywords} 项
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startSelectedScraping}
                    disabled={loading || Object.values(selectedItems).every(s => Array.from(s).length === 0)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    抓取所选 ({Object.values(selectedItems).reduce((s, set) => s + set.size, 0)})
                  </button>
                </div>
              </div>
            </div>

            {/* 各 Phase 详情卡片 */}
            {(['phase1_brand', 'phase2_competitor', 'phase3_scene_pain', 'phase4_subreddits'] as const).map(phase => {
              const count = phaseCounts[phase as keyof typeof phaseCounts] || 0
              if (count === 0) return null
              
              const phaseInfo = phaseLabels[phase]
              const config = phaseConfigs[phaseToIndex[phase]] ?? defaultPhaseConfig
              const isExpanded = expandedPhases[phase]
              const selectedCount = selectedItems[phase]?.size || 0

              // 获取关键词列表
              let keywords: string[] = []
              let targets: Array<{ subreddit: string; reason: string; search_within: string[] }> = []
              if (phase === 'phase4_subreddits') {
                targets = selectedProject?.keywords?.phase4_subreddits?.targets || []
              } else {
                const phaseKey = phase as 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain'
                keywords = selectedProject?.keywords?.[phaseKey]?.queries || []
              }

              // Phase 说明
              const phaseDescriptions: Record<string, string> = {
                phase1_brand: '直接搜索品牌相关讨论，宽泛覆盖，获取品牌声量数据',
                phase2_competitor: '竞品对比内容，高价值购买决策情报，了解市场份额',
                phase3_scene_pain: '真实使用场景和痛点讨论，发现用户真实需求',
                phase4_subreddits: '精准定向特定社区，深度挖掘目标用户'
              }

              return (
                <div key={phase} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Phase 头部 */}
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCount === count && count > 0}
                          ref={el => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < count }}
                          onChange={() => selectedCount === count ? deselectAllInPhase(phase) : selectAllInPhase(phase)}
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`px-2 py-1 rounded text-xs font-medium ${phaseInfo.bgColor} ${phaseInfo.color}`}>
                          {phaseInfo.label}
                        </span>
                        <span className="text-sm text-slate-600">{phaseDescriptions[phase]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{selectedCount}/{count} 项</span>
                        <button
                          onClick={() => togglePhaseExpand(phase)}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 参数配置行 */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-medium text-slate-600">时间范围</label>
                          <button
                            onClick={() => {
                              const explanations: Record<string, string> = {
                                '24h': '适合快速获取最新动态，数据量小但即时性强',
                                '7d': '平衡数据量和时效性，适合常规监控',
                                '30d': '完整月度数据，适合趋势分析',
                                'year': '年度数据，适合全面了解讨论演变'
                              }
                              alert(explanations[config.time_range])
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ⓘ
                          </button>
                        </div>
                        <select
                          value={config.time_range}
                          onChange={(e) => updatePhaseConfig(phase, 'time_range', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        >
                          <option value="24h">最近 24 小时</option>
                          <option value="7d">最近 7 天</option>
                          <option value="30d">最近 30 天</option>
                          <option value="year">最近一年</option>
                        </select>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-medium text-slate-600">最大数量</label>
                          <button
                            onClick={() => alert('建议值：100-200条。过多会导致抓取慢且数据重复，过少则样本不足。')}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ⓘ
                          </button>
                        </div>
                        <input
                          type="number"
                          value={config.max_posts}
                          onChange={(e) => updatePhaseConfig(phase, 'max_posts', parseInt(e.target.value) || 100)}
                          min={10}
                          max={1000}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-medium text-slate-600">排序方式</label>
                          <button
                            onClick={() => {
                              const explanations: Record<string, string> = {
                                'hot': '热门内容，Reddit算法综合评分，适合获取高参与度内容',
                                'new': '最新内容，时效性强，适合发现新趋势',
                                'top': '评分最高内容，质量最高，适合深度分析',
                                'relevance': '相关度排序，算法匹配最精准，适合搜索场景'
                              }
                              alert(explanations[config.sort_by])
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ⓘ
                          </button>
                        </div>
                        <select
                          value={config.sort_by}
                          onChange={(e) => updatePhaseConfig(phase, 'sort_by', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        >
                          <option value="hot">热门 (Hot)</option>
                          <option value="new">最新 (New)</option>
                          <option value="top">最佳 (Top)</option>
                          <option value="relevance">相关度 (Relevance)</option>
                        </select>
                      </div>
                    </div>

                    {/* 批量操作 */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => selectAllInPhase(phase)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        全选
                      </button>
                      <button
                        onClick={() => deselectAllInPhase(phase)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        取消全选
                      </button>
                      <button
                        onClick={() => {
                          // 启动当前 phase 所有任务
                          if (phase === 'phase4_subreddits') {
                            targets.forEach(t => {
                              startSingleScraping(phase, t.subreddit, t.search_within?.[0] || '', t.subreddit)
                            })
                          } else {
                            keywords.forEach((q, i) => {
                              startSingleScraping(phase, `q_${i}`, q)
                            })
                          }
                        }}
                        disabled={loading}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        启动全部 →
                      </button>
                    </div>
                  </div>

                  {/* 关键词列表（展开时） */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50">
                      {phase === 'phase4_subreddits' ? (
                        <div className="space-y-3">
                          {targets.map((target, idx) => {
                            const subredditRuns = getRunsForSubreddit(target.subreddit)
                            const hasSubredditRuns = subredditRuns.length > 0
                            const subredditIsActive = subredditRuns.some(
                              (run) => run.status === 'pending' || run.status === 'running'
                            )
                            return (
                              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems[phase]?.has(target.subreddit) || false}
                                    onChange={() => toggleItemSelection(phase, target.subreddit)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-purple-600">r/{target.subreddit}</span>
                                      <span className="text-xs text-slate-400">|</span>
                                      <span className="text-xs text-slate-500">搜索词: {target.search_within?.join(', ') || '无'}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">原因: {target.reason}</div>
                                    {hasSubredditRuns && (
                                      <div className="text-xs mt-1">
                                        {subredditIsActive && <span className="text-blue-500">进行中 ({subredditRuns.length} 个任务)</span>}
                                        {!subredditIsActive && <span className="text-green-500">已同步 ({subredditRuns.length} 个任务)</span>}
                                      </div>
                                    )}
                                  </div>
                                  {!hasSubredditRuns && (
                                    <button
                                      onClick={() => handleScrapeSubreddit(target.subreddit, target.search_within || [])}
                                      disabled={loading}
                                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      抓取全部
                                    </button>
                                  )}
                                  {hasSubredditRuns && (
                                    <button
                                      onClick={() => handleScrapeSubreddit(target.subreddit, target.search_within || [])}
                                      disabled={loading}
                                      className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      再次抓取
                                    </button>
                                  )}
                                </div>
                                {/* 每个 Run 的独立状态 */}
                                {hasSubredditRuns && (
                                  <div className="mt-3 pl-7 space-y-2">
                                    {subredditRuns.map((run) => (
                                      <div key={run.id} className="text-xs flex items-center gap-2 flex-wrap">
                                        <span className="text-slate-600">{run.query || '(空关键词)'}</span>
                                        {run.status === 'pending' && (
                                          <span className="text-slate-500">等待启动</span>
                                        )}
                                        {run.status === 'running' && (
                                          <span className="text-blue-500">抓取中 · {run.total_posts} 条</span>
                                        )}
                                        {run.status === 'succeeded' && (
                                          <>
                                            <span className="text-green-500">已完成 · {run.total_posts} 条 · ${run.cost_usd?.toFixed(3) || '0.000'}</span>
                                            <a
                                              href={`/api/scraping/${run.id}/download`}
                                              className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                            >
                                              下载 CSV
                                            </a>
                                          </>
                                        )}
                                        {run.status === 'failed' && (
                                          <span className="text-red-500">失败：{run.error_message || run.apify_status || '未知错误'}</span>
                                        )}
                                        <span style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>
                                          ID: {run.apify_run_id?.slice(0, 8) || run.id.slice(0, 8)}...
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((keyword, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                              <input
                                type="checkbox"
                                checked={selectedItems[phase]?.has(`q_${idx}`) || false}
                                onChange={() => toggleItemSelection(phase, `q_${idx}`)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">{keyword}</span>
                              <button
                                onClick={() => startSingleScraping(phase, `q_${idx}`, keyword)}
                                disabled={loading}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                              >
                                抓取
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* 高级参数配置 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <button
                onClick={() => setExpandedPhases(prev => ({ ...prev, advanced: !prev.advanced }))}
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <svg className={`w-4 h-4 transition-transform ${expandedPhases.advanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                高级 Apify 参数配置
              </button>
              
              {expandedPhases.advanced && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">includeComments (是否抓取评论)</label>
                    <select
                      value={advancedConfig.includeComments ? 'true' : 'false'}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, includeComments: e.target.value === 'true' }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">maxCommentsPerPost (每帖子最大评论数)</label>
                    <input
                      type="number"
                      value={advancedConfig.maxCommentsPerPost}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, maxCommentsPerPost: parseInt(e.target.value) || 20 }))}
                      min={1}
                      max={100}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">commentDepth (评论深度)</label>
                    <input
                      type="number"
                      value={advancedConfig.commentDepth}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, commentDepth: parseInt(e.target.value) || 3 }))}
                      min={1}
                      max={10}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">maxRetries (最大重试次数)</label>
                    <input
                      type="number"
                      value={advancedConfig.maxRetries}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 5 }))}
                      min={0}
                      max={10}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">deduplicatePosts (去重)</label>
                    <select
                      value={advancedConfig.deduplicatePosts ? 'true' : 'false'}
                      onChange={(e) => setAdvancedConfig(prev => ({ ...prev, deduplicatePosts: e.target.value === 'true' }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  </div>
                  <div className="col-span-2 text-xs text-slate-500 bg-slate-50 p-3 rounded">
                    <strong>参数说明：</strong> 这些参数控制 Apify Reddit Scraper 的行为。
                    includeComments开启后会在帖子下抓取评论；maxCommentsPerPost限制每帖评论数；
                    commentDepth控制评论嵌套深度；deduplicatePosts去除重复帖子；
                    maxRetries网络失败时的重试次数。
                  </div>
                </div>
              )}
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

            <div className="mt-4 flex items-center gap-3 text-sm">
              <button
                onClick={() => setAutoPollingEnabled((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg border ${
                  autoPollingEnabled
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {autoPollingEnabled ? '自动轮询: 开' : '自动轮询: 关'}
              </button>
              <span className={autoPollingEnabled && hasActiveRuns ? 'text-blue-600' : 'text-slate-500'}>
                {autoPollingEnabled && hasActiveRuns ? '每 10 秒自动同步一次任务状态' : '自动轮询已停止'}
              </span>
              {lastSyncAt && (
                <span className="text-slate-400">上次同步: {new Date(lastSyncAt).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        )}

        {/* 任务列表 */}
        {runs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">任务列表</h2>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => syncRuns()}
                disabled={isSyncingRuns}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                {isSyncingRuns ? '同步中...' : '同步所有任务状态'}
              </button>
              <span className="text-xs text-slate-500">
                统一走后端同步接口，状态刷新、结果拉取和 `posts` 入库都在服务端完成
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 font-medium text-slate-700">阶段</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">查询词</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">Subreddit</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">Apify Run ID</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">参数</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">状态</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">结果</th>
                    <th className="text-left py-3 px-2 font-medium text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    if (!run) return null
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
                          {run.apify_run_id ? (
                            <a
                              href={`https://console.apify.com/actors/${REDDIT_SCRAPER_ACTOR_ID}/runs/${run.apify_run_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                              title="在 Apify 后台查看"
                            >
                              {run.apify_run_id.slice(0, 12)}...
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs text-slate-500">
                            {run.params?.time_range || '-'} | {run.params?.max_posts || 0}条 | {run.params?.sort_by || '-'}
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
            disabled={!selectedProject || loading || totalKeywords === 0}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                启动中...
              </>
            ) : (
              <>🚀 启动全部抓取任务</>
            )}
          </button>

          {stats.succeeded > 0 && !hasActiveRuns && (
            <button
              onClick={() => window.location.href = '/workflow/analysis'}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-lg"
            >
              下一步：分析筛选 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
