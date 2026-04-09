'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  brand_names: string
}

interface Persona {
  id: string
  name: string
  username: string
  avatar_emoji: string
  avatar_color: string
  tone: string
}

interface Post {
  id: string
  title: string
  body: string
  subreddit: string
  score: number
  num_comments: number
  grade: string
  is_candidate: boolean
}

interface Content {
  id: string
  title: string
  body: string
  body_edited: string
  status: string
  quality_score: number
  quality_issues: string[]
  content_mode: string
  persona_name: string
  persona_emoji: string
  post_title: string
  post_subreddit: string
}

export default function ContentPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'reply_post' | 'reply_comment' | 'free_compose'>('reply_post')
  const [isLoading, setIsLoading] = useState(false)

  // Tab 1 state
  const [candidatePosts, setCandidatePosts] = useState<Post[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [generatedContent, setGeneratedContent] = useState<Content | null>(null)

  // Tab 2 state
  const [targetPostTitle, setTargetPostTitle] = useState('')
  const [targetComment, setTargetComment] = useState('')

  // Tab 3 state
  const [userIdea, setUserIdea] = useState('')
  const [targetSubreddit, setTargetSubreddit] = useState('')
  const [postType, setPostType] = useState('经验分享')

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

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

  const fetchPersonas = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/personas?project_id=${projectId}`)
      const result = await response.json()
      if (result.success) {
        setPersonas(result.data)
        if (result.data.length > 0) {
          setSelectedPersonaId(result.data[0].id)
        }
      }
    } catch (error) {
      showToast('加载人设失败', 'error')
    }
  }, [])

  const fetchCandidatePosts = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/analysis?project_id=${projectId}&is_candidate=true`)
      const result = await response.json()
      if (result.success) {
        setCandidatePosts(result.data)
      }
    } catch (error) {
      showToast('加载候选帖失败', 'error')
    }
  }, [])

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      fetchPersonas(projectId)
      fetchCandidatePosts(projectId)
    } else {
      setPersonas([])
      setSelectedPersonaId('')
      setCandidatePosts([])
    }
    setGeneratedContent(null)
  }

  const handleGenerateContent = async (mode: string, extraParams: any = {}) => {
    if (!selectedProjectId || !selectedPersonaId) {
      showToast('请先选择项目和人设', 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          persona_id: selectedPersonaId,
          mode,
          ...extraParams,
        }),
      })
      const result = await response.json()

      if (result.success) {
        setGeneratedContent({
          id: result.data.id,
          title: result.data.title || '',
          body: result.data.body,
          body_edited: '',
          status: 'draft',
          quality_score: result.data.quality_score,
          quality_issues: result.data.quality_issues,
          content_mode: mode,
          persona_name: personas.find(p => p.id === selectedPersonaId)?.name || '',
          persona_emoji: personas.find(p => p.id === selectedPersonaId)?.avatar_emoji || '👤',
          post_title: extraParams.post_title || '',
          post_subreddit: extraParams.subreddit || '',
        })
        showToast('内容生成成功', 'success')
      } else {
        showToast(result.error || '生成失败', 'error')
      }
    } catch (error) {
      showToast('生成内容失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateContent = async (contentId: string, updates: any) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await response.json()

      if (result.success) {
        setGeneratedContent((prev) => prev ? { ...prev, ...result.data } : null)
        showToast('更新成功', 'success')
        return true
      } else {
        showToast(result.error || '更新失败', 'error')
        return false
      }
    } catch (error) {
      showToast('更新失败', 'error')
      return false
    }
  }

  const handleRegenerate = async () => {
    if (!generatedContent) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/content/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: generatedContent.id }),
      })
      const result = await response.json()

      if (result.success) {
        setGeneratedContent({
          ...generatedContent,
          body: result.data.body,
          title: result.data.title || '',
          quality_score: result.data.quality_score,
          quality_issues: result.data.quality_issues,
        })
        showToast('重新生成成功', 'success')
      } else {
        showToast(result.error || '重新生成失败', 'error')
      }
    } catch (error) {
      showToast('重新生成失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedPost = candidatePosts.find(p => p.id === selectedPostId)
  const selectedPersona = personas.find(p => p.id === selectedPersonaId)

  return (
    <div className="space-y-6">
      <WorkflowGuide
        title="P4-2 内容创作"
        description="AI 扮演人设，生成去 AI 味的 Reddit 内容"
        steps={[
          { title: '选择项目和人设', description: '项目和人设全局生效' },
          { title: '选择创作模式', description: '回复帖子 / 回复评论 / 自由创作' },
          { title: '生成内容', description: 'AI 生成并自动质量评分' },
          { title: '审核通过', description: '修改或重新生成，确认后发布' },
        ]}
        details={`【去 AI 味策略】
AI 生成的内容会经过严格的 Anti-AI Detection 检查：
• 禁止 AI 高频词（delve, leverage, seamless 等）
• 句式长短变化（避免单调）
• 品牌自然提及（不超过 2 次）
• Reddit 特有表达（tbh, imo, ngl 等）
• 避免 AI 典型开头（I think...）

【质量评分】
满分 100，低于 70 分建议修改后发布。`}
      />

      {/* Project & Persona Selector */}
      <div className="glass-card">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">项目</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-white/80 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">选择项目...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">人设</label>
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="w-full bg-white/80 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              disabled={!selectedProjectId || personas.length === 0}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.avatar_emoji} {p.name} - {p.tone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedProjectId && selectedPersonaId && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => { setActiveTab('reply_post'); setGeneratedContent(null) }}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'reply_post'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              回复候选帖
            </button>
            <button
              onClick={() => { setActiveTab('reply_comment'); setGeneratedContent(null) }}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'reply_comment'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              回复评论
            </button>
            <button
              onClick={() => { setActiveTab('free_compose'); setGeneratedContent(null) }}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'free_compose'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              自由创作
            </button>
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Input Area */}
            <div className="space-y-4">
              {activeTab === 'reply_post' && (
                <div className="glass-card">
                  <h3 className="text-sm font-black text-slate-900 mb-4">候选帖列表</h3>
                  {candidatePosts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      暂无候选帖，请先在 P3 筛选并标记候选
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {candidatePosts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPostId(post.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedPostId === post.id
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1 line-clamp-1">{post.title}</div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span>r/{post.subreddit}</span>
                            <span>👍 {post.score}</span>
                            <span>💬 {post.num_comments}</span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              post.grade === 'S' ? 'bg-purple-500' :
                              post.grade === 'A' ? 'bg-green-500' :
                              post.grade === 'B' ? 'bg-blue-500' : 'bg-gray-400'
                            } text-white font-bold`}>
                              {post.grade}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPost && (
                    <button
                      onClick={() => handleGenerateContent('reply_post', {
                        post_id: selectedPost.id,
                        post_title: selectedPost.title,
                        post_body: selectedPost.body,
                        subreddit: selectedPost.subreddit,
                      })}
                      disabled={isLoading}
                      className="w-full mt-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isLoading ? '生成中...' : '生成回复'}
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'reply_comment' && (
                <div className="glass-card">
                  <h3 className="text-sm font-black text-slate-900 mb-4">输入评论内容</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">原帖标题（选填）</label>
                      <input
                        type="text"
                        value={targetPostTitle}
                        onChange={(e) => setTargetPostTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        placeholder="原帖标题..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">他人评论内容（必填）</label>
                      <textarea
                        value={targetComment}
                        onChange={(e) => setTargetComment(e.target.value)}
                        rows={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        placeholder="粘贴要回复的评论内容..."
                      />
                    </div>
                    <button
                      onClick={() => handleGenerateContent('reply_comment', {
                        post_title: targetPostTitle,
                        target_comment: targetComment,
                      })}
                      disabled={isLoading || !targetComment.trim()}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isLoading ? '生成中...' : '生成回复'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'free_compose' && (
                <div className="glass-card">
                  <h3 className="text-sm font-black text-slate-900 mb-4">自由创作</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">主题/想法</label>
                      <textarea
                        value={userIdea}
                        onChange={(e) => setUserIdea(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        placeholder="例如：跑步时听歌的耳机选择..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">目标 Subreddit</label>
                        <input
                          type="text"
                          value={targetSubreddit}
                          onChange={(e) => setTargetSubreddit(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                          placeholder="running"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">帖子类型</label>
                        <select
                          value={postType}
                          onChange={(e) => setPostType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        >
                          <option>经验分享</option>
                          <option>求推荐</option>
                          <option>对比评测</option>
                          <option>讨论</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerateContent('free_compose', {
                        user_idea: userIdea,
                        target_subreddit: targetSubreddit,
                        post_type: postType,
                      })}
                      disabled={isLoading || !userIdea.trim()}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isLoading ? '生成中...' : '生成帖子'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Content Preview & Editor */}
            <div className="space-y-4">
              {isLoading && (
                <div className="glass-card text-center py-16">
                  <div className="w-12 h-12 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-500">AI 正在生成内容...</p>
                </div>
              )}

              {!isLoading && !generatedContent && (
                <div className="glass-card text-center py-16">
                  <div className="text-6xl mb-4">✍️</div>
                  <p className="text-sm text-slate-500">选择内容并点击生成</p>
                </div>
              )}

              {!isLoading && generatedContent && (
                <>
                  {/* Quality Score Dashboard */}
                  <QualityDashboard
                    score={generatedContent.quality_score}
                    issues={generatedContent.quality_issues}
                  />

                  {/* Content Editor */}
                  <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-slate-900">生成的内容</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{generatedContent.persona_emoji}</span>
                        <span className="text-xs font-semibold text-slate-600">{generatedContent.persona_name}</span>
                      </div>
                    </div>

                    {activeTab === 'free_compose' && (
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">标题</label>
                        <input
                          type="text"
                          value={generatedContent.title}
                          onChange={(e) => setGeneratedContent({ ...generatedContent, title: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">正文</label>
                      <textarea
                        value={generatedContent.body}
                        onChange={(e) => setGeneratedContent({ ...generatedContent, body: e.target.value })}
                        rows={12}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        重新生成
                      </button>
                      <button
                        onClick={async () => {
                          const success = await handleUpdateContent(generatedContent.id, {
                            body_edited: generatedContent.body,
                            title: generatedContent.title,
                          })
                          if (success) {
                            showToast('已保存编辑', 'success')
                          }
                        }}
                        className="py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
                      >
                        保存编辑
                      </button>
                      <button
                        onClick={async () => {
                          const success = await handleUpdateContent(generatedContent.id, { status: 'rejected' })
                          if (success) {
                            setGeneratedContent({ ...generatedContent, status: 'rejected' })
                          }
                        }}
                        className="py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50"
                      >
                        拒绝
                      </button>
                      <button
                        onClick={async () => {
                          const success = await handleUpdateContent(generatedContent.id, { status: 'approved' })
                          if (success) {
                            setGeneratedContent({ ...generatedContent, status: 'approved' })
                          }
                        }}
                        className="py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                      >
                        通过
                      </button>
                    </div>

                    {generatedContent.status !== 'draft' && (
                      <div className={`mt-4 p-3 rounded-lg ${
                        generatedContent.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <span className="text-sm font-semibold">
                          {generatedContent.status === 'approved' ? '✓ 已通过' : '✗ 已拒绝'}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Next Step */}
          <Link href="/workflow/publish">
            <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">
              下一步：发布管理 →
            </button>
          </Link>
        </>
      )}
    </div>
  )
}

// Quality Dashboard Component
function QualityDashboard({ score, issues }: { score: number; issues: string[] }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600'
    if (s >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (s: number) => {
    if (s >= 80) return 'from-green-500 to-green-600'
    if (s >= 60) return 'from-yellow-500 to-yellow-600'
    return 'from-red-500 to-red-600'
  }

  return (
    <div className="glass-card">
      <h3 className="text-sm font-black text-slate-900 mb-4">质量评分</h3>
      <div className="flex items-start gap-6">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className={`text-5xl font-black ${getScoreColor(score)}`}>
            {score}
          </div>
          <div className="text-xs text-slate-500 mt-1">/ 100</div>
          {score < 70 && (
            <div className="text-xs text-yellow-600 mt-2 font-semibold">
              ⚠️ 建议修改后发布
            </div>
          )}
        </div>

        {/* Issues List */}
        <div className="flex-1">
          {issues.length === 0 ? (
            <div className="text-sm text-green-600 font-semibold">
              ✓ 内容质量良好，无明显问题
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <div key={i} className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
