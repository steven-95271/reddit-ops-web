'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'

interface Project {
  id: string
  name: string
}

interface PendingContent {
  id: string
  content_title: string | null
  content_body: string
  persona_name: string
  persona_emoji: string
  content_mode: string
  quality_score: number
  target_subreddit: string | null
}

interface PublishedContent {
  id: string
  content_id: string
  published_url: string | null
  upvotes: number
  replies: number
  status: string
  published_at: string
  content_title: string | null
  content_body: string
  content_body_edited: string | null
  persona_name: string
  persona_emoji: string
}

export default function PublishPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [pendingContents, setPendingContents] = useState<PendingContent[]>([])
  const [publishedContents, setPublishedContents] = useState<PublishedContent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modal state
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState('')

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

  const fetchPublishData = useCallback(async (projectId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/publish?project_id=${projectId}`)
      const result = await response.json()
      if (result.success) {
        setPendingContents(result.data.pending)
        setPublishedContents(result.data.published)
      } else {
        showToast(result.error || '加载数据失败', 'error')
      }
    } catch (error) {
      showToast('加载数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      fetchPublishData(projectId)
    } else {
      setPendingContents([])
      setPublishedContents([])
    }
  }

  const handleCopyContent = (content: PendingContent) => {
    const text = content.content_body
    navigator.clipboard.writeText(text).then(() => {
      showToast('内容已复制到剪贴板', 'success')
    }).catch(() => {
      showToast('复制失败', 'error')
    })
  }

  const handleMarkAsPublished = async (contentId: string) => {
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, published_url: publishedUrl }),
      })
      const result = await response.json()

      if (result.success) {
        showToast('已标记为已发布', 'success')
        setShowPublishModal(null)
        setPublishedUrl('')
        fetchPublishData(selectedProjectId)
      } else {
        showToast(result.error || '操作失败', 'error')
      }
    } catch (error) {
      showToast('操作失败', 'error')
    }
  }

  const handleUpdatePublishRecord = async (id: string, updates: { upvotes?: number; replies?: number }) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/publish/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await response.json()

      if (result.success) {
        setPublishedContents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        showToast('更新成功', 'success')
      } else {
        showToast(result.error || '更新失败', 'error')
      }
    } catch (error) {
      showToast('更新失败', 'error')
    }
  }

  const handleDeletePublishRecord = async (id: string) => {
    if (!confirm('确定要删除这条发布记录吗？内容将回到待发布状态。')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/publish/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        showToast('发布记录已删除', 'success')
        fetchPublishData(selectedProjectId)
      } else {
        showToast(result.error || '删除失败', 'error')
      }
    } catch (error) {
      showToast('删除失败', 'error')
    }
  }

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'reply_post': return '回复帖'
      case 'reply_comment': return '回复评论'
      case 'free_compose': return '主帖'
      default: return '内容'
    }
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'reply_post': return 'bg-blue-100 text-blue-700'
      case 'reply_comment': return 'bg-green-100 text-green-700'
      case 'free_compose': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="space-y-6">
      <WorkflowGuide
        title="P5 发布追踪"
        description="管理已审核通过的内容的发布状态和效果追踪"
        steps={[
          { title: '查看待发布队列', description: '从审核通过的内容中选择要发布的' },
          { title: '复制内容并手动发布', description: '复制回复文本，打开 Reddit 对应帖子手动粘贴发布' },
          { title: '粘贴发布链接', description: '发布后回来粘贴帖子链接，系统开始追踪' },
          { title: '查看效果数据', description: '定期检查互动数据，判断哪些人设和风格效果最好' },
        ]}
        details={`【当前发布方式】
MVP 阶段采用半自动方式：系统帮你生成和管理内容，但发布动作需要手动完成。
1. 从待发布队列选择内容
2. 点击复制按钮，复制回复文本
3. 打开 Reddit 对应帖子，手动粘贴发布
4. 发布后回来粘贴帖子链接

【效果追踪】
发布后系统会记录互动数据（点赞数、回复数），帮你判断哪些人设和回复风格效果最好。`}
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
        </div>
      </div>

      {selectedProjectId && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card text-center">
              <div className="text-3xl font-black text-yellow-600">{pendingContents.length}</div>
              <div className="text-sm text-slate-500 font-medium mt-1">待发布</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-3xl font-black text-green-600">{publishedContents.length}</div>
              <div className="text-sm text-slate-500 font-medium mt-1">已发布</div>
            </div>
            <div className="glass-card text-center">
              <div className="text-3xl font-black text-blue-600">
                {publishedContents.reduce((sum, c) => sum + (c.upvotes || 0), 0)}
              </div>
              <div className="text-sm text-slate-500 font-medium mt-1">总点赞</div>
            </div>
          </div>

          {/* Two Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Pending Queue */}
            <div className="glass-card">
              <h3 className="text-lg font-black text-slate-900 mb-4">待发布队列</h3>
              
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-500">加载中...</p>
                </div>
              ) : pendingContents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="text-4xl mb-4 block">📤</span>
                  <p>暂无待发布内容</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {pendingContents.map((content) => (
                    <div key={content.id} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{content.persona_emoji}</span>
                          <span className="text-xs font-semibold text-slate-600">{content.persona_name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getModeColor(content.content_mode)}`}>
                            {getModeLabel(content.content_mode)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <span>r/{content.target_subreddit || 'reddit'}</span>
                          {content.quality_score && (
                            <>
                              <span>·</span>
                              <span className={content.quality_score >= 70 ? 'text-green-600' : 'text-yellow-600'}>
                                {content.quality_score}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {content.content_title && (
                        <div className="text-sm font-bold text-slate-800 mb-1">{content.content_title}</div>
                      )}
                      <div className="text-xs text-slate-500 line-clamp-2 mb-3">
                        {content.content_body?.substring(0, 100)}...
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyContent(content)}
                          className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition-colors"
                        >
                          复制内容
                        </button>
                        <button
                          onClick={() => setShowPublishModal(content.id)}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                        >
                          标记已发布
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Published List */}
            <div className="glass-card">
              <h3 className="text-lg font-black text-slate-900 mb-4">已发布列表</h3>
              
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-500">加载中...</p>
                </div>
              ) : publishedContents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="text-4xl mb-4 block">📊</span>
                  <p>暂无已发布内容</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                        <th className="pb-2">时间</th>
                        <th className="pb-2">人设</th>
                        <th className="pb-2">内容</th>
                        <th className="pb-2">链接</th>
                        <th className="pb-2 text-center">👍</th>
                        <th className="pb-2 text-center">💬</th>
                        <th className="pb-2">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {publishedContents.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50">
                          <td className="py-3 text-slate-500">
                            {item.published_at ? new Date(item.published_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <span>{item.persona_emoji}</span>
                              <span className="text-slate-600">{item.persona_name}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="max-w-[150px] truncate text-slate-600">
                              {item.content_title || item.content_body?.substring(0, 30) || '无标题'}
                            </div>
                          </td>
                          <td className="py-3">
                            {item.published_url ? (
                              <a
                                href={item.published_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                查看 ↗
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              value={item.upvotes || 0}
                              onChange={(e) => {
                                const newUpvotes = parseInt(e.target.value) || 0
                                setPublishedContents(prev => prev.map(c => c.id === item.id ? { ...c, upvotes: newUpvotes } : c))
                              }}
                              onBlur={() => handleUpdatePublishRecord(item.id, { upvotes: item.upvotes })}
                              className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center text-xs"
                            />
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              value={item.replies || 0}
                              onChange={(e) => {
                                const newReplies = parseInt(e.target.value) || 0
                                setPublishedContents(prev => prev.map(c => c.id === item.id ? { ...c, replies: newReplies } : c))
                              }}
                              onBlur={() => handleUpdatePublishRecord(item.id, { replies: item.replies })}
                              className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center text-xs"
                            />
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleDeletePublishRecord(item.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-semibold"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowPublishModal(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-4">标记为已发布</h3>
            <p className="text-sm text-slate-500 mb-4">
              请在 Reddit 发布后，粘贴发布链接到下方：
            </p>
            <input
              type="url"
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              placeholder="https://www.reddit.com/..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishModal(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={() => handleMarkAsPublished(showPublishModal)}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
              >
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
