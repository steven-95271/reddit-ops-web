'use client'

import { useState, useEffect, useCallback } from 'react'
import BaseLayout from '@/components/BaseLayout'
import { showToast } from '@/components/Toast'

interface Project {
  id: string
  name: string
}

interface ContentRecord {
  id: string
  title: string
  body: string
  status: string
  content_mode: string
  quality_score: number
  quality_issues: string[]
  created_at: string
  published_at: string
  persona_name: string
  persona_emoji: string
  post_title: string
  post_subreddit: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  approved: '待发布',
  published: '已发布',
  rejected: '已拒绝',
}

const modeLabels: Record<string, string> = {
  reply_post: '回复帖',
  reply_comment: '回复评论',
  free_compose: '主帖',
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [records, setRecords] = useState<ContentRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)

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

  const fetchRecords = useCallback(async (projectId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/content?project_id=${projectId}`)
      const result = await response.json()
      if (result.success) {
        setRecords(result.data)
      } else {
        showToast(result.error || '加载历史记录失败', 'error')
      }
    } catch (error) {
      showToast('加载历史记录失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      fetchRecords(projectId)
    } else {
      setRecords([])
    }
  }

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter)

  const statusCounts = {
    all: records.length,
    draft: records.filter(r => r.status === 'draft').length,
    approved: records.filter(r => r.status === 'approved').length,
    published: records.filter(r => r.status === 'published').length,
    rejected: records.filter(r => r.status === 'rejected').length,
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <BaseLayout>
      {/* Project Selector */}
      <div className="mb-6">
        <select
          value={selectedProjectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="bg-white/80 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">请选择一个项目...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {selectedProjectId && (
        <>
          {/* Status Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { key: 'all', label: '全部', count: statusCounts.all },
              { key: 'draft', label: '草稿', count: statusCounts.draft },
              { key: 'approved', label: '待发布', count: statusCounts.approved },
              { key: 'published', label: '已发布', count: statusCounts.published },
              { key: 'rejected', label: '已拒绝', count: statusCounts.rejected },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Records List */}
          <div className="glass-card">
            <h2 className="text-lg font-black text-slate-900 mb-4">内容历史</h2>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-slate-500">加载中...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl mb-4 block">📋</span>
                <p>暂无{statusFilter !== 'all' ? statusLabels[statusFilter] : ''}记录</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{record.persona_emoji || '👤'}</span>
                        <span className="text-sm font-semibold text-slate-700">{record.persona_name || '未知人设'}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{modeLabels[record.content_mode] || '内容'}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{formatDate(record.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.quality_score && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            record.quality_score >= 80 ? 'bg-green-100 text-green-700' :
                            record.quality_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            质量 {record.quality_score}
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColors[record.status]}`}>
                          {statusLabels[record.status]}
                        </span>
                      </div>
                    </div>

                    {record.title && (
                      <div className="text-sm font-bold text-slate-800 mb-2">{record.title}</div>
                    )}
                    
                    <div className="text-xs text-slate-500 line-clamp-2 mb-3">
                      {record.body}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {record.post_subreddit && (
                          <span>r/{record.post_subreddit}</span>
                        )}
                        {record.post_title && (
                          <span className="truncate max-w-[200px]">原文: {record.post_title}</span>
                        )}
                      </div>
                      {record.status === 'published' && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">👍 {0}</span>
                          <span className="text-slate-500">💬 {0}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </BaseLayout>
  )
}
