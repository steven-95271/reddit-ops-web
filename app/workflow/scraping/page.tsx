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
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null)
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

  // 简单/高级模式切换
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)

  // 高级模式参数（每 phase 独立）
  const [advancedParams, setAdvancedParams] = useState<Record<string, {
    maxPostsPerSource: number
    includeComments: boolean
    maxCommentsPerPost: number
    commentDepth: number
    deduplicatePosts: boolean
    maxRetries: number
    filterKeywords: string[]
    keywordMatchMode: string
    maxCostPerRun: number
  }>>({})

  const defaultAdvancedParams = {
    maxPostsPerSource: 30,
    includeComments: true,
    maxCommentsPerPost: 10,
    commentDepth: 2,
    deduplicatePosts: true,
    maxRetries: 3,
    filterKeywords: [] as string[],
    keywordMatchMode: 'Any keyword (title + body)',
    maxCostPerRun: 2,
  }

  // 过滤关键词输入
  const [filterKeywordInputs, setFilterKeywordInputs] = useState<Record<string, string>>({})

  const addFilterKeyword = (phase: string) => {
    const input = filterKeywordInputs[phase]?.trim()
    if (!input) return
    const current = getPhaseAdvanced(phase).filterKeywords
    if (current.includes(input)) return
    updatePhaseAdvanced(phase, 'filterKeywords', [...current, input])
    setFilterKeywordInputs(prev => ({ ...prev, [phase]: '' }))
  }

  const removeFilterKeyword = (phase: string, kw: string) => {
    const current = getPhaseAdvanced(phase).filterKeywords
    updatePhaseAdvanced(phase, 'filterKeywords', current.filter(k => k !== kw))
  }

  // 临时关键词覆盖：phase -> string[]（null 表示使用原始配置）
  const [keywordOverrides, setKeywordOverrides] = useState<Record<string, string[] | null>>({})

  // 新关键词输入框
  const [newKeywordInputs, setNewKeywordInputs] = useState<Record<string, string>>({})

  // 获取某 phase 的生效关键词列表
  const getEffectiveKeywords = (phase: string): string[] => {
    if (keywordOverrides[phase] !== null && keywordOverrides[phase] !== undefined) {
      return keywordOverrides[phase]!
    }
    if (phase === 'phase4_subreddits') return []
    const phaseKey = phase as 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain'
    return selectedProject?.keywords?.[phaseKey]?.queries || []
  }

  const hasKeywordOverride = (phase: string) => keywordOverrides[phase] !== null && keywordOverrides[phase] !== undefined

  const resetKeywords = (phase: string) => {
    setKeywordOverrides(prev => {
      const next = { ...prev }
      delete next[phase]
      return next
    })
  }

  const addTempKeyword = (phase: string) => {
    const input = newKeywordInputs[phase]?.trim()
    if (!input) return
    const current = getEffectiveKeywords(phase)
    if (current.includes(input)) return
    setKeywordOverrides(prev => ({
      ...prev,
      [phase]: [...current, input]
    }))
    setNewKeywordInputs(prev => ({ ...prev, [phase]: '' }))
  }

  const removeKeyword = (phase: string, keyword: string) => {
    const current = getEffectiveKeywords(phase)
    setKeywordOverrides(prev => ({
      ...prev,
      [phase]: current.filter(k => k !== keyword)
    }))
  }

  // 获取某 phase 的高级参数
  const getPhaseAdvanced = (phase: string) => advancedParams[phase] || defaultAdvancedParams

  const updatePhaseAdvanced = (phase: string, key: string, value: any) => {
    setAdvancedParams(prev => ({
      ...prev,
      [phase]: { ...(prev[phase] || defaultAdvancedParams), [key]: value }
    }))
  }

  // 成本估算
  const estimateCost = (phase: string) => {
    const p = getPhaseAdvanced(phase)
    const cost = (p.maxPostsPerSource * 0.0008) + (p.maxPostsPerSource * p.maxCommentsPerPost * 0.0004) + 0.003
    const totalComments = p.includeComments ? p.maxPostsPerSource * p.maxCommentsPerPost : 0
    return { cost: cost.toFixed(3), posts: p.maxPostsPerSource, comments: totalComments, cap: p.maxCostPerRun }
  }

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
          ...(isAdvancedMode ? { advanced_config: getPhaseAdvanced('phase4_subreddits') } : {}),
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
            ...(isAdvancedMode ? getPhaseAdvanced(phase) : advancedConfig)
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
              const effectiveSearchWithin = hasKeywordOverride(phase)
                ? getEffectiveKeywords(phase)
                : (target.search_within || [])
              for (const kw of (effectiveSearchWithin.length > 0 ? effectiveSearchWithin : [''])) {
                itemsToScrape.push({
                  phase,
                  query: kw,
                  subreddit: target.subreddit
                })
              }
            }
          }
        } else {
          const effectiveQueries = getEffectiveKeywords(phase)
          for (let i = 0; i < effectiveQueries.length; i++) {
            if (itemSet.has(`q_${i}`)) {
              itemsToScrape.push({ phase, query: effectiveQueries[i] })
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
          items: itemsToScrape,
          ...(isAdvancedMode ? { advanced_config: advancedParams } : {}),
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
      phase1_brand: getEffectiveKeywords('phase1_brand').length,
      phase2_competitor: getEffectiveKeywords('phase2_competitor').length,
      phase3_scene_pain: getEffectiveKeywords('phase3_scene_pain').length,
      phase4_subreddits: selectedProject.keywords.phase4_subreddits?.targets?.length || 0
    }
  }

  const phaseCounts = getPhaseCounts()
  const totalKeywords = Object.values(phaseCounts).reduce((a, b) => a + b, 0)
  const hasActiveRuns = runs.some((run) => run.status === 'pending' || run.status === 'running')

  const getRunsForSubreddit = (subredditName: string) =>
    runs.filter((run) => run.phase === 'phase4_subreddits' && run.subreddit === subredditName)

  const exportProjectPosts = async (format: 'csv' | 'xlsx') => {
    if (!selectedProject?.id) {
      showToast('请先选择一个项目', 'error')
      return
    }

    setExportingFormat(format)
    try {
      const res = await fetch(`/api/posts/export?project_id=${selectedProject.id}&format=${format}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '导出失败')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition')
      const fileNameMatch = disposition?.match(/filename="([^"]+)"/)
      const fileName = fileNameMatch?.[1] || `${selectedProject.name}_posts.${format}`
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出失败', 'error')
    } finally {
      setExportingFormat(null)
    }
  }

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

              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">导出当前项目全部 posts</div>
                  <div className="text-xs text-slate-500">
                    按当前项目导出已入库帖子，包含 run id、apify_run_id、batch_id、phase 等抓取来源字段
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportProjectPosts('csv')}
                    disabled={exportingFormat !== null}
                    className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {exportingFormat === 'csv' ? '导出中...' : '下载 CSV'}
                  </button>
                  <button
                    onClick={() => exportProjectPosts('xlsx')}
                    disabled={exportingFormat !== null}
                    className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {exportingFormat === 'xlsx' ? '导出中...' : '下载 XLSX'}
                  </button>
                </div>
              </div>
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
                <div className="flex items-center gap-3">
                  {/* 简单/高级模式切换 */}
                  <button
                    onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      isAdvancedMode
                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {isAdvancedMode ? '高级模式' : '简单模式'}
                  </button>
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
              const overridden = hasKeywordOverride(phase)
              const effectiveKeywords = getEffectiveKeywords(phase)

              let targets: Array<{ subreddit: string; reason: string; search_within: string[] }> = []
              if (phase === 'phase4_subreddits') {
                targets = selectedProject?.keywords?.phase4_subreddits?.targets || []
              }

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

                    {/* 简单模式参数（3 列） */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">时间范围</label>
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
                        <label className="text-xs font-medium text-slate-600">最大数量</label>
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
                        <label className="text-xs font-medium text-slate-600">排序方式</label>
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

                    {/* 高级模式参数面板 */}
                    {isAdvancedMode && (
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="text-xs font-medium text-purple-700 mb-2">高级 Apify 参数</div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-slate-600">maxPostsPerSource</label>
                            <input
                              type="number"
                              value={getPhaseAdvanced(phase).maxPostsPerSource}
                              onChange={(e) => updatePhaseAdvanced(phase, 'maxPostsPerSource', parseInt(e.target.value) || 30)}
                              min={1} max={500}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">includeComments</label>
                            <select
                              value={getPhaseAdvanced(phase).includeComments ? 'true' : 'false'}
                              onChange={(e) => updatePhaseAdvanced(phase, 'includeComments', e.target.value === 'true')}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            >
                              <option value="true">是</option>
                              <option value="false">否</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">maxCommentsPerPost</label>
                            <input
                              type="number"
                              value={getPhaseAdvanced(phase).maxCommentsPerPost}
                              onChange={(e) => updatePhaseAdvanced(phase, 'maxCommentsPerPost', parseInt(e.target.value) || 10)}
                              min={0} max={100}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">commentDepth</label>
                            <input
                              type="number"
                              value={getPhaseAdvanced(phase).commentDepth}
                              onChange={(e) => updatePhaseAdvanced(phase, 'commentDepth', parseInt(e.target.value) || 2)}
                              min={1} max={5}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">deduplicatePosts</label>
                            <select
                              value={getPhaseAdvanced(phase).deduplicatePosts ? 'true' : 'false'}
                              onChange={(e) => updatePhaseAdvanced(phase, 'deduplicatePosts', e.target.value === 'true')}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            >
                              <option value="true">是</option>
                              <option value="false">否</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">maxRetries</label>
                            <input
                              type="number"
                              value={getPhaseAdvanced(phase).maxRetries}
                              onChange={(e) => updatePhaseAdvanced(phase, 'maxRetries', parseInt(e.target.value) || 3)}
                              min={0} max={10}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">maxCostPerRun ($)</label>
                            <input
                              type="number"
                              value={getPhaseAdvanced(phase).maxCostPerRun}
                              onChange={(e) => updatePhaseAdvanced(phase, 'maxCostPerRun', parseFloat(e.target.value) || 2)}
                              min={0.1} max={10} step={0.1}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-600">keywordMatchMode</label>
                            <select
                              value={getPhaseAdvanced(phase).keywordMatchMode}
                              onChange={(e) => updatePhaseAdvanced(phase, 'keywordMatchMode', e.target.value)}
                              className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-xs"
                            >
                              <option value="Any keyword (title + body)">Any keyword (title + body)</option>
                              <option value="Any keyword in title only">Any keyword in title only</option>
                              <option value="All keywords (title + body)">All keywords (title + body)</option>
                            </select>
                          </div>
                          <div className="col-span-4">
                            <label className="text-xs text-slate-600">filterKeywords（帖子二次过滤）</label>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {getPhaseAdvanced(phase).filterKeywords.map((kw, ki) => (
                                <span key={ki} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs border border-purple-200">
                                  {kw}
                                  <button onClick={() => removeFilterKeyword(phase, kw)} className="text-purple-400 hover:text-red-500">✕</button>
                                </span>
                              ))}
                              <input
                                type="text"
                                value={filterKeywordInputs[phase] || ''}
                                onChange={(e) => setFilterKeywordInputs(prev => ({ ...prev, [phase]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') addFilterKeyword(phase) }}
                                placeholder="输入过滤词后回车"
                                className="px-2 py-0.5 border border-dashed border-purple-300 rounded text-xs bg-purple-50 w-36 focus:ring-1 focus:ring-purple-400"
                              />
                            </div>
                          </div>
                        </div>
                        {/* 成本估算 */}
                        <div className="mt-2 text-xs text-purple-700 bg-purple-100 rounded px-2 py-1">
                          预估：每词最多抓取 {estimateCost(phase).posts} 条帖子 + {estimateCost(phase).comments} 条评论，单次最大成本上限 ${estimateCost(phase).cap}（实际开销可能因过滤后更低）
                        </div>
                      </div>
                    )}

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
                          if (phase === 'phase4_subreddits') {
                            targets.forEach(t => {
                              startSingleScraping(phase, t.subreddit, t.search_within?.[0] || '', t.subreddit)
                            })
                          } else {
                            effectiveKeywords.forEach((q, i) => {
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
                                {hasSubredditRuns && (
                                  <div className="mt-3 pl-7 space-y-2">
                                    {subredditRuns.map((run) => (
                                      <div key={run.id} className="text-xs flex items-center gap-2 flex-wrap">
                                        <span className="text-slate-600">{run.query || '(空关键词)'}</span>
                                        {run.status === 'pending' && <span className="text-slate-500">等待启动</span>}
                                        {run.status === 'running' && <span className="text-blue-500">抓取中 · {run.total_posts} 条</span>}
                                        {run.status === 'succeeded' && (
                                          <>
                                            <span className="text-green-500">已完成 · {run.total_posts} 条 · ${run.cost_usd?.toFixed(3) || '0.000'}</span>
                                            <a href={`/api/scraping/${run.id}/download`} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">下载 CSV</a>
                                          </>
                                        )}
                                        {run.status === 'failed' && <span className="text-red-500">失败：{run.error_message || run.apify_status || '未知错误'}</span>}
                                        <span style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>ID: {run.apify_run_id?.slice(0, 8) || run.id.slice(0, 8)}...</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div>
                          {/* 临时标记提示 */}
                          {overridden && (
                            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-amber-50 border border-dashed border-amber-300 rounded text-xs text-amber-700">
                              <span>已修改本次关键词（不保存到 P1 配置）</span>
                              <button
                                onClick={() => resetKeywords(phase)}
                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 rounded font-medium"
                              >
                                重置为原始配置
                              </button>
                            </div>
                          )}
                          {/* 关键词列表 */}
                          <div className="flex flex-wrap gap-2">
                            {effectiveKeywords.map((keyword, idx) => {
                              const originalKeywords = (() => {
                                const pk = phase as 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain'
                                return selectedProject?.keywords?.[pk]?.queries || []
                              })()
                              const isTemp = !originalKeywords.includes(keyword)
                              const isRemoved = overridden && !effectiveKeywords.includes(keyword) && originalKeywords.includes(keyword)
                              if (isRemoved) return null
                              return (
                                <div key={idx} className={`flex items-center gap-1.5 p-2 rounded-lg border text-sm ${
                                  isTemp
                                    ? 'bg-amber-50 border-dashed border-amber-300 text-amber-800'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedItems[phase]?.has(`q_${idx}`) || false}
                                    onChange={() => toggleItemSelection(phase, `q_${idx}`)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{keyword}</span>
                                  {isTemp && <span className="text-[10px] text-amber-500">临时</span>}
                                  <button
                                    onClick={() => removeKeyword(phase, keyword)}
                                    className="text-slate-400 hover:text-red-500 ml-1"
                                    title="从本次抓取移除"
                                  >
                                    ✕
                                  </button>
                                  <button
                                    onClick={() => startSingleScraping(phase, `q_${idx}`, keyword)}
                                    disabled={loading}
                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                                  >
                                    抓取
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                          {/* 添加临时关键词 */}
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="text"
                              value={newKeywordInputs[phase] || ''}
                              onChange={(e) => setNewKeywordInputs(prev => ({ ...prev, [phase]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') addTempKeyword(phase) }}
                              placeholder="输入临时关键词（本次有效，不保存）"
                              className="flex-1 px-3 py-2 border border-dashed border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-amber-400"
                            />
                            <button
                              onClick={() => addTempKeyword(phase)}
                              className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 border border-dashed border-amber-300"
                            >
                              + 添加
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

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
