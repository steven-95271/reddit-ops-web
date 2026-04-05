'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  subreddits: string
  keywords: string
  competitor_brands: string
}

interface Post {
  id: string
  project_id: string
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  score: number
  num_comments: number
  hot_score: number
  composite_score: number
  category: string
  is_candidate: boolean
  created_utc: string
  grade?: string
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

const gradeColors: Record<string, string> = {
  S: 'bg-purple-600 text-white',
  A: 'bg-green-600 text-white',
  B: 'bg-blue-600 text-white',
  C: 'bg-gray-400 text-white',
}

export default function AnalysisPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [analysisStats, setAnalysisStats] = useState<{
    total_posts: number
    updated: number
    grade_stats: Record<string, number>
    category_stats: Record<string, number>
  } | null>(null)

  // Filters
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [subredditFilter, setSubredditFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'composite_score' | 'hot_score' | 'score' | 'num_comments'>('composite_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()
      if (result.success) {
        setProjects(result.data)
      } else {
        showToast(result.error || '加载项目失败', 'error')
      }
    } catch (error) {
      showToast('加载项目失败', 'error')
    }
  }

  const runAnalysis = async (projectId: string) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const result = await response.json()
      
      if (result.success) {
        setAnalysisStats(result.data)
        showToast(`评分完成：共处理 ${result.data.updated} 个帖子`, 'success')
        await fetchPosts(projectId)
      } else {
        showToast(result.error || '评分失败', 'error')
      }
    } catch (error) {
      showToast('评分过程出错', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const fetchPosts = async (projectId: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ project_id: projectId })
      if (gradeFilter !== 'all') params.set('grade', gradeFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      params.set('sort_by', sortBy)
      params.set('sort_order', sortOrder)

      const response = await fetch(`/api/analysis?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setPosts(result.data)
      } else {
        showToast(result.error || '加载帖子失败', 'error')
      }
    } catch (error) {
      showToast('加载帖子失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const updateCandidates = async (postIds: string[], isCandidate: boolean) => {
    try {
      const response = await fetch('/api/analysis/candidates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_ids: postIds, is_candidate: isCandidate }),
      })
      const result = await response.json()
      
      if (result.success) {
        setPosts(prev => prev.map(post => 
          postIds.includes(post.id) ? { ...post, is_candidate: isCandidate } : post
        ))
        showToast(`${isCandidate ? '标记' : '取消标记'} ${result.data.updated_count} 个候选`, 'success')
      } else {
        showToast(result.error || '更新失败', 'error')
      }
    } catch (error) {
      showToast('更新候选状态失败', 'error')
    }
  }

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      await runAnalysis(projectId)
    }
  }

  const handleFilterChange = useCallback(() => {
    if (selectedProjectId) {
      fetchPosts(selectedProjectId)
    }
  }, [selectedProjectId, gradeFilter, categoryFilter, subredditFilter, sortBy, sortOrder])

  useEffect(() => {
    handleFilterChange()
  }, [handleFilterChange])

  // Get unique subreddits from posts
  const subreddits = Array.from(new Set(posts.map(p => p.subreddit))).sort()

  // Apply subreddit filter to displayed posts
  const filteredPosts = subredditFilter === 'all' 
    ? posts 
    : posts.filter(p => p.subreddit === subredditFilter)

  // Calculate stats
  const stats = {
    total: posts.length,
    candidates: posts.filter(p => p.is_candidate).length,
    gradeStats: {
      S: posts.filter(p => p.grade === 'S').length,
      A: posts.filter(p => p.grade === 'A').length,
      B: posts.filter(p => p.grade === 'B').length,
      C: posts.filter(p => p.grade === 'C').length,
    },
    categoryStats: {
      A: posts.filter(p => p.category === 'A').length,
      B: posts.filter(p => p.category === 'B').length,
      C: posts.filter(p => p.category === 'C').length,
      D: posts.filter(p => p.category === 'D').length,
      E: posts.filter(p => p.category === 'E').length,
    },
  }

  const markAllAsCandidates = () => {
    const ids = filteredPosts.map(p => p.id)
    if (ids.length === 0) {
      showToast('没有可标记的帖子', 'error')
      return
    }
    updateCandidates(ids, true)
  }

  const markHighGradeAsCandidates = () => {
    const highGradePosts = posts.filter(p => (p.grade === 'S' || p.grade === 'A') && !p.is_candidate)
    const ids = highGradePosts.map(p => p.id)
    if (ids.length === 0) {
      showToast('没有符合条件的 S/A 级帖子', 'error')
      return
    }
    updateCandidates(ids, true)
  }

  return (
    <div className="space-y-6">
      <WorkflowGuide
        title="P3 分析筛选"
        description="对抓取到的帖子进行多维评分和分类，筛选出高价值候选帖"
        steps={[
          { title: '选择项目加载帖子', description: '系统自动加载该项目的抓取数据' },
          { title: '自动评分和分类', description: '系统计算 Hot Score 和 Composite Score，并归入五维分类' },
          { title: '筛选和排序', description: '按评级、分类、Subreddit 筛选，按评分/点赞/评论排序' },
          { title: '标记候选并进入 P4', description: '确认候选列表后进入人设设计' },
        ]}
        details={`【热帖评分逻辑】...
`}
      />

      {/* Project Selector */}
      <div className="glass-card">
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-slate-600">选择项目：</label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="flex-1 bg-white/80 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">请选择一个项目...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              评分中...
            </div>
          )}
        </div>
      </div>

      {selectedProjectId && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="glass-card">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">总帖子数</h3>
              <div className="text-3xl font-black text-slate-900">{stats.total}</div>
            </div>
            <div className="glass-card">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">等级分布</h3>
              <div className="flex gap-2">
                {Object.entries(stats.gradeStats).map(([grade, count]) => (
                  <div key={grade} className="flex-1 text-center">
                    <div className={`text-lg font-black ${grade === 'S' ? 'text-purple-600' : grade === 'A' ? 'text-green-600' : grade === 'B' ? 'text-blue-600' : 'text-gray-400'}`}>
                      {count}
                    </div>
                    <div className={`text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${gradeColors[grade]}`}>
                      {grade}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">分类分布</h3>
              <div className="space-y-1">
                {Object.entries(stats.categoryStats).slice(0, 3).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${categoryColors[cat]}`}>
                      {cat}
                    </span>
                    <span className="text-xs font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">已标记候选</h3>
              <div className="text-3xl font-black text-slate-900">{stats.candidates}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="all">全部等级</option>
                <option value="S">S 级</option>
                <option value="A">A 级</option>
                <option value="B">B 级</option>
                <option value="C">C 级</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="all">全部分类</option>
                <option value="A">A 深度测评</option>
                <option value="B">B 场景痛点</option>
                <option value="C">C 观点争议</option>
                <option value="D">D 竞品KOL</option>
                <option value="E">E 平台趋势</option>
              </select>
              <select
                value={subredditFilter}
                onChange={(e) => setSubredditFilter(e.target.value)}
                className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="all">全部 Subreddit</option>
                {subreddits.map((sub) => (
                  <option key={sub} value={sub}>r/{sub}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="composite_score">综合评分</option>
                <option value="hot_score">热度评分</option>
                <option value="score">Upvotes</option>
                <option value="num_comments">评论数</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
              <div className="flex-1" />
              <button
                onClick={markAllAsCandidates}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                全选为候选
              </button>
              <button
                onClick={markHighGradeAsCandidates}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                标记 S+A 为候选
              </button>
            </div>
          </div>

          {/* Posts Table */}
          <div className="glass-card">
            <h2 className="text-lg font-black text-slate-900 mb-4">
              帖子列表 ({filteredPosts.length})
            </h2>
            
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-slate-500">加载中...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                暂无符合条件的帖子
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    {/* Candidate Checkbox */}
                    <input
                      type="checkbox"
                      checked={post.is_candidate}
                      onChange={(e) => updateCandidates([post.id], e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    
                    {/* Grade Badge */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${gradeColors[post.grade || 'C']}`}>
                      {post.grade}
                    </div>
                    
                    {/* Category Badge */}
                    <div className={`px-2 py-1 rounded-md text-xs font-bold ${categoryColors[post.category || 'E']}`}>
                      {post.category} {categoryNames[post.category || 'E']}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{post.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">r/{post.subreddit}</span>
                        <span className="text-xs text-slate-400">👍 {post.score}</span>
                        <span className="text-xs text-slate-400">💬 {post.num_comments}</span>
                      </div>
                    </div>
                    
                    {/* Scores */}
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">综合:</span>
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-900 rounded-full"
                            style={{ width: `${(post.composite_score || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-10">
                          {((post.composite_score || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">热度:</span>
                        <span className="text-xs font-bold text-slate-600">
                          {Math.round(post.hot_score || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next Step Button */}
          <Link href="/workflow/persona">
            <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">
              下一步：人设管理 →
            </button>
          </Link>
        </>
      )}
    </div>
  )
}
