'use client'

import { useState, useEffect } from 'react'
import { showToast } from './Toast'

interface ScrapeConfig {
  search_query: string
  search_subreddit: string
  reddit_urls: string[]
  sort_order: string
  time_filter: string
  max_posts: number
  include_comments: boolean
  max_comments: number
  comment_depth: number
  filter_keywords: string[]
  deduplicate: boolean
}

interface Template {
  id: string
  name: string
  config: ScrapeConfig
}

interface ScrapePanelProps {
  projectId: string
  onScrapeComplete?: (data: any) => void
}

interface ScrapeResult {
  posts: any[]
  runId: string
  datasetId: string
}

export default function ScrapePanel({ projectId, onScrapeComplete }: ScrapePanelProps) {
  const [showPanel, setShowPanel] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null)
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  
  const [config, setConfig] = useState<ScrapeConfig>({
    search_query: '',
    search_subreddit: '',
    reddit_urls: [],
    sort_order: 'relevance',
    time_filter: 'all',
    max_posts: 100,
    include_comments: true,
    max_comments: 30,
    comment_depth: 3,
    filter_keywords: [],
    deduplicate: true,
  })

  useEffect(() => {
    if (showPanel && projectId) {
      loadTemplates()
    }
  }, [showPanel, projectId])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scrape-templates`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (e) {
      console.error('Failed to load templates:', e)
    }
  }

  const pollRunStatus = async (runId: string, datasetId: string): Promise<any> => {
    const maxAttempts = 60 // 支持最多 2 分钟等待
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const statusRes = await fetch(`/api/apify-run?run_id=${runId}`)
        
        if (!statusRes.ok) {
          // 网络错误，继续等待
          setScrapeStatus(`等待 Apify 处理中... (${i + 1}/${maxAttempts}) - 网络错误，重试中`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        }
        
        const statusData = await statusRes.json()
        setScrapeStatus(`抓取中... (${i + 1}/${maxAttempts}) - ${formatStatus(statusData.status)}`)
        
        if (statusData.status === 'SUCCEEDED') {
          return statusData
        }
        
        if (statusData.status === 'FAILED') {
          throw new Error(`Apify 任务失败: ${statusData.status}`)
        }
        
        if (statusData.status === 'ABORTED') {
          throw new Error(`任务已取消: ${statusData.status}`)
        }
        
        // RUNNING, READY, CREATED 等状态继续等待
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (e: any) {
        if (e.message.includes('失败') || e.message.includes('取消')) {
          throw e
        }
        // 其他错误（如网络）继续等待
        setScrapeStatus(`等待 Apify 处理中... (${i + 1}/${maxAttempts}) - ${e.message}`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
    
    // 超时后检查最新状态
    try {
      const finalRes = await fetch(`/api/apify-run?run_id=${runId}`)
      if (finalRes.ok) {
        const finalData = await finalRes.json()
        if (finalData.status === 'SUCCEEDED') {
          return finalData
        }
        if (finalData.status === 'RUNNING' || finalData.status === 'READY') {
          setScrapeStatus('抓取任务仍在运行中，请稍后在历史记录中查看结果')
          return { ...finalData, timedOut: true }
        }
      }
    } catch (e) {}
    
    throw new Error('抓取超时，请稍后在历史记录中查看结果')
  }

  const formatStatus = (status: string | undefined) => {
    const statusMap: Record<string, string> = {
      'SUCCEEDED': '已完成',
      'FAILED': '失败',
      'RUNNING': '运行中',
      'READY': '就绪',
      'CREATED': '创建中',
      'ABORTED': '已取消',
      'TIMED-OUT': '超时'
    }
    return statusMap[status || ''] || status || '未知'
  }

  const fetchScrapeData = async (datasetId: string): Promise<any[]> => {
    const dataRes = await fetch(`/api/apify-data?dataset_id=${datasetId}&limit=500`)
    const data = await dataRes.json()
    return data.posts || []
  }

  const handleStartScrape = async () => {
    setIsLoading(true)
    setScrapeStatus('正在启动抓取任务...')
    setScrapeResult(null)
    
    try {
      // Start the scrape
      const res = await fetch('/api/apify-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          config: config
        })
      })
      
      if (!res.ok) {
        throw new Error('启动抓取任务失败')
      }
      
      const result = await res.json()
      
      if (!result.run_id) {
        throw new Error('未获取到任务ID')
      }
      
      setScrapeStatus(`任务已启动 (ID: ${result.run_id.substring(0, 8)}...)，正在等待 Apify 处理...`)
      
      // Poll for completion
      const statusResult = await pollRunStatus(result.run_id, result.dataset_id)
      
      if (statusResult.timedOut) {
        // 超时但不表示失败，任务可能仍在运行
        showToast('任务已在后台运行，请稍后在历史记录中查看结果', 'info')
        setScrapeStatus('任务已在后台运行，请刷新页面查看最新状态')
        setIsLoading(false)
        return
      }
      
      setScrapeStatus('抓取完成，正在获取数据...')
      
      // Fetch the scraped data
      const posts = await fetchScrapeData(result.dataset_id)
      
      setScrapeResult({
        posts,
        runId: result.run_id,
        datasetId: result.dataset_id
      })
      
      setScrapeStatus(`抓取完成！获取到 ${posts.length} 条数据`)
      
      // Notify parent component
      if (onScrapeComplete) {
        onScrapeComplete({ posts, runId: result.run_id, datasetId: result.dataset_id })
      }
      
      showToast(`抓取完成！获取到 ${posts.length} 条 Reddit 数据`, 'success')
      
    } catch (e: any) {
      console.error('Scrape error:', e)
      showToast(`抓取失败: ${e.message}`, 'error')
      setScrapeStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    const name = prompt('模板名称:')
    if (!name) return

    try {
      const res = await fetch(`/api/projects/${projectId}/scrape-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config })
      })
      
      if (res.ok) {
        showToast('模板已保存', 'success')
        loadTemplates()
      }
    } catch (e) {
      showToast('保存模板失败', 'error')
    }
  }

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setConfig(template.config)
      setSelectedTemplate(templateId)
      showToast(`已加载模板: ${template.name}`, 'success')
    }
  }

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="w-full py-3 px-4 bg-reddit-orange hover:bg-[#E63E00] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        <span>🔍</span>
        <span>新建抓取任务</span>
      </button>
    )
  }

  const handleDownload = () => {
    if (!scrapeResult || scrapeResult.posts.length === 0) {
      showToast('暂无数据可下载', 'error')
      return
    }
    
    const posts = scrapeResult.posts
    const csvContent = [
      ['标题', 'Subreddit', '作者', '评分', '评论数', '内容', 'URL', '抓取时间'].join(','),
      ...posts.map(p => [
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.subreddit || '',
        p.author || '',
        p.score || 0,
        p.num_comments || 0,
        `"${(p.selftext || '').substring(0, 200).replace(/"/g, '""')}"`,
        p.url || p.permalink || '',
        p.scraped_at || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reddit_scrape_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(`已下载 ${posts.length} 条数据`, 'success')
  }

  const handleClose = () => {
    setShowPanel(false)
    setScrapeStatus(null)
    setScrapeResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-dark-border">
        <div className="p-6 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-10">
          <h2 className="text-xl font-black text-dark-text">📡 新建抓取任务</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-dark-muted hover:text-dark-text text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Selector */}
          <div className="bg-dark-hover p-4 rounded-xl">
            <label className="block text-sm font-medium text-dark-muted mb-2">
              加载模板
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className="flex-1 bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              >
                <option value="">选择模板...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-dark-border hover:bg-dark-hover text-dark-text rounded-lg font-medium"
              >
                保存为模板
              </button>
            </div>
          </div>

          {/* What to scrape */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-dark-text">🔍 What to scrape</h3>
            
            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">
                Search Query
              </label>
              <input
                type="text"
                value={config.search_query}
                onChange={(e) => setConfig({...config, search_query: e.target.value})}
                placeholder="例如: miko 3"
                className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">
                Search Subreddit (可选)
              </label>
              <input
                type="text"
                value={config.search_subreddit}
                onChange={(e) => setConfig({...config, search_subreddit: e.target.value})}
                placeholder="例如: headphones"
                className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              />
            </div>
          </div>

          {/* Sort & Limits */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-dark-text">📊 Sort & Limits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">
                  Sort Order
                </label>
                <select
                  value={config.sort_order}
                  onChange={(e) => setConfig({...config, sort_order: e.target.value})}
                  className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                >
                  <option value="relevance">Relevance</option>
                  <option value="hot">Hot</option>
                  <option value="new">New</option>
                  <option value="top">Top</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">
                  Time Filter
                </label>
                <select
                  value={config.time_filter}
                  onChange={(e) => setConfig({...config, time_filter: e.target.value})}
                  className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                >
                  <option value="all">All time</option>
                  <option value="day">Past 24 hours</option>
                  <option value="week">Past week</option>
                  <option value="month">Past month</option>
                  <option value="year">Past year</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-muted mb-1">
                Max Posts: {config.max_posts}
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={config.max_posts}
                onChange={(e) => setConfig({...config, max_posts: parseInt(e.target.value)})}
                className="w-full"
              />
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-dark-text">💬 Comments</h3>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.include_comments}
                onChange={(e) => setConfig({...config, include_comments: e.target.checked})}
                className="w-5 h-5 accent-reddit-orange"
              />
              <span className="text-dark-muted">Include Comments</span>
            </label>

            {config.include_comments && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">
                    Max Comments/Post
                  </label>
                  <input
                    type="number"
                    value={config.max_comments}
                    onChange={(e) => setConfig({...config, max_comments: parseInt(e.target.value)})}
                    className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">
                    Comment Depth
                  </label>
                  <input
                    type="number"
                    value={config.comment_depth}
                    onChange={(e) => setConfig({...config, comment_depth: parseInt(e.target.value)})}
                    className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filtering */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-dark-text">🔑 Filtering</h3>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.deduplicate}
                onChange={(e) => setConfig({...config, deduplicate: e.target.checked})}
                className="w-5 h-5 accent-reddit-orange"
              />
              <span className="text-dark-muted">Deduplicate Posts</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-dark-border">
          {/* Status Display */}
          {scrapeStatus && (
            <div className="mb-4 p-3 bg-reddit-orange/10 border border-reddit-orange/30 rounded-lg">
              <div className="flex items-center gap-2 text-reddit-orange">
                {isLoading && <span className="animate-spin">⏳</span>}
                <span>{scrapeStatus}</span>
              </div>
            </div>
          )}
          
          {/* Result Display */}
          {scrapeResult && scrapeResult.posts.length > 0 && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-green-400 font-medium flex items-center gap-2">
                    <span>✅</span>
                    <span>抓取成功！</span>
                  </div>
                  <div className="text-dark-muted text-sm mt-1">
                    获取到 {scrapeResult.posts.length} 条 Reddit 数据
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <span>⬇</span>
                  <span>下载CSV</span>
                </button>
              </div>
              <div className="mt-3 text-xs text-dark-muted">
                Run ID: {scrapeResult.runId} | Dataset: {scrapeResult.datasetId}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-dark-border text-dark-text rounded-lg hover:bg-dark-hover"
            >
              {scrapeResult ? '关闭' : '取消'}
            </button>
            {!scrapeResult && (
              <button
                onClick={handleStartScrape}
                disabled={isLoading || (!config.search_query && !config.search_subreddit)}
                className="px-6 py-2 bg-reddit-orange hover:bg-[#E63E00] disabled:bg-dark-border text-white rounded-lg font-medium flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>抓取中...</span>
                  </>
                ) : (
                  <>
                    <span>▶</span>
                    <span>开始抓取</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
