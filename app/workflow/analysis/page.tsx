'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'

interface Project {
  id: string
  name: string
  product_name: string
  product_description: string
  brand_names?: string[]
  competitor_brands?: string[]
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
  quality_score: number
  ai_relevance_score: number
  ai_intent_score: number
  ai_opportunity_score: number
  ai_suggested_angle: string
  category: string
  is_candidate: boolean
  ignored: boolean
}

interface PreferenceSettings {
  minQualityScore: number
  minRelevance: number
  preferFresh: boolean
  preferHighEngagement: boolean
  candidateLimit: number
}

const defaultPreferences: PreferenceSettings = {
  minQualityScore: 50,
  minRelevance: 5,
  preferFresh: true,
  preferHighEngagement: false,
  candidateLimit: 100
}

export default function AnalysisPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [aiScoring, setAiScoring] = useState(false)
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 })

  const [filters, setFilters] = useState({
    min_quality: 50,
    time_range: '30d',
    phase: '',
    show_candidates: false,
    show_ignored: false
  })

  const [preferences, setPreferences] = useState<PreferenceSettings>(defaultPreferences)
  const [showPreferences, setShowPreferences] = useState(false)

  const [stats, setStats] = useState({
    total: 0,
    candidates: 0,
    aiScored: 0
  })

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}${process.env.NEXT_PUBLIC_APP_URL || ''}/api/projects`)
      const data = await res.json()
      if (data.success) {
        setProjects(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchPosts = useCallback(async () => {
    if (!selectedProject) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        project_id: selectedProject.id,
        min_quality: filters.min_quality.toString(),
        time_range: filters.time_range,
        limit: '100'
      })

      if (filters.phase) {
        params.set('phase', filters.phase)
      }

      if (filters.show_candidates) {
        params.set('is_candidate', 'true')
      }

      if (!filters.show_ignored) {
        params.set('ignored', 'false')
      } else {
        params.set('ignored', 'true')
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/posts?${params}`)
      const data = await res.json()

      if (data.success) {
        setPosts(data.data.posts)
        setStats({
          total: data.data.total,
          candidates: data.data.candidateCount,
          aiScored: data.data.posts.filter((p: Post) => p.ai_relevance_score != null).length
        })
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      showToast('获取帖子失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedProject, filters])

  useEffect(() => {
    if (selectedProject) {
      fetchPosts()
    }
  }, [selectedProject, fetchPosts])

  const runAIScoring = async () => {
    if (!selectedProject) return

    if (stats.candidates >= preferences.candidateLimit) {
      showToast(`候选帖子已达上限 (${preferences.candidateLimit})，请先调整筛选或移除现有候选`, 'info')
      return
    }

    setAiScoring(true)
    setAiProgress({ current: 0, total: 0 })

    try {
      const res = await fetch('/api/posts/ai-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id
        })
      })

      const data = await res.json()

      if (data.success) {
        setAiProgress({ current: data.data.scored, total: data.data.total })
        showToast(`AI 评分完成：${data.data.scored} 条帖子已评分`, 'success')
        fetchPosts()
      } else {
        showToast(data.error || 'AI 评分失败', 'error')
      }
    } catch (error) {
      console.error('Error running AI scoring:', error)
      showToast('AI 评分失败', 'error')
    } finally {
      setAiScoring(false)
    }
  }

  const handleAction = async (postId: string, action: 'candidate' | 'unmark' | 'ignore' | 'unignore') => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/posts/${postId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await res.json()

      if (data.success) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              is_candidate: action === 'candidate',
              ignored: action === 'ignore'
            }
          }
          return p
        }))

        if (action === 'candidate') {
          setStats(prev => ({ ...prev, candidates: prev.candidates + 1 }))
          showToast('已标记为候选', 'success')
        } else if (action === 'unmark') {
          setStats(prev => ({ ...prev, candidates: prev.candidates - 1 }))
          showToast('已取消候选标记', 'success')
        }
      }
    } catch (error) {
      console.error('Error updating post:', error)
      showToast('操作失败', 'error')
    }
  }

  const calculateQualityScore = (post: Post): number => {
    let interactionScore = 0
    if (post.score > 0) interactionScore += Math.min(20, Math.log10(post.score + 1) * 10)
    if (post.num_comments > 0) interactionScore += Math.min(10, Math.log10(post.num_comments + 1) * 5)
    if (post.upvote_ratio > 0.8) interactionScore += 10

    const postAge = Date.now() - new Date(post.created_utc).getTime()
    const daysOld = postAge / (1000 * 60 * 60 * 24)
    let freshnessScore = 0
    if (daysOld < 1) freshnessScore = 30
    else if (daysOld < 7) freshnessScore = 20
    else if (daysOld < 30) freshnessScore = 10
    else freshnessScore = 5

    const aiScore = (post.ai_relevance_score || 5) + (post.ai_intent_score || 5) + (post.ai_opportunity_score || 5)

    return Math.round(interactionScore + freshnessScore + aiScore)
  }

  const getQualityColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-100'
    if (score >= 50) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getPhaseColor = (category: string) => {
    switch (category) {
      case 'phase1_brand': return 'bg-blue-100 text-blue-700'
      case 'phase2_competitor': return 'bg-orange-100 text-orange-700'
      case 'phase3_scene_pain': return 'bg-green-100 text-green-700'
      case 'phase4_subreddits': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const phaseLabels: Record<string, string> = {
    phase1_brand: 'P1品牌',
    phase2_competitor: 'P2竞品',
    phase3_scene_pain: 'P3场景',
    phase4_subreddits: 'P4社区'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">P3 候选筛选</h1>
          <p className="text-slate-600 mt-2">
            从原始抓取数据中筛选高质量候选帖子，用于后续内容生成
          </p>
        </div>

        <div className="mb-6">
          <WorkflowGuide
            title="P3 候选筛选"
            description="四层筛选漏斗：从原始数据到候选池"
            steps={[
              { title: 'L1 自动过滤', description: '去重、长度、时间过滤' },
              { title: 'L2 质量评分', description: '互动、新鲜度、影响力计算' },
              { title: 'L3 AI 筛选', description: '语义相关度、意图匹配、植入性评估' },
              { title: 'L4 人工审核', description: '最终确认进入候选池' }
            ]}
            details={`【筛选标准】
• 相关度：帖子内容与产品的匹配程度
• 互动性：upvotes、评论数、好评率
• 新鲜度：帖子发布时间（越新鲜越好）
• 可植入性：话题场景是否适合自然提及品牌

【候选池限制】
• 系统自动控制候选数量上限为 ${preferences.candidateLimit} 条
• 超出上限后需先标记或移除现有候选

【AI 评分说明】
• 批量调用 AI 对帖子进行三维度评分
• relevance (0-10): 内容相关度
• intent (0-10): 购买意图匹配度
• opportunity (0-10): 植入机会评估`}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            选择项目
          </label>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === e.target.value)
              setSelectedProject(project || null)
            }}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">请选择一个项目</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} - {project.product_name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">质量分 ≥</label>
                  <input
                    type="number"
                    value={filters.min_quality}
                    onChange={(e) => setFilters(f => ({ ...f, min_quality: parseInt(e.target.value) || 0 }))}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    min={0}
                    max={100}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">时间范围</label>
                  <select
                    value={filters.time_range}
                    onChange={(e) => setFilters(f => ({ ...f, time_range: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="24h">最近 24 小时</option>
                    <option value="7d">最近 7 天</option>
                    <option value="30d">最近 30 天</option>
                    <option value="year">最近一年</option>
                    <option value="all">全部时间</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showCandidates"
                    checked={filters.show_candidates}
                    onChange={(e) => setFilters(f => ({ ...f, show_candidates: e.target.checked }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="showCandidates" className="text-sm text-slate-700">只看候选</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showIgnored"
                    checked={filters.show_ignored}
                    onChange={(e) => setFilters(f => ({ ...f, show_ignored: e.target.checked }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="showIgnored" className="text-sm text-slate-700">显示已忽略</label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  偏好设置
                </button>

                <button
                  onClick={runAIScoring}
                  disabled={aiScoring || loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {aiScoring ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      AI 评分中... {aiProgress.current}/{aiProgress.total}
                    </>
                  ) : (
                    <>
                      🤖 AI 筛选
                    </>
                  )}
                </button>

                <button
                  onClick={fetchPosts}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  {loading ? '加载中...' : '刷新'}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedProject && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-sm text-slate-500">符合条件的帖子</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.candidates}</div>
              <div className="text-sm text-slate-500">已标记候选 / {preferences.candidateLimit}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.aiScored}</div>
              <div className="text-sm text-slate-500">已 AI 评分</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{posts.length}</div>
              <div className="text-sm text-slate-500">当前显示</div>
            </div>
          </div>
        )}

        {selectedProject && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {posts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  暂无符合条件的帖子，请调整筛选条件
                </div>
              ) : (
                posts.map(post => {
                  const qualityScore = calculateQualityScore(post)

                  return (
                    <div key={post.id} className={`p-4 hover:bg-slate-50 ${post.ignored ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {post.category && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPhaseColor(post.category)}`}>
                                {phaseLabels[post.category] || post.category}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">r/{post.subreddit}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">
                              {new Date(post.created_utc).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{post.score} ↑</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{post.num_comments} 评论</span>
                          </div>

                          <h3 className="text-slate-900 font-medium mb-2 line-clamp-2">
                            {post.title}
                          </h3>

                          {post.body && (
                            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                              {post.body.substring(0, 200)}...
                            </p>
                          )}

                          {post.ai_relevance_score != null && (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-purple-600">
                                相关度: {post.ai_relevance_score}/10
                              </span>
                              <span className="text-purple-600">
                                意图: {post.ai_intent_score}/10
                              </span>
                              <span className="text-purple-600">
                                植入性: {post.ai_opportunity_score}/10
                              </span>
                              {post.ai_suggested_angle && (
                                <span className="text-slate-500 italic">
                                  💡 {post.ai_suggested_angle}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getQualityColor(qualityScore)}`}>
                            {qualityScore} 分
                          </span>

                          <div className="flex items-center gap-2">
                            {post.is_candidate ? (
                              <button
                                onClick={() => handleAction(post.id, 'unmark')}
                                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium"
                              >
                                ✓ 候选
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction(post.id, 'candidate')}
                                disabled={stats.candidates >= preferences.candidateLimit}
                                className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                              >
                                标记候选
                              </button>
                            )}

                            {post.ignored ? (
                              <button
                                onClick={() => handleAction(post.id, 'unignore')}
                                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium"
                              >
                                恢复
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction(post.id, 'ignore')}
                                className="px-3 py-1.5 border border-slate-300 text-slate-400 rounded-lg text-xs hover:bg-slate-50"
                              >
                                忽略
                              </button>
                            )}

                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
                            >
                              查看原帖
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {selectedProject && stats.candidates > 0 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-slate-500">
              已标记 {stats.candidates} 条候选帖子
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-3 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50">
                导出 CSV
              </button>
              <button className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700">
                进入 P4 内容生成 →
              </button>
            </div>
          </div>
        )}

        {showPreferences && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <h2 className="text-xl font-bold text-slate-900 mb-4">偏好设置</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    最低质量分阈值: {preferences.minQualityScore}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={preferences.minQualityScore}
                    onChange={(e) => setPreferences(p => ({ ...p, minQualityScore: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    最低 AI 相关度: {preferences.minRelevance}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={preferences.minRelevance}
                    onChange={(e) => setPreferences(p => ({ ...p, minRelevance: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    候选池上限: {preferences.candidateLimit}
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={preferences.candidateLimit}
                    onChange={(e) => setPreferences(p => ({ ...p, candidateLimit: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preferences.preferFresh}
                      onChange={(e) => setPreferences(p => ({ ...p, preferFresh: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">优先新鲜帖子</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preferences.preferHighEngagement}
                      onChange={(e) => setPreferences(p => ({ ...p, preferHighEngagement: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">优先高互动帖子</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowPreferences(false)
                    fetchPosts()
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  应用设置
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}