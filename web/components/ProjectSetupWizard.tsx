'use client'

import { useState, useEffect } from 'react'
import { showToast } from './Toast'

interface Subreddit {
  name: string
  reason: string
  relevance: string
}

interface Suggestions {
  search_queries: string[]
  subreddits: Subreddit[]
  competitor_brands: string[]
  classification_keywords: Record<string, string[]>
  reasoning: string
}

interface ProjectSetupWizardProps {
  projectId?: string
  onComplete?: (projectId: string) => void
  onCancel?: () => void
}

type Step = 'background' | 'keywords' | 'generating' | 'review' | 'complete'

const RELEVANCE_COLORS: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500'
}

export default function ProjectSetupWizard({ projectId, onComplete, onCancel }: ProjectSetupWizardProps) {
  const [step, setStep] = useState<Step>('background')
  const [projectName, setProjectName] = useState('')
  const [backgroundInfo, setBackgroundInfo] = useState('')
  const [seedKeywords, setSeedKeywords] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  
  // Editing state
  const [editedQueries, setEditedQueries] = useState<string[]>([])
  const [editedSubreddits, setEditedSubreddits] = useState<Subreddit[]>([])
  const [editedCompetitors, setEditedCompetitors] = useState<string[]>([])

  // Load existing project data if editing
  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  const loadProject = async () => {
    if (!projectId) return
    
    try {
      setIsLoading(true)
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        const project = data.project
        if (project) {
          setProjectName(project.name || '')
          setBackgroundInfo(project.background_info || '')
          
          // Parse stored data
          if (project.search_queries) {
            try {
              const queries = JSON.parse(project.search_queries)
              setEditedQueries(Array.isArray(queries) ? queries : [])
            } catch {}
          }
          if (project.subreddits) {
            try {
              const subs = JSON.parse(project.subreddits)
              setEditedSubreddits(Array.isArray(subs) ? subs : [])
            } catch {}
          }
          if (project.competitor_brands) {
            try {
              const comps = JSON.parse(project.competitor_brands)
              setEditedCompetitors(Array.isArray(comps) ? comps : [])
            } catch {}
          }
          if (project.classification_keywords) {
            try {
              const classKw = JSON.parse(project.classification_keywords)
              if (suggestions) {
                setSuggestions({ ...suggestions, classification_keywords: classKw })
              } else {
                setSuggestions({
                  search_queries: [],
                  subreddits: [],
                  competitor_brands: [],
                  classification_keywords: classKw,
                  reasoning: ''
                })
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Failed to load project:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)

    showToast('文件上传解析功能开发中，敬请期待', 'info')
  }

  const handleGenerate = async () => {
    if (!seedKeywords.trim()) {
      showToast('请输入至少一个关键词', 'error')
      return
    }

    setIsLoading(true)
    setStep('generating')

    try {
      const keywords = seedKeywords.split(',').map(k => k.trim()).filter(Boolean)
      
      const response = await fetch('/api/projects/keyword-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed_keywords: keywords,
          project_context: backgroundInfo,
          project_id: projectId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate suggestions')
      }

      const data = await response.json()
      setSuggestions(data.suggestions)
      
      // Initialize edited state
      setEditedQueries(data.suggestions.search_queries || [])
      setEditedSubreddits(data.suggestions.subreddits || [])
      setEditedCompetitors(data.suggestions.competitor_brands || [])
      
      setStep('review')
    } catch (error) {
      console.error('Error generating suggestions:', error)
      showToast('生成建议失败，请重试', 'error')
      setStep('keywords')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!projectName.trim()) {
      showToast('请输入项目名称', 'error')
      return
    }

    setIsLoading(true)

    try {
      // Create or update project
      const method = projectId ? 'PUT' : 'POST'
      const url = projectId ? `/api/projects/${projectId}` : '/api/projects'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          background_info: backgroundInfo,
          search_query: JSON.stringify(editedQueries),
          subreddits: JSON.stringify(editedSubreddits),
          suggested_keywords: JSON.stringify(editedCompetitors),
          classification_keywords: JSON.stringify(suggestions?.classification_keywords || {})
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save project')
      }

      const data = await response.json()
      const finalProjectId = data.project_id || projectId
      
      setStep('complete')
      showToast('项目配置已保存', 'success')
      
      if (onComplete) {
        setTimeout(() => onComplete(finalProjectId), 1500)
      }
    } catch (error) {
      console.error('Error saving project:', error)
      showToast('保存失败，请重试', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const addQuery = () => {
    setEditedQueries([...editedQueries, ''])
  }

  const removeQuery = (index: number) => {
    setEditedQueries(editedQueries.filter((_, i) => i !== index))
  }

  const updateQuery = (index: number, value: string) => {
    const newQueries = [...editedQueries]
    newQueries[index] = value
    setEditedQueries(newQueries)
  }

  const addSubreddit = () => {
    setEditedSubreddits([...editedSubreddits, { name: '', reason: '', relevance: 'medium' }])
  }

  const removeSubreddit = (index: number) => {
    setEditedSubreddits(editedSubreddits.filter((_, i) => i !== index))
  }

  const updateSubreddit = (index: number, field: keyof Subreddit, value: string) => {
    const newSubs = [...editedSubreddits]
    newSubs[index] = { ...newSubs[index], [field]: value }
    setEditedSubreddits(newSubs)
  }

  const addCompetitor = () => {
    setEditedCompetitors([...editedCompetitors, ''])
  }

  const removeCompetitor = (index: number) => {
    setEditedCompetitors(editedCompetitors.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, value: string) => {
    const newComps = [...editedCompetitors]
    newComps[index] = value
    setEditedCompetitors(newComps)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-dark-border">
        {/* Header */}
        <div className="p-6 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-10">
          <div>
            <h2 className="text-xl font-black text-dark-text">🛠️ 项目配置向导</h2>
            <p className="text-dark-muted text-sm mt-1">
              {step === 'background' && '第1步：输入项目背景'}
              {step === 'keywords' && '第2步：设置搜索关键词'}
              {step === 'generating' && '第3步：AI生成建议中...'}
              {step === 'review' && '第4步：审核搜索策略'}
              {step === 'complete' && '✅ 配置完成'}
            </p>
          </div>
          <button
            onClick={onCancel || (() => window.location.reload())}
            className="text-dark-muted hover:text-dark-text text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Background */}
          {step === 'background' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-2">
                  项目名称
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例如：开放式耳机市场调研"
                  className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-2">
                  项目背景（可选）
                </label>
                <textarea
                  value={backgroundInfo}
                  onChange={(e) => setBackgroundInfo(e.target.value)}
                  placeholder="描述你的产品、品牌、目标市场...（AI会据此调整搜索建议）"
                  rows={4}
                  className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-2">
                  或上传文件（开发中）
                </label>
                <div className="border-2 border-dashed border-dark-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".csv,.pdf,.txt,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled
                  />
                  <label htmlFor="file-upload" className="cursor-pointer opacity-50">
                    <div className="text-4xl mb-2">📄</div>
                    <div className="text-dark-muted">点击上传 CSV、PDF、TXT 文件</div>
                    <div className="text-dark-muted text-xs mt-1">AI将读取文件理解产品信息</div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep('keywords')}
                  disabled={!projectName.trim()}
                  className="px-6 py-2 bg-reddit-orange hover:bg-[#E63E00] disabled:bg-dark-border text-white rounded-lg font-medium"
                >
                  下一步 →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Keywords */}
          {step === 'keywords' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-2">
                  种子关键词（必填）
                </label>
                <input
                  type="text"
                  value={seedKeywords}
                  onChange={(e) => setSeedKeywords(e.target.value)}
                  placeholder="例如: open ear earbuds, 开放式耳机 (多个用逗号分隔)"
                  className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                />
                <p className="text-dark-muted text-xs mt-2">
                  输入产品/品牌相关的核心关键词，AI会根据这些词扩展更多搜索变体
                </p>
              </div>

              <div className="bg-dark-hover rounded-lg p-4">
                <h4 className="text-sm font-medium text-dark-text mb-2">💡 AI会自动扩展</h4>
                <ul className="text-dark-muted text-sm space-y-1">
                  <li>• 产品词的各种表达方式</li>
                  <li>• 使用场景相关词汇（跑步、通勤等）</li>
                  <li>• 竞品品牌名称</li>
                  <li>• 问题/痛点类搜索词</li>
                  <li>• 对比类搜索词（vs, best, top）</li>
                </ul>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('background')}
                  className="px-6 py-2 border border-dark-border text-dark-text rounded-lg hover:bg-dark-hover"
                >
                  ← 上一步
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!seedKeywords.trim() || isLoading}
                  className="px-6 py-2 bg-reddit-orange hover:bg-[#E63E00] disabled:bg-dark-border text-white rounded-lg font-medium flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>AI生成中...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>让AI生成建议</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 'generating' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 animate-pulse">🤖</div>
              <h3 className="text-xl font-bold text-dark-text mb-2">AI正在分析...</h3>
              <p className="text-dark-muted">根据你的输入，AI正在生成最优搜索策略</p>
              <div className="mt-4 flex justify-center gap-2">
                <span className="w-3 h-3 bg-reddit-orange rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-3 h-3 bg-reddit-orange rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-3 h-3 bg-reddit-orange rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && suggestions && (
            <div className="space-y-6">
              {/* Reasoning */}
              {suggestions.reasoning && (
                <div className="bg-reddit-orange/10 border border-reddit-orange/30 rounded-lg p-4">
                  <h4 className="text-reddit-orange font-medium mb-1">💭 AI推荐理由</h4>
                  <p className="text-dark-text text-sm">{suggestions.reasoning}</p>
                </div>
              )}

              {/* Search Queries */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-muted">
                    🔍 搜索词列表（{editedQueries.length}个）
                  </label>
                  <button
                    onClick={addQuery}
                    className="text-reddit-orange text-sm hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editedQueries.map((query, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => updateQuery(i, e.target.value)}
                        className="flex-1 bg-dark-input border border-dark-border rounded px-2 py-1 text-dark-text text-sm"
                      />
                      <button
                        onClick={() => removeQuery(i)}
                        className="text-red-500 hover:text-red-400 px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subreddits */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-muted">
                    📮 推荐Subreddits（{editedSubreddits.length}个）
                  </label>
                  <button
                    onClick={addSubreddit}
                    className="text-reddit-orange text-sm hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editedSubreddits.map((sub, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={sub.name}
                        onChange={(e) => updateSubreddit(i, 'name', e.target.value)}
                        placeholder="subreddit名称"
                        className="w-32 bg-dark-input border border-dark-border rounded px-2 py-1 text-dark-text text-sm"
                      />
                      <input
                        type="text"
                        value={sub.reason}
                        onChange={(e) => updateSubreddit(i, 'reason', e.target.value)}
                        placeholder="推荐原因"
                        className="flex-1 bg-dark-input border border-dark-border rounded px-2 py-1 text-dark-text text-sm"
                      />
                      <select
                        value={sub.relevance}
                        onChange={(e) => updateSubreddit(i, 'relevance', e.target.value)}
                        className="bg-dark-input border border-dark-border rounded px-2 py-1 text-dark-text text-sm"
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                      <button
                        onClick={() => removeSubreddit(i)}
                        className="text-red-500 hover:text-red-400 px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitor Brands */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-muted">
                    🏢 竞品监控（{editedCompetitors.length}个）
                  </label>
                  <button
                    onClick={addCompetitor}
                    className="text-reddit-orange text-sm hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editedCompetitors.map((comp, i) => (
                    <div key={i} className="flex items-center gap-1 bg-dark-hover rounded px-2 py-1">
                      <input
                        type="text"
                        value={comp}
                        onChange={(e) => updateCompetitor(i, e.target.value)}
                        className="bg-transparent border-none text-dark-text text-sm w-24"
                      />
                      <button
                        onClick={() => removeCompetitor(i)}
                        className="text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Classification Keywords Preview */}
              {suggestions.classification_keywords && (
                <div>
                  <label className="text-sm font-medium text-dark-muted mb-2 block">
                    📊 内容分类关键词（5大类）
                  </label>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {Object.entries(suggestions.classification_keywords).map(([cat, keywords]) => (
                      <div key={cat} className="bg-dark-hover rounded p-2">
                        <div className="font-medium text-dark-text capitalize mb-1">{cat.replace('_', ' ')}</div>
                        <div className="text-dark-muted">{keywords.slice(0, 3).join(', ')}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-dark-border">
                <button
                  onClick={() => setStep('keywords')}
                  className="px-6 py-2 border border-dark-border text-dark-text rounded-lg hover:bg-dark-hover"
                >
                  ← 重新生成
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-dark-border text-white rounded-lg font-medium"
                >
                  {isLoading ? '保存中...' : '✅ 保存配置'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-dark-text mb-2">配置完成！</h3>
              <p className="text-dark-muted mb-4">项目搜索策略已保存，现在可以开始抓取了</p>
              <div className="text-2xl animate-bounce">↓</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}