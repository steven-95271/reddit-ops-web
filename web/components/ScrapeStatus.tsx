'use client'

import { useState, useEffect } from 'react'
import { showToast } from './Toast'

interface ApifyRun {
  id: string
  name: string
  search_query: string | null
  search_subreddit: string | null
  sort_order: string | null
  time_filter: string | null
  status: string
  startedAt: string
  finishedAt: string | null
  datasetId: string | null
  postsCount: number
  consoleUrl: string
  stats: any
  buildNumber: string
  usageTotalUsd: number
}

interface ScrapedPost {
  [key: string]: any
}

export default function ScrapeStatus({ projectId, onRefresh }: ScrapeStatusProps) {
  const [runs, setRuns] = useState<ApifyRun[]>([])
  const [selectedRun, setSelectedRun] = useState<ApifyRun | null>(null)
  const [posts, setPosts] = useState<ScrapedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    syncRuns()
  }, [projectId])

  const syncRuns = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/apify-runs?limit=50')
      if (res.ok) {
        const data = await res.json()
        setRuns(data.runs || [])
        showToast(`已同步 ${data.runs?.length || 0} 条抓取记录`, 'success')
      }
    } catch (e) {
      console.error('Failed to sync runs:', e)
      showToast('同步失败', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const loadRunData = async (run: ApifyRun) => {
    if (!run.datasetId) {
      showToast('该任务没有数据集', 'error')
      return
    }
    
    setSelectedRun(run)
    setLoadingPosts(true)
    setPosts([])
    
    try {
      const res = await fetch(`/api/apify-data?dataset_id=${run.datasetId}&limit=1000`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch (e) {
      console.error('Failed to load posts:', e)
      showToast('加载数据失败', 'error')
    } finally {
      setLoadingPosts(false)
    }
  }

  const exportCSV = (includeAllFields: boolean) => {
    if (posts.length === 0) {
      showToast('暂无数据可导出', 'error')
      return
    }
    
    let csvContent: string
    
    if (includeAllFields) {
      // Export ALL fields from Apify data
      const allKeys = new Set<string>()
      posts.forEach(post => {
        Object.keys(post).forEach(key => allKeys.add(key))
      })
      
      const headers = Array.from(allKeys)
      csvContent = [
        headers.join(','),
        ...posts.map(post => 
          headers.map(h => {
            const val = post[h]
            if (val === null || val === undefined) return ''
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(',')
        )
      ].join('\n')
    } else {
      // Export standard fields only
      const standardFields = [
        'title', 'subreddit', 'author', 'score', 'numComments', 
        'selfText', 'url', 'permalink', 'createdAt', 'scrapedAt'
      ]
      
      csvContent = [
        standardFields.join(','),
        ...posts.map(p => standardFields.map(f => {
          const val = p[f]
          if (val === null || val === undefined) return ''
          return `"${String(val).replace(/"/g, '""')}"`
        }).join(','))
      ].join('\n')
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `apify_export_${selectedRun?.id || 'all'}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(`已导出 ${posts.length} 条数据`, 'success')
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'SUCCEEDED': 'bg-green-500/20 text-green-400 border-green-500/30',
      'FAILED': 'bg-red-500/20 text-red-400 border-red-500/30',
      'RUNNING': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'READY': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    }
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  }

  return (
    <div className="reddit-panel p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-dark-text">📥 Apify 抓取记录</h2>
        <button
          onClick={syncRuns}
          disabled={syncing}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          {syncing ? (
            <>
              <span className="animate-spin">🔄</span>
              <span>同步中...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>同步记录</span>
            </>
          )}
        </button>
      </div>

      {/* Run History List */}
      {runs.length === 0 ? (
        <div className="text-center py-12 text-dark-muted">
          <span className="text-4xl mb-4 block">📭</span>
          <p>暂无抓取记录</p>
          <p className="text-sm mt-2">点击"同步记录"刷新</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto mb-6">
          {runs.map((run) => (
            <div 
              key={run.id}
              onClick={() => loadRunData(run)}
              className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                selectedRun?.id === run.id 
                  ? 'bg-reddit-orange/20 border-reddit-orange/30' 
                  : 'bg-dark-hover border-transparent hover:bg-dark-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs border ${getStatusBadge(run.status)}`}>
                      {run.status}
                    </span>
                    <span className="text-reddit-orange font-medium text-sm truncate" title={run.name}>
                      {run.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-dark-muted">
                    {run.search_subreddit && (
                      <span className="bg-dark-border px-1.5 py-0.5 rounded">r/{run.search_subreddit}</span>
                    )}
                    {run.sort_order && (
                      <span className="bg-dark-border px-1.5 py-0.5 rounded">{run.sort_order}</span>
                    )}
                    {run.time_filter && run.time_filter !== 'all' && (
                      <span className="bg-dark-border px-1.5 py-0.5 rounded">{run.time_filter}</span>
                    )}
                    {run.postsCount > 0 && (
                      <span className="text-green-400">{run.postsCount} posts</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-dark-muted">{formatDate(run.startedAt)}</div>
                  {run.stats && (
                    <div className="text-xs text-dark-muted">
                      {run.stats.durationMillis ? `${(run.stats.durationMillis/1000).toFixed(1)}s` : ''}
                      {run.usageTotalUsd ? ` | $${run.usageTotalUsd.toFixed(4)}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Run Data */}
      {selectedRun && (
        <div className="border-t border-dark-border pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-md font-bold text-dark-text">📊 数据预览</h3>
              <p className="text-sm text-dark-muted">
                Run ID: {selectedRun.id} | 
                Dataset: {selectedRun.datasetId || 'N/A'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportCSV(false)}
                disabled={loadingPosts || posts.length === 0}
                className="btn-secondary text-sm"
              >
                ⬇ 标准字段
              </button>
              <button
                onClick={() => exportCSV(true)}
                disabled={loadingPosts || posts.length === 0}
                className="btn-primary text-sm"
              >
                ⬇ All Fields
              </button>
            </div>
          </div>

          {loadingPosts ? (
            <div className="text-center py-8 text-dark-muted">
              <span className="animate-spin">⏳</span>
              <span className="ml-2">加载数据中...</span>
            </div>
          ) : posts.length > 0 ? (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-dark-card">
                  <tr className="text-left text-dark-muted border-b border-dark-border">
                    <th className="p-2">Title</th>
                    <th className="p-2">Subreddit</th>
                    <th className="p-2">Author</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Comments</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.slice(0, 100).map((post, idx) => (
                    <tr key={idx} className="border-b border-dark-border/50 hover:bg-dark-hover">
                      <td className="p-2 text-dark-text max-w-xs truncate" title={post.title}>
                        {post.title}
                      </td>
                      <td className="p-2 text-reddit-orange">r/{post.subreddit}</td>
                      <td className="p-2 text-dark-muted">u/{post.author}</td>
                      <td className="p-2 text-dark-text">{post.score}</td>
                      <td className="p-2 text-dark-text">{post.numComments}</td>
                      <td className="p-2 text-dark-muted text-xs">
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {posts.length > 100 && (
                <p className="text-center py-2 text-dark-muted text-sm">
                  还有 {posts.length - 100} 条数据...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-dark-muted">
              <p>该抓取任务暂无数据</p>
            </div>
          )}
          
          <div className="mt-4 flex items-center justify-between text-xs text-dark-muted">
            <span>共 {posts.length} 条数据</span>
            <a 
              href={selectedRun.consoleUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-reddit-orange hover:underline"
            >
              在 Apify 控制台查看 →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

interface ScrapeStatusProps {
  projectId: string
  onRefresh?: () => void
}