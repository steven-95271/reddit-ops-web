'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'

interface Project {
  id: string
  name: string
  product_name: string
}

interface Post {
  id: string
  reddit_id: string
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  score: number
  num_comments: number
  upvote_ratio: number
  created_utc: string
  phase: string | null
  matched_keyword: string | null
  type: string | null
  post_id: string | null
  post_title: string | null
  subreddit_subscribers: number | null
  link_flair_text: string | null
  permalink: string | null
  is_stickied: boolean | null
  is_nsfw: boolean | null
  replies: number | null
  total_awards: number | null
  quality_score: number | null
  ai_label: string | null
  is_candidate: boolean
  ignored: boolean
}

type SortKey = 'score' | 'num_comments' | 'upvote_ratio' | 'created_utc' | 'subreddit_subscribers'
type SortOrder = 'asc' | 'desc'

const PAGE_SIZE = 50

const phaseLabels: Record<string, { label: string; color: string; bg: string }> = {
  phase1_brand: { label: 'P1', color: 'text-blue-700', bg: 'bg-blue-100' },
  phase2_competitor: { label: 'P2', color: 'text-orange-700', bg: 'bg-orange-100' },
  phase3_scene_pain: { label: 'P3', color: 'text-green-700', bg: 'bg-green-100' },
  phase4_subreddits: { label: 'P4', color: 'text-purple-700', bg: 'bg-purple-100' },
}

function relativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 60) return `${mins} 分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} 个月前`
    return `${Math.floor(months / 12)} 年前`
  } catch {
    return '-'
  }
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function AnalysisPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedBody, setExpandedBody] = useState<string | null>(null)

  // 筛选
  const [filterType, setFilterType] = useState<'all' | 'post' | 'comment'>('post')
  const [filterSubreddits, setFilterSubreddits] = useState<Set<string>>(new Set())
  const [filterMinSubs, setFilterMinSubs] = useState(0)
  const [filterPhases, setFilterPhases] = useState<Set<string>>(new Set())
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterFlairs, setFilterFlairs] = useState<Set<string>>(new Set())
  const [filterTimeRange, setFilterTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all')
  const [filterMinUpvotes, setFilterMinUpvotes] = useState(0)
  const [filterMinComments, setFilterMinComments] = useState(0)
  const [filterMinRatio, setFilterMinRatio] = useState(0)
  const [filterExcludeStickied, setFilterExcludeStickied] = useState(true)
  const [filterExcludeNsfw, setFilterExcludeNsfw] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'candidate' | 'untagged'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // 排序
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // 分页
  const [page, setPage] = useState(0)

  // 勾选
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 导出中
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null)

  useEffect(() => { fetchProjects() }, [])

  useEffect(() => {
    if (selectedProjectId) loadPosts(selectedProjectId)
  }, [selectedProjectId])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (data.success) setProjects(data.data || [])
    } catch { showToast('获取项目失败', 'error') }
  }

  async function loadPosts(projectId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/posts?project_id=${projectId}`)
      const data = await res.json()
      if (data.success) {
        setPosts(data.data.posts || [])
      } else {
        showToast(data.error || '加载失败', 'error')
      }
    } catch { showToast('加载帖子失败', 'error') }
    finally { setLoading(false) }
  }

  // 动态提取筛选选项
  const subreddits = useMemo(() => {
    const map = new Map<string, number>()
    posts.forEach(p => { if (p.subreddit) map.set(p.subreddit, (map.get(p.subreddit) || 0) + 1) })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [posts])

  const flairOptions = useMemo(() => {
    const s = new Set<string>()
    posts.forEach(p => { if (p.link_flair_text) s.add(p.link_flair_text) })
    return Array.from(s).sort()
  }, [posts])

  const keywordOptions = useMemo(() => {
    const s = new Set<string>()
    posts.forEach(p => { if (p.matched_keyword) s.add(p.matched_keyword) })
    return Array.from(s).sort()
  }, [posts])

  const phases = useMemo(() => {
    const s = new Set<string>()
    posts.forEach(p => { if (p.phase) s.add(p.phase) })
    return Array.from(s)
  }, [posts])

  // 筛选
  const filteredPosts = useMemo(() => {
    const now = Date.now()
    return posts.filter(p => {
      if (filterType !== 'all' && p.type !== filterType) return false
      if (filterSubreddits.size > 0 && !filterSubreddits.has(p.subreddit)) return false
      if (filterMinSubs > 0 && (p.subreddit_subscribers || 0) < filterMinSubs) return false
      if (filterPhases.size > 0 && (!p.phase || !filterPhases.has(p.phase))) return false
      if (filterKeyword && p.matched_keyword !== filterKeyword) return false
      if (filterFlairs.size > 0 && (!p.link_flair_text || !filterFlairs.has(p.link_flair_text))) return false
      if (filterTimeRange !== 'all') {
        const d = new Date(p.created_utc).getTime()
        const ms = filterTimeRange === '24h' ? 86400000 : filterTimeRange === '7d' ? 604800000 : 2592000000
        if (now - d > ms) return false
      }
      if (filterMinUpvotes > 0 && (p.score || 0) < filterMinUpvotes) return false
      if (filterMinComments > 0 && (p.num_comments || 0) < filterMinComments) return false
      if (filterMinRatio > 0 && (p.upvote_ratio || 0) < filterMinRatio) return false
      if (filterExcludeStickied && p.is_stickied) return false
      if (filterExcludeNsfw && p.is_nsfw) return false
      if (filterStatus === 'candidate' && !p.is_candidate) return false
      if (filterStatus === 'untagged' && (p.is_candidate || p.ignored)) return false
      return true
    })
  }, [posts, filterType, filterSubreddits, filterMinSubs, filterPhases, filterKeyword, filterFlairs, filterTimeRange, filterMinUpvotes, filterMinComments, filterMinRatio, filterExcludeStickied, filterExcludeNsfw, filterStatus])

  // 排序
  const sortedPosts = useMemo(() => {
    const arr = [...filteredPosts]
    const dir = sortOrder === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const va = (a[sortKey] as number) ?? 0
      const vb = (b[sortKey] as number) ?? 0
      return (va - vb) * dir
    })
    return arr
  }, [filteredPosts, sortKey, sortOrder])

  // 分页
  const totalPages = Math.ceil(sortedPosts.length / PAGE_SIZE)
  const pagePosts = sortedPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // 统计
  const stats = useMemo(() => ({
    total: posts.length,
    candidates: posts.filter(p => p.is_candidate).length,
    ignored: posts.filter(p => p.ignored).length,
    pending: posts.filter(p => !p.is_candidate && !p.ignored).length,
    filtered: filteredPosts.length,
  }), [posts, filteredPosts])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortOrder('desc') }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pagePosts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagePosts.map(p => p.id)))
    }
  }

  const resetFilters = () => {
    setFilterType('post')
    setFilterSubreddits(new Set())
    setFilterMinSubs(0)
    setFilterPhases(new Set())
    setFilterKeyword('')
    setFilterFlairs(new Set())
    setFilterTimeRange('all')
    setFilterMinUpvotes(0)
    setFilterMinComments(0)
    setFilterMinRatio(0)
    setFilterExcludeStickied(true)
    setFilterExcludeNsfw(true)
    setFilterStatus('all')
    setPage(0)
  }

  const markCandidates = async (is_candidate: boolean) => {
    if (selectedIds.size === 0) return
    try {
      const res = await fetch('/api/analysis/candidates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_ids: Array.from(selectedIds), is_candidate })
      })
      const data = await res.json()
      if (data.success) {
        showToast(`已${is_candidate ? '标记' : '取消'} ${data.data.updated_count} 条候选`, 'success')
        setSelectedIds(new Set())
        if (selectedProjectId) loadPosts(selectedProjectId)
      } else {
        showToast(data.error || '操作失败', 'error')
      }
    } catch { showToast('操作失败', 'error') }
  }

  const ignorePosts = async (ignored: boolean) => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map(id =>
        fetch(`/api/posts/${id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: ignored ? 'ignore' : 'unignore' })
        })
      ))
      showToast(`已${ignored ? '忽略' : '取消忽略'} ${ids.length} 条`, 'success')
      setSelectedIds(new Set())
      if (selectedProjectId) loadPosts(selectedProjectId)
    } catch { showToast('操作失败', 'error') }
  }

  const exportPosts = async (format: 'csv' | 'xlsx') => {
    if (!selectedProjectId) return
    setExportingFormat(format)
    try {
      const res = await fetch(`/api/posts/export?project_id=${selectedProjectId}&format=${format}`)
      if (!res.ok) throw new Error('导出失败')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition')
      const fileNameMatch = disposition?.match(/filename="([^"]+)"/)
      const fileName = fileNameMatch?.[1] || `posts.${format}`
      const link = document.createElement('a')
      link.href = url; link.download = fileName
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch { showToast('导出失败', 'error') }
    finally { setExportingFormat(null) }
  }

  const exportSelectedCsv = () => {
    const selected = sortedPosts.filter(p => selectedIds.has(p.id))
    if (selected.length === 0) return
    const headers = ['id', 'subreddit', 'title', 'score', 'num_comments', 'upvote_ratio', 'created_utc', 'phase', 'matched_keyword', 'is_candidate', 'ignored']
    const lines = [headers.join(','), ...selected.map(p => headers.map(h => escapeCsvValue((p as any)[h])).join(','))]
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `selected_${selected.length}_posts.csv`
    document.body.appendChild(link); link.click(); link.remove()
    window.URL.revokeObjectURL(url)
  }

  const toggleMultiSelect = (set: Set<string>, val: string) => {
    const next = new Set(set)
    if (next.has(val)) next.delete(val); else next.add(val)
    return next
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-slate-400">
      {sortKey === col ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">P3 候选筛选</h1>
          <p className="text-slate-600 mt-2">多维硬指标筛选，人工排序决策，从海量帖子中选出高价值候选</p>
        </div>

        <div className="mb-6">
          <WorkflowGuide
            title="P3 候选筛选"
            description="通过多维硬性指标手动筛选有价值的候选帖"
            steps={[
              { title: '选择项目', description: '加载该项目的全部抓取数据' },
              { title: '多维筛选', description: '按 upvotes、评论数、subreddit 规模等硬指标过滤' },
              { title: '排序分析', description: '点击表头排序，展开查看帖子正文' },
              { title: '标记候选', description: '勾选有价值的帖子，批量标记进入 P4' },
            ]}
            details={`【P3 工作流】\n从 P2 抓到的海量帖子中，通过多维硬性指标手动筛选候选。\n\n【筛选逻辑】\n不依赖 AI 评分。提供排序和筛选工具：\n• 按 upvotes 排序，先看最热门的\n• 按 subreddit 筛选，只看最相关的社区\n• 按订阅数筛选，区分大社区和小众垂直社区\n• 按 Flair 筛选，专门看 Review 或 Discussion\n• 排除置顶帖和 NSFW\n\n【人工决策】\n自己判断是否有营销价值，勾选标记为候选。\n\n【导出检查】\n筛选后可导出 CSV/XLSX，分享给团队进一步分析。`}
          />
        </div>

        {/* 项目选择 + 概览 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">选择项目</label>
              <select
                value={selectedProjectId}
                onChange={(e) => { setSelectedProjectId(e.target.value); setPage(0); setSelectedIds(new Set()) }}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择项目</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name} - {p.product_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-6">
              <button onClick={() => exportPosts('csv')} disabled={!selectedProjectId || exportingFormat !== null}
                className="px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                {exportingFormat === 'csv' ? '导出中...' : '导出 CSV'}
              </button>
              <button onClick={() => exportPosts('xlsx')} disabled={!selectedProjectId || exportingFormat !== null}
                className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                {exportingFormat === 'xlsx' ? '导出中...' : '导出 XLSX'}
              </button>
            </div>
          </div>

          {posts.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                <div className="text-xs text-slate-500">总帖子</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.candidates}</div>
                <div className="text-xs text-green-600">已标记候选</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.ignored}</div>
                <div className="text-xs text-red-600">已忽略</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
                <div className="text-xs text-blue-600">待处理</div>
              </div>
            </div>
          )}
        </div>

        {posts.length > 0 && (
          <>
            {/* 筛选工具栏 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowFilters(!showFilters)}
                    className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    筛选条件
                  </button>
                  <span className="text-xs text-slate-500">
                    筛选后 {stats.filtered} / {stats.total} 条
                  </span>
                </div>
                <button onClick={resetFilters} className="text-xs text-blue-600 hover:text-blue-800">重置筛选</button>
              </div>

              {/* 快捷筛选行 */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">类型:</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
                    className="px-2 py-1.5 border border-slate-300 rounded text-xs">
                    <option value="all">全部</option>
                    <option value="post">Post</option>
                    <option value="comment">Comment</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">Upvotes ≥</label>
                  <input type="number" value={filterMinUpvotes} onChange={(e) => setFilterMinUpvotes(parseInt(e.target.value) || 0)}
                    min={0} className="w-16 px-2 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">评论 ≥</label>
                  <input type="number" value={filterMinComments} onChange={(e) => setFilterMinComments(parseInt(e.target.value) || 0)}
                    min={0} className="w-16 px-2 py-1.5 border border-slate-300 rounded text-xs" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">时间:</label>
                  <select value={filterTimeRange} onChange={(e) => setFilterTimeRange(e.target.value as any)}
                    className="px-2 py-1.5 border border-slate-300 rounded text-xs">
                    <option value="all">全部</option>
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">状态:</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-2 py-1.5 border border-slate-300 rounded text-xs">
                    <option value="all">全部</option>
                    <option value="candidate">仅候选</option>
                    <option value="untagged">仅未处理</option>
                  </select>
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={filterExcludeStickied} onChange={(e) => setFilterExcludeStickied(e.target.checked)} className="rounded" />
                  排除置顶
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={filterExcludeNsfw} onChange={(e) => setFilterExcludeNsfw(e.target.checked)} className="rounded" />
                  排除 NSFW
                </label>
              </div>

              {/* 高级筛选面板 */}
              {showFilters && (
                <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Subreddit (多选)</label>
                    <select multiple value={Array.from(filterSubreddits)}
                      onChange={(e) => setFilterSubreddits(new Set(Array.from(e.target.selectedOptions, o => o.value)))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-24">
                      {subreddits.map(([name, cnt]) => <option key={name} value={name}>r/{name} ({cnt})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phase 来源 (多选)</label>
                    <select multiple value={Array.from(filterPhases)}
                      onChange={(e) => setFilterPhases(new Set(Array.from(e.target.selectedOptions, o => o.value)))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-24">
                      {phases.map(p => {
                        const info = phaseLabels[p]
                        return <option key={p} value={p}>{info?.label || p} {info?.label ? p.replace('phase', 'Phase ').replace('_', ' ') : ''}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Flair (多选)</label>
                    <select multiple value={Array.from(filterFlairs)}
                      onChange={(e) => setFilterFlairs(new Set(Array.from(e.target.selectedOptions, o => o.value)))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-24">
                      {flairOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">命中关键词</label>
                    <select value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs">
                      <option value="">全部</option>
                      {keywordOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">订阅数 ≥</label>
                    <input type="number" value={filterMinSubs} onChange={(e) => setFilterMinSubs(parseInt(e.target.value) || 0)}
                      min={0} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Upvote Ratio ≥</label>
                    <input type="number" value={filterMinRatio} onChange={(e) => setFilterMinRatio(parseFloat(e.target.value) || 0)}
                      min={0} max={1} step={0.05} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* 批量操作栏 */}
            {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-4 sticky top-0 z-10">
                <span className="text-sm font-medium text-blue-800">已选择 {selectedIds.size} 条帖子</span>
                <button onClick={() => markCandidates(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                  标记为候选
                </button>
                <button onClick={() => ignorePosts(true)}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700">
                  忽略
                </button>
                <button onClick={exportSelectedCsv}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                  导出选中 CSV
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800">取消选择</button>
              </div>
            )}

            {/* 数据表格 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="py-3 px-2 w-8">
                        <input type="checkbox" checked={pagePosts.length > 0 && selectedIds.size === pagePosts.length}
                          ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < pagePosts.length }}
                          onChange={toggleSelectAll} className="rounded" />
                      </th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-14">类型</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 min-w-[300px]">标题</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-28">r/Subreddit</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-24">Flair</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-20 cursor-pointer select-none hover:text-blue-600"
                        onClick={() => toggleSort('created_utc')}>
                        发帖时间<SortIcon col="created_utc" />
                      </th>
                      <th className="py-3 px-2 text-right font-medium text-slate-700 w-20 cursor-pointer select-none hover:text-blue-600"
                        onClick={() => toggleSort('score')}>
                        Upvotes<SortIcon col="score" />
                      </th>
                      <th className="py-3 px-2 text-right font-medium text-slate-700 w-16 cursor-pointer select-none hover:text-blue-600"
                        onClick={() => toggleSort('num_comments')}>
                        评论<SortIcon col="num_comments" />
                      </th>
                      <th className="py-3 px-2 text-right font-medium text-slate-700 w-16 cursor-pointer select-none hover:text-blue-600"
                        onClick={() => toggleSort('upvote_ratio')}>
                        Ratio<SortIcon col="upvote_ratio" />
                      </th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-24">命中词</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-16">Phase</th>
                      <th className="py-3 px-2 text-left font-medium text-slate-700 w-32">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagePosts.map(p => {
                      const pi = p.phase ? phaseLabels[p.phase] : null
                      const pUrl = p.permalink ? `https://www.reddit.com${p.permalink}` : p.url
                      const isExpanded = expandedBody === p.id
                      return (
                        <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 ${p.is_candidate ? 'bg-green-50' : ''} ${p.ignored ? 'bg-slate-100 opacity-60' : ''}`}>
                          <td className="py-2 px-2">
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.type === 'comment' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                              {p.type === 'comment' ? '评' : '帖'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setExpandedBody(isExpanded ? null : p.id)}
                                className="text-left text-slate-800 hover:text-blue-600 max-w-full">
                                <span className="truncate block max-w-[300px]">{p.title || '(无标题)'}</span>
                              </button>
                              {p.is_candidate && <span className="text-green-500 text-xs">★</span>}
                            </div>
                            {isExpanded && (
                              <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 max-w-lg whitespace-pre-wrap">
                                {(p.body || '').slice(0, 500)}
                                {(p.body || '').length > 500 && '...'}
                                {pUrl && <a href={pUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 text-blue-600 hover:underline">查看完整内容 →</a>}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-blue-600 text-xs" title={`${(p.subreddit_subscribers || 0).toLocaleString()} 订阅`}>
                              r/{p.subreddit}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {p.link_flair_text && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{p.link_flair_text}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs text-slate-500" title={p.created_utc}>
                            {relativeTime(p.created_utc)}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-800">{p.score}</td>
                          <td className="py-2 px-2 text-right text-slate-600">{p.num_comments}</td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {p.upvote_ratio ? (p.upvote_ratio * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td className="py-2 px-2 text-xs text-slate-500 truncate max-w-[100px]" title={p.matched_keyword || ''}>
                            {p.matched_keyword || '-'}
                          </td>
                          <td className="py-2 px-2">
                            {pi && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pi.bg} ${pi.color}`}>{pi.label}</span>}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              {pUrl && (
                                <a href={pUrl} target="_blank" rel="noopener noreferrer"
                                  className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] hover:bg-slate-200">原文</a>
                              )}
                              {!p.is_candidate && (
                                <button onClick={() => markCandidates(true)}
                                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] hover:bg-green-200">候选</button>
                              )}
                              {p.is_candidate && (
                                <button onClick={() => markCandidates(false)}
                                  className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] hover:bg-yellow-200">取消</button>
                              )}
                              {!p.ignored && (
                                <button onClick={() => ignorePosts(true)}
                                  className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200">忽略</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    第 {page + 1} / {totalPages} 页，共 {sortedPosts.length} 条
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(0)} disabled={page === 0}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30">首页</button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30">上一页</button>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30">下一页</button>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-30">末页</button>
                  </div>
                </div>
              )}
            </div>

            {/* 底部导航 */}
            <div className="flex gap-4">
              <button onClick={() => window.location.href = '/workflow/scraping'}
                className="px-6 py-3 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl font-semibold hover:from-slate-600 hover:to-slate-700 flex items-center gap-2">
                ← 返回 P2 抓取
              </button>
              {stats.candidates > 0 && (
                <button onClick={() => window.location.href = '/workflow/persona'}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 flex items-center gap-2">
                  下一步：P4 人设 → ({stats.candidates} 条候选)
                </button>
              )}
            </div>
          </>
        )}

        {!selectedProjectId && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="text-slate-400 text-lg mb-2">请先选择一个项目</div>
            <div className="text-slate-400 text-sm">选择项目后将自动加载该项目的帖子数据</div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-slate-500">加载帖子数据中...</div>
          </div>
        )}
      </div>
    </div>
  )
}
