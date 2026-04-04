'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { showToast } from '@/components/Toast'

interface Project {
  id: string
  name: string
  product_name: string
  product_description?: string
  target_audience?: string
  brand_names?: string[]
  competitor_brands?: string[]
  keywords?: { seed?: string[] }
  subreddits?: any[]
  status: string
  created_at: string
  updated_at: string
}

export default function ConfigPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  
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

  // 删除项目
  const handleDelete = async (project: Project) => {
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
                className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-shadow p-6 group"
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
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
