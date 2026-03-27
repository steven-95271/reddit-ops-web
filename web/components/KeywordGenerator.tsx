'use client'

import { useState, useEffect } from 'react'
import { showToast } from './Toast'

interface KeywordGeneratorProps {
  projectId: string
}

export default function KeywordGenerator({ projectId }: KeywordGeneratorProps) {
  const [keywords, setKeywords] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [copiedToScrape, setCopiedToScrape] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadKeywords()
    }
  }, [projectId])

  const loadKeywords = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/keywords`)
      if (res.ok) {
        const data = await res.json()
        setKeywords(data.keywords || [])
      }
    } catch (e) {
      console.error('Failed to load keywords:', e)
    } finally {
      setLoading(false)
    }
  }

  const generateKeywords = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/keywords?generate=true`)
      if (res.ok) {
        const data = await res.json()
        setKeywords(data.keywords || [])
        showToast(`生成了 ${data.keywords?.length || 0} 个搜索词`, 'success')
        
        // Save to project
        await fetch(`/api/projects/${projectId}/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: data.keywords })
        })
      }
    } catch (e) {
      showToast('生成失败', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const toggleKeyword = (kw: string) => {
    const newSet = new Set(selectedKeywords)
    if (newSet.has(kw)) {
      newSet.delete(kw)
    } else {
      newSet.add(kw)
    }
    setSelectedKeywords(newSet)
  }

  const selectAll = () => {
    setSelectedKeywords(new Set(keywords))
  }

  const copyToClipboard = () => {
    if (selectedKeywords.size === 0) {
      showToast('请先选择关键词', 'error')
      return
    }
    
    const text = Array.from(selectedKeywords).join(', ')
    navigator.clipboard.writeText(text)
    setCopiedToScrape(true)
    showToast(`已复制 ${selectedKeywords.size} 个关键词到剪贴板`, 'success')
    
    // Store in localStorage for ScrapePanel to use
    localStorage.setItem('selectedKeywords', JSON.stringify(Array.from(selectedKeywords)))
    localStorage.setItem('keywordsTimestamp', Date.now().toString())
  }

  if (loading) {
    return (
      <div className="reddit-panel p-6">
        <div className="text-center py-8 text-dark-muted">加载中...</div>
      </div>
    )
  }

  return (
    <div className="reddit-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-dark-text">🔍 推荐搜索词</h2>
        <button
          onClick={generateKeywords}
          disabled={generating}
          className="btn-primary text-sm flex items-center gap-1"
        >
          {generating ? (
            <>
              <span className="animate-spin">🤖</span>
              <span>生成中...</span>
            </>
          ) : (
            <>
              <span>🤖</span>
              <span>AI 生成</span>
            </>
          )}
        </button>
      </div>

      {keywords.length === 0 ? (
        <div className="text-center py-8 text-dark-muted">
          <span className="text-4xl mb-4 block">💡</span>
          <p>点击"AI 生成"根据项目背景生成搜索词</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-dark-muted">
              {keywords.length} 个搜索词 | 已选 {selectedKeywords.size}
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-reddit-orange hover:underline"
            >
              全选
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {keywords.map((kw, idx) => (
              <button
                key={idx}
                onClick={() => toggleKeyword(kw)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedKeywords.has(kw)
                    ? 'bg-reddit-orange text-white'
                    : 'bg-dark-hover text-dark-text hover:bg-dark-border'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>

          {selectedKeywords.size > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-dark-border">
              <button
                onClick={copyToClipboard}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <span>📋</span>
                <span>复制到抓取</span>
              </button>
              <span className="text-xs text-dark-muted">
                复制后在抓取面板粘贴使用
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}