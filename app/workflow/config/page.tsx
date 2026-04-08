'use client'

import { useState, useEffect } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'

interface SubredditTarget {
  subreddit: string
  reason: string
  relevance: 'high' | 'medium'
  search_within: string[]
}

interface KeywordItem {
  keyword: string
  reason: string
  wordCount: number
}

interface PhaseKeywords {
  seed?: string[]
  reasoning?: string
  phase1_brand?: {
    description: string
    queries: string[]
    reasoning?: string
  }
  phase2_competitor?: {
    description: string
    queries: string[]
    reasoning?: string
  }
  phase3_scene_pain?: {
    description: string
    queries: string[]
    reasoning?: string
  }
  phase4_subreddits?: {
    description?: string
    targets: SubredditTarget[]
  }
}

interface Project {
  id: string
  name: string
  product_name: string
  product_description?: string
  target_audience?: string
  brand_names?: string[]
  competitor_brands?: string[]
  keywords?: PhaseKeywords
  status: string
  created_at: string
  updated_at: string
}

export default function ConfigPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})
  
  // URL 提取
  const [productUrl, setProductUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  
  // 切换关键词分类展开/折叠
  const togglePhaseExpand = (phase: string) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    product_name: '',
    product_description: '',
    target_audience: '',
    brand_names: [''],
    competitor_brands: [''],
    seed_keywords: ['']
  })

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/projects')
      const data = await res.json()
      
      if (data.success) {
        setProjects(data.data || [])
      } else {
        showToast(data.error || '获取项目列表失败', 'error')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      showToast('获取项目列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      product_name: '',
      product_description: '',
      target_audience: '',
      brand_names: [''],
      competitor_brands: [''],
      seed_keywords: ['']
    })
    setProductUrl('')
    setEditingProject(null)
  }

  // 打开新建表单
  const handleNewProject = () => {
    resetForm()
    setShowForm(true)
  }

  // 打开编辑表单
  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name || '',
      product_name: project.product_name || '',
      product_description: project.product_description || '',
      target_audience: project.target_audience || '',
      brand_names: project.brand_names?.length ? project.brand_names : [''],
      competitor_brands: project.competitor_brands?.length ? project.competitor_brands : [''],
      seed_keywords: project.keywords?.seed?.length ? project.keywords.seed : ['']
    })
    setShowForm(true)
  }

  // 查看项目详情
  const handleViewDetail = (project: Project) => {
    setViewingProject(project)
    setShowDetail(true)
  }

  // 删除项目
  const handleDelete = async (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm(`确定要删除项目"${project.name}"吗？此操作不可恢复。`)) {
      return
    }

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (data.success) {
        showToast('项目已删除', 'success')
        fetchProjects()
      } else {
        showToast(data.error || '删除失败', 'error')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      showToast('删除失败', 'error')
    }
  }

  // AI 生成配置
  const handleAIExpand = async () => {
    if (!viewingProject) return

    try {
      setExpanding(true)
      const res = await fetch(`/api/projects/${viewingProject.id}/expand`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        showToast('AI 配置生成成功', 'success')
        // 更新当前查看的项目
        setViewingProject(prev => prev ? {
          ...prev,
          keywords: data.data.keywords
        } : null)
        // 刷新项目列表
        fetchProjects()
      } else {
        showToast(data.error || 'AI 生成失败', 'error')
      }
    } catch (error) {
      console.error('Error expanding project:', error)
      showToast('AI 生成失败', 'error')
    } finally {
      setExpanding(false)
    }
  }

  // 保存配置
  const handleSaveConfig = async () => {
    if (!viewingProject) return

    try {
      setSaving(true)
      const res = await fetch(`/api/projects/${viewingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: viewingProject.keywords
        })
      })
      const data = await res.json()

      if (data.success) {
        showToast('配置已保存', 'success')
        fetchProjects()
      } else {
        showToast(data.error || '保存失败', 'error')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      showToast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 删除查询词
  const removeQuery = (phase: 'phase1' | 'phase2' | 'phase3' | 'phase4', query: string) => {
    const phaseMap: Record<string, 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain' | 'phase4_subreddits'> = {
      phase1: 'phase1_brand',
      phase2: 'phase2_competitor',
      phase3: 'phase3_scene_pain',
      phase4: 'phase4_subreddits'
    }
    const fullPhase = phaseMap[phase]
    
    setViewingProject(prev => {
      if (!prev) return null
      
      if (phase === 'phase4') {
        const targets = prev.keywords?.phase4_subreddits?.targets || []
        const newTargets = targets.filter(t => {
          if (t.subreddit === query) return false
          t.search_within = t.search_within.filter(k => k !== query)
          return true
        })
        return {
          ...prev,
          keywords: {
            ...prev.keywords,
            phase4_subreddits: {
              ...prev.keywords?.phase4_subreddits,
              targets: newTargets
            }
          }
        }
      }
      
      const phaseData = prev.keywords?.[fullPhase]
      if (!phaseData || !('queries' in phaseData)) return prev
      const queries = phaseData.queries || []
      const newQueries = queries.filter((q: string) => q !== query)
      return {
        ...prev,
        keywords: {
          ...prev.keywords,
          [fullPhase]: {
            ...prev.keywords?.[fullPhase],
            queries: newQueries
          }
        }
      }
    })
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.name.trim() || !formData.product_name.trim()) {
      showToast('项目名称和产品名称为必填项', 'error')
      return
    }

    // 过滤空值
    const payload = {
      name: formData.name.trim(),
      product_name: formData.product_name.trim(),
      product_description: formData.product_description.trim(),
      target_audience: formData.target_audience.trim(),
      brand_names: formData.brand_names.filter(Boolean),
      competitor_brands: formData.competitor_brands.filter(Boolean),
      seed_keywords: formData.seed_keywords.filter(Boolean)
    }

    try {
      setLoading(true)
      
      if (editingProject) {
        // 更新项目
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()

        if (data.success) {
          showToast('项目更新成功', 'success')
          setShowForm(false)
          resetForm()
          fetchProjects()
        } else {
          showToast(data.error || '更新失败', 'error')
        }
      } else {
        // 创建新项目
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()

        if (data.success) {
          showToast('项目创建成功', 'success')
          setShowForm(false)
          resetForm()
          fetchProjects()
        } else {
          showToast(data.error || '创建失败', 'error')
        }
      }
    } catch (error) {
      console.error('Error saving project:', error)
      showToast('保存失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // URL 提取处理
  const handleExtractUrl = async () => {
    if (!productUrl.trim()) {
      showToast('请输入产品页面 URL', 'error')
      return
    }

    try {
      setExtracting(true)
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl.trim() })
      })
      const data = await res.json()

      if (data.success) {
        const extracted = data.data
        setFormData(prev => ({
          ...prev,
          product_name: extracted.product_name || prev.product_name,
          product_description: extracted.product_description || prev.product_description,
          target_audience: extracted.target_audience || prev.target_audience,
          brand_names: extracted.brand_names?.length ? extracted.brand_names : prev.brand_names,
          competitor_brands: extracted.competitor_brands?.length ? extracted.competitor_brands : prev.competitor_brands,
          seed_keywords: extracted.suggested_keywords?.length ? extracted.suggested_keywords : prev.seed_keywords
        }))
        showToast('产品信息提取成功！', 'success')
      } else {
        showToast(data.error || '无法提取，请手动填写', 'error')
      }
    } catch (error) {
      console.error('Error extracting URL:', error)
      showToast('无法提取，请手动填写', 'error')
    } finally {
      setExtracting(false)
    }
  }

  // 添加/删除多值字段
  const addArrayField = (field: 'brand_names' | 'competitor_brands' | 'seed_keywords') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayField = (field: 'brand_names' | 'competitor_brands' | 'seed_keywords', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const updateArrayField = (field: 'brand_names' | 'competitor_brands' | 'seed_keywords', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'phase1': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'phase2': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'phase3': return 'bg-green-100 text-green-700 border-green-200'
      case 'phase4': return 'bg-purple-100 text-purple-700 border-purple-200'
      default: return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'phase1': return 'Phase 1: 品牌核心词'
      case 'phase2': return 'Phase 2: 竞品对比词'
      case 'phase3': return 'Phase 3: 场景+痛点词'
      case 'phase4': return 'Phase 4: Subreddit 定向'
      default: return phase
    }
  }

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'bg-green-100 text-green-700 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">P1 项目配置</h1>
          <p className="text-slate-600 mt-2">
            创建和管理你的 Reddit 运营项目，配置产品信息和关键词策略
          </p>
        </div>

        {/* 工作流说明 */}
        <div className="mb-6">
          <WorkflowGuide
            title="P1 项目配置"
            description="在这里创建运营项目，AI 会根据你的产品信息自动推荐关键词和 Reddit 板块"
            steps={[
              {
                title: '填写产品基本信息',
                description: '粘贴产品链接让 AI 提取，或手动填写产品名称、描述等信息'
              },
              {
                title: '点击 AI 生成配置',
                description: 'AI 会自动分析并推荐适合 Reddit 营销的关键词和板块'
              },
              {
                title: '审核并编辑关键词和 Subreddit',
                description: '检查 AI 生成的结果，删除不相关的，添加遗漏的'
              },
              {
                title: '保存后进入 P2 抓取',
                description: '配置完成后保存，即可进入下一步抓取 Reddit 帖子'
              }
            ]}
            details={`【AI 关键词扩展逻辑】
系统将你填写的产品信息（名称、描述、受众、品牌、竞品）发送给 AI，要求它扮演 Reddit 运营专家，生成四类关键词：
• 核心词：产品直接相关的搜索词，如 "open ear earbuds"
• 长尾词：用户可能搜索的完整短语，如 "best open ear earbuds for running 2024"
• 竞品词：竞品品牌名和产品名，用于监控竞品讨论
• 场景词：使用场景相关的词，如 "running"、"commuting"

【Subreddit 推荐逻辑】
AI 根据产品品类，从 Reddit 上筛选相关度高的社区，并标注：
• 相关度等级（高/中/低）
• 推荐理由（为什么这个社区适合推广你的产品）
• 发帖活跃度参考

【URL 提取逻辑】
粘贴产品链接后，系统会抓取网页内容，AI 自动提取产品名称、描述、目标受众、品牌信息，免去手动填写。支持 Amazon、品牌官网等主流电商页面。`}
          />
        </div>

        {/* 操作栏 */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-slate-600">
            共 {projects.length} 个项目
          </div>
          <button
            onClick={handleNewProject}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            + 新建项目
          </button>
        </div>

        {/* 项目列表 */}
        {loading && projects.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">还没有项目</h3>
            <p className="text-slate-500 mb-6">点击上方"新建项目"按钮创建你的第一个项目</p>
            <button
              onClick={handleNewProject}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              创建项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => handleViewDetail(project)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-all p-6 group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{project.name}</h3>
                    <p className="text-sm text-slate-500">{project.product_name}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    project.status === 'active' ? 'bg-green-100 text-green-700' :
                    project.status === 'archived' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {project.status === 'draft' ? '草稿' : 
                     project.status === 'active' ? '进行中' : '已归档'}
                  </span>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                  {project.product_description || '暂无描述'}
                </p>

                {/* 显示关键词配置状态 */}
                <div className="flex items-center gap-2 mb-4">
                  {project.keywords?.phase1_brand?.queries?.length ? (
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded flex items-center gap-1">
                      ✅ 已配置关键词
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded flex items-center gap-1">
                      ⏳ 待生成配置
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.brand_names?.slice(0, 3).map((brand, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                      {brand}
                    </span>
                  ))}
                  {project.brand_names && project.brand_names.length > 3 && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                      +{project.brand_names.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    {new Date(project.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(project)}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={(e) => handleDelete(project, e)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 项目详情弹窗 */}
      {showDetail && viewingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{viewingProject.name}</h2>
                <p className="text-sm text-slate-500">{viewingProject.product_name}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetail(false)
                  setViewingProject(null)
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* 产品信息 */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">产品信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">项目名称：</span>
                    <span className="text-slate-700">{viewingProject.name || '暂无'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">产品名称：</span>
                    <span className="text-slate-700">{viewingProject.product_name || '暂无'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">产品描述：</span>
                    <span className="text-slate-700">{viewingProject.product_description || '暂无'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">目标受众：</span>
                    <span className="text-slate-700">{viewingProject.target_audience || '暂无'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">自有品牌：</span>
                    <span className="text-slate-700">{viewingProject.brand_names?.join(', ') || '暂无'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">竞品品牌：</span>
                    <span className="text-slate-700">{viewingProject.competitor_brands?.join(', ') || '暂无'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">种子关键词：</span>
                    <span className="text-slate-700">{viewingProject.keywords?.seed?.join(', ') || '暂无'}</span>
                  </div>
                </div>
              </div>

              {/* AI 生成按钮 */}
              <div className="flex justify-center">
                <button
                  onClick={handleAIExpand}
                  disabled={expanding}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {expanding ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      AI 生成中...
                    </>
                  ) : (
                    <>
                      🤖 AI 生成配置
                    </>
                  )}
                </button>
              </div>

              {/* 四阶段搜索策略说明 */}
              <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">四阶段搜索策略说明</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium shrink-0">Phase 1</span>
                    <div>
                      <span className="font-medium text-slate-700">品牌核心词 - 宽泛捕网</span>
                      <p className="text-slate-500 mt-0.5">包含品牌名称变体 + 通用品类搜索，如 "[品牌] review"、"[品类] recommendation"。目标：捕获所有关于我们产品和品类的热门讨论。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium shrink-0">Phase 2</span>
                    <div>
                      <span className="font-medium text-slate-700">竞品对比词 - 高价值情报</span>
                      <p className="text-slate-500 mt-0.5">以竞品品牌为主角的比较讨论，如 "[竞品] problems"、"[竞品] vs [品类]"。目标：找到用户在购买决策前主动比较的讨论。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium shrink-0">Phase 3</span>
                    <div>
                      <span className="font-medium text-slate-700">场景+痛点词 - 用户声音</span>
                      <p className="text-slate-500 mt-0.5">真实使用场景和痛点，如 "headphones for [场景]"、"tired of [问题]"。目标：找到自然讨论中产品推荐感强的内容。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium shrink-0">Phase 4</span>
                    <div>
                      <span className="font-medium text-slate-700">Subreddit 定向 - 精准挖掘</span>
                      <p className="text-slate-500 mt-0.5">在高相关性社区内定向搜索，每个社区提供 3-5 个搜索词配合使用。目标：在天然讨论此品类的社区深度挖掘。</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 四阶段搜索策略 */}
              {viewingProject.keywords?.phase1_brand?.queries?.length ? (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">四阶段搜索策略</h3>
                  {viewingProject.keywords?.reasoning && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600">🤖</span>
                        <div>
                          <div className="text-sm font-medium text-amber-800 mb-1">AI 生成逻辑</div>
                          <div className="text-sm text-amber-700">{viewingProject.keywords.reasoning}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    {(['phase1', 'phase2', 'phase3', 'phase4'] as const).map(phase => {
                      const phaseMap: Record<string, 'phase1_brand' | 'phase2_competitor' | 'phase3_scene_pain' | 'phase4_subreddits'> = {
                        phase1: 'phase1_brand',
                        phase2: 'phase2_competitor',
                        phase3: 'phase3_scene_pain',
                        phase4: 'phase4_subreddits'
                      }
                      const fullPhase = phaseMap[phase]
                      const phaseData = viewingProject.keywords?.[fullPhase]
                      if (!phaseData) return null

                      const isExpanded = expandedPhases[phase]
                      const hasQueries = fullPhase === 'phase4_subreddits'
                        ? (phaseData as any)?.targets?.length > 0
                        : (phaseData as any)?.queries?.length > 0
                      
                      if (!hasQueries) return null

                      return (
                        <div key={phase} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => togglePhaseExpand(phase)}
                            className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-slate-700">
                                {getPhaseLabel(phase)}
                              </h4>
                              <span className="text-sm text-slate-500">
                                ({(phaseData as any).description || ''})
                              </span>
                            </div>
                            <svg
                              className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-100">
                              {phase === 'phase4' ? (
                                <div className="space-y-3 mt-4">
                                  {(phaseData as any).targets?.map((target: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 rounded-lg p-4">
                                      <div className="flex justify-between items-start mb-2">
                                        <span className={`px-3 py-1 rounded-full text-sm ${getRelevanceColor(target.relevance)}`}>
                                          r/{target.subreddit}
                                        </span>
                                        <button
                                          onClick={() => removeQuery(phase, target.subreddit)}
                                          className="text-slate-400 hover:text-red-500"
                                        >
                                          ×
                                        </button>
                                      </div>
                                      <div className="text-xs text-slate-500 mb-2">{target.reason}</div>
                                      <div className="flex flex-wrap gap-1">
                                        {target.search_within?.map((term: string, i: number) => (
                                          <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded border border-purple-200">
                                            {term}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-3 mt-4">
                                  {(phaseData as any).queries?.map((item: any, idx: number) => {
                                    const keyword = typeof item === 'string' ? item : item.keyword;
                                    const reason = typeof item === 'string' ? '' : (item.reason || '');
                                    return (
                                      <div key={idx} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border ${getPhaseColor(phase)}`}>
                                            {keyword}
                                            <button
                                              onClick={() => removeQuery(phase, keyword)}
                                              className="ml-1 hover:text-red-500"
                                            >
                                              ×
                                            </button>
                                          </span>
                                          {reason && (
                                            <details className="group">
                                              <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 list-none">
                                                <span className="inline-flex items-center gap-1">
                                                  💡 理由
                                                  <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                  </svg>
                                                </span>
                                              </summary>
                                              <div className="mt-1 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
                                                {reason}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 保存按钮 */}
                  <div className="flex justify-end pt-4 border-t border-slate-200 mt-4">
                    <button
                      onClick={handleSaveConfig}
                      disabled={saving}
                      className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          保存中...
                        </>
                      ) : (
                        '💾 保存配置'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        保存中...
                      </>
                    ) : (
                      '💾 保存配置'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingProject ? '编辑项目' : '新建项目'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* URL 提取 */}
              {!editingProject && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    产品页面 URL（可选）
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={productUrl}
                      onChange={e => setProductUrl(e.target.value)}
                      placeholder="粘贴产品页面 URL（如 Amazon、官网链接），AI 自动提取产品信息"
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleExtractUrl}
                      disabled={extracting || !productUrl.trim()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {extracting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          提取中...
                        </span>
                      ) : (
                        '🤖 AI 提取'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    支持 Amazon、品牌官网等产品页面。AI 会自动提取产品名称、描述、卖点等信息。
                  </p>
                </div>
              )}

              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：开放式耳机推广"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 产品名称 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={e => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="例如：Shokz OpenRun Pro"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 产品描述 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  产品描述
                </label>
                <textarea
                  value={formData.product_description}
                  onChange={e => setFormData(prev => ({ ...prev, product_description: e.target.value }))}
                  placeholder="简要描述产品特点、卖点..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* 目标受众 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  目标受众
                </label>
                <input
                  type="text"
                  value={formData.target_audience}
                  onChange={e => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                  placeholder="例如：跑步爱好者、通勤族"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 自有品牌名 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  自有品牌名
                </label>
                {formData.brand_names.map((brand, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={brand}
                      onChange={e => updateArrayField('brand_names', index, e.target.value)}
                      placeholder="品牌名称"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.brand_names.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('brand_names', index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('brand_names')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + 添加品牌
                </button>
              </div>

              {/* 竞品品牌名 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  竞品品牌名
                </label>
                {formData.competitor_brands.map((brand, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={brand}
                      onChange={e => updateArrayField('competitor_brands', index, e.target.value)}
                      placeholder="竞品品牌名称"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.competitor_brands.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('competitor_brands', index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('competitor_brands')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + 添加竞品
                </button>
              </div>

              {/* 种子关键词 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  种子关键词
                </label>
                {formData.seed_keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={e => updateArrayField('seed_keywords', index, e.target.value)}
                      placeholder="关键词"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.seed_keywords.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('seed_keywords', index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('seed_keywords')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + 添加关键词
                </button>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                >
                  {loading ? '保存中...' : (editingProject ? '更新项目' : '创建项目')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
