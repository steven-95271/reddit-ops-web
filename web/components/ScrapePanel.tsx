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
}

export default function ScrapePanel({ projectId }: ScrapePanelProps) {
  const [showPanel, setShowPanel] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
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

  const handleStartScrape = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/apify-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          config: config
        })
      })
      
      if (res.ok) {
        showToast('抓取任务已启动', 'success')
        setShowPanel(false)
      } else {
        throw new Error('Failed to start scrape')
      }
    } catch (e) {
      showToast('启动抓取失败', 'error')
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
        className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        <span>🔍</span>
        <span>新建抓取任务</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-black text-slate-900">📡 新建抓取任务</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Selector */}
          <div className="bg-slate-50 p-4 rounded-xl">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              加载模板
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
              >
                <option value="">选择模板...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium"
              >
                保存为模板
              </button>
            </div>
          </div>

          {/* What to scrape */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">🔍 What to scrape</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Search Query
              </label>
              <input
                type="text"
                value={config.search_query}
                onChange={(e) => setConfig({...config, search_query: e.target.value})}
                placeholder="例如: miko 3"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Search Subreddit (可选)
              </label>
              <input
                type="text"
                value={config.search_subreddit}
                onChange={(e) => setConfig({...config, search_subreddit: e.target.value})}
                placeholder="例如: headphones"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
              />
            </div>
          </div>

          {/* Sort & Limits */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">📊 Sort & Limits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort Order
                </label>
                <select
                  value={config.sort_order}
                  onChange={(e) => setConfig({...config, sort_order: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
                >
                  <option value="relevance">Relevance</option>
                  <option value="hot">Hot</option>
                  <option value="new">New</option>
                  <option value="top">Top</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time Filter
                </label>
                <select
                  value={config.time_filter}
                  onChange={(e) => setConfig({...config, time_filter: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
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
            <h3 className="text-lg font-bold text-slate-900">💬 Comments</h3>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.include_comments}
                onChange={(e) => setConfig({...config, include_comments: e.target.checked})}
                className="w-5 h-5 text-brand-600"
              />
              <span className="text-slate-700">Include Comments</span>
            </label>

            {config.include_comments && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Comments/Post
                  </label>
                  <input
                    type="number"
                    value={config.max_comments}
                    onChange={(e) => setConfig({...config, max_comments: parseInt(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Comment Depth
                  </label>
                  <input
                    type="number"
                    value={config.comment_depth}
                    onChange={(e) => setConfig({...config, comment_depth: parseInt(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filtering */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">🔑 Filtering</h3>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.deduplicate}
                onChange={(e) => setConfig({...config, deduplicate: e.target.checked})}
                className="w-5 h-5 text-brand-600"
              />
              <span className="text-slate-700">Deduplicate Posts</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => setShowPanel(false)}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleStartScrape}
            disabled={isLoading || !config.search_query}
            className="px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>启动中...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>开始抓取</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}