'use client'

import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/Toast'
import WorkflowGuide from '@/components/WorkflowGuide'
import Link from 'next/link'

interface Project {
  id: string
  name: string
}

interface Persona {
  id: string
  project_id: string
  name: string
  username: string
  avatar_emoji: string
  avatar_color: string
  description: string
  description_en: string
  background: string
  tone: string
  focus: string[]
  post_types: string[]
  reddit_habits: {
    subreddits: string[]
    posting_frequency: string
    interaction_style: string
  } | null
  writing_traits: {
    sentence_style: string
    abbreviations: string[]
    emoji_usage: string
    reddit_expressions: string[]
  } | null
  brand_strategy: string
  flaws: string
  sample_comments: string[] | null
  created_at: string
  updated_at: string
}

const avatarColors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
]

export default function PersonaPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Modals
  const [showPreview, setShowPreview] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState<string | null>(null)

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()
      if (result.success) {
        setProjects(result.data)
      } else {
        showToast(result.error || '加载项目失败', 'error')
      }
    } catch (error) {
      showToast('加载项目失败', 'error')
    }
  }

  const fetchPersonas = useCallback(async (projectId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/personas?project_id=${projectId}`)
      const result = await response.json()
      if (result.success) {
        setPersonas(result.data)
      } else {
        showToast(result.error || '加载人设失败', 'error')
      }
    } catch (error) {
      showToast('加载人设失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      fetchPersonas(projectId)
    } else {
      setPersonas([])
    }
  }

  const handleGeneratePersonas = async () => {
    if (!selectedProjectId) {
      showToast('请先选择项目', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/personas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId }),
      })
      const result = await response.json()

      if (result.success) {
        setPersonas(result.data)
        showToast(`成功生成 ${result.data.length} 个人设`, 'success')
      } else {
        showToast(result.error || '生成人设失败', 'error')
      }
    } catch (error) {
      showToast('生成人设过程出错', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeletePersona = async (id: string) => {
    if (!confirm('确定要删除这个人设吗？')) return

    try {
      const response = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        setPersonas(prev => prev.filter(p => p.id !== id))
        showToast('人设已删除', 'success')
      } else {
        showToast(result.error || '删除失败', 'error')
      }
    } catch (error) {
      showToast('删除人设失败', 'error')
    }
  }

  const handleRegenerateAll = async () => {
    if (!confirm('重新生成将清除现有 AI 生成的人设，确定继续吗？')) return
    await handleGeneratePersonas()
  }

  return (
    <div className="space-y-6">
      <WorkflowGuide
        title="P4-1 人设管理"
        description="AI 根据项目信息智能生成虚拟用户人设，让内容更像真实 Reddit 用户的分享"
        steps={[
          { title: '选择项目', description: '系统读取 P1 配置的产品信息' },
          { title: 'AI 生成人设', description: '根据产品自动生成 3-5 个针对性人设' },
          { title: '预览和编辑', description: '查看示例回复，编辑不满意的人设' },
          { title: '进入 P4-2 内容创作', description: '人设准备好后开始创作内容' },
        ]}
        details={`【AI 人设生成逻辑】
系统会读取你的产品信息（产品名、描述、目标受众、竞品），调用 AI 生成一组适合该产品的人设。

每个人设包含：
• 名字和背景故事：像真实 Reddit 用户
• Reddit 使用习惯：常逛哪些板块、发帖频率
• 写作特征：句式偏好、缩写习惯、emoji 使用
• 品牌提及策略：如何自然地提到产品
• 不完美点：增加真实感的小缺点
• 示例评论：展示说话方式`}
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
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">人设库</h2>
              <p className="text-sm text-slate-500 mt-1">
                {personas.length} 个人设
              </p>
            </div>
            <div className="flex gap-3">
              {personas.length > 0 && (
                <button
                  onClick={handleRegenerateAll}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? '生成中...' : '重新生成全部'}
                </button>
              )}
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                + 自定义人设
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">加载人设中...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && personas.length === 0 && (
            <div className="glass-card text-center py-16">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-black text-slate-900 mb-2">还没有人设</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                AI 会根据你的产品信息（产品名、描述、目标受众、竞品）自动生成 3-5 个适合在 Reddit 上推广的虚拟用户人设
              </p>
              <button
                onClick={handleGeneratePersonas}
                disabled={isGenerating}
                className="px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 text-lg"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AI 正在根据你的产品信息设计人设...
                  </span>
                ) : (
                  '✨ AI 智能生成人设'
                )}
              </button>
            </div>
          )}

          {/* Persona Cards */}
          {!isLoading && personas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onDelete={handleDeletePersona}
                  onPreview={() => setShowPreview(persona.id)}
                  onEdit={() => setShowEditForm(persona.id)}
                />
              ))}
            </div>
          )}

          {/* Next Step Button */}
          <Link href="/workflow/content">
            <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">
              下一步：内容创作 →
            </button>
          </Link>
        </>
      )}

      {/* Modals */}
      {showPreview && (
        <PreviewModal
          personaId={showPreview}
          onClose={() => setShowPreview(null)}
        />
      )}

      {showCreateForm && (
        <CreatePersonaModal
          projectId={selectedProjectId}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => fetchPersonas(selectedProjectId)}
        />
      )}

      {showEditForm && (
        <EditPersonaModal
          personaId={showEditForm}
          onClose={() => setShowEditForm(null)}
          onSuccess={() => fetchPersonas(selectedProjectId)}
        />
      )}
    </div>
  )
}

// Persona Card Component
function PersonaCard({
  persona,
  onDelete,
  onPreview,
  onEdit,
}: {
  persona: Persona
  onDelete: (id: string) => void
  onPreview: () => void
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const writingTraitsText = persona.writing_traits
    ? [
        persona.writing_traits.sentence_style && `${persona.writing_traits.sentence_style}`,
        persona.writing_traits.abbreviations?.length > 0 && `使用缩写`,
        persona.writing_traits.emoji_usage && `${persona.writing_traits.emoji_usage}用 emoji`,
      ].filter(Boolean).join(' / ')
    : ''

  return (
    <div className="glass-card hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${persona.avatar_color || 'bg-slate-500'} bg-opacity-20`}>
            {persona.avatar_emoji || '👤'}
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">{persona.name}</div>
            <div className="text-xs text-slate-400">{persona.username}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">编辑</button>
          <button onClick={onDelete.bind(null, persona.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
        </div>
      </div>

      {/* Background */}
      <p className="text-xs text-slate-600 mb-4 line-clamp-2">{persona.background}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {persona.tone && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
            {persona.tone}
          </span>
        )}
        {persona.brand_strategy && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
            {persona.brand_strategy}
          </span>
        )}
      </div>

      {/* Writing Traits */}
      {writingTraitsText && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">写作特征</div>
          <div className="text-xs text-slate-600">{writingTraitsText}</div>
        </div>
      )}

      {/* Flaws */}
      {persona.flaws && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">不完美点</div>
          <div className="text-xs text-slate-500 italic">"{persona.flaws}"</div>
        </div>
      )}

      {/* Sample Comments */}
      {persona.sample_comments && persona.sample_comments.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            {expanded ? '收起示例评论' : `查看示例评论 (${persona.sample_comments.length})`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {persona.sample_comments.map((comment, i) => (
                <div key={i} className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                  "{comment}"
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onPreview}
          className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
        >
          预览效果
        </button>
      </div>
    </div>
  )
}

// Preview Modal
function PreviewModal({ personaId, onClose }: { personaId: string; onClose: () => void }) {
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [personaName, setPersonaName] = useState('')

  const handlePreview = async () => {
    if (!postTitle.trim()) {
      showToast('请输入帖子标题', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`/api/personas/${personaId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_post_title: postTitle, sample_post_body: postBody }),
      })
      const result = await response.json()

      if (result.success) {
        setPreview(result.data.preview)
        setPersonaName(result.data.persona_name)
      } else {
        showToast(result.error || '生成预览失败', 'error')
      }
    } catch (error) {
      showToast('生成预览过程出错', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900 mb-6">预览人设说话方式</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">帖子标题</label>
            <input
              type="text"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="例如：Best open ear earbuds for running?"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">帖子内容（可选）</label>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="粘贴帖子正文内容..."
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={isGenerating}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {isGenerating ? '生成中...' : '生成示例回复'}
          </button>
        </div>

        {preview && (
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">{personaName} 的回复：</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{preview}</div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Persona Modal
function CreatePersonaModal({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    avatar_emoji: '👤',
    avatar_color: 'bg-blue-500',
    background: '',
    tone: '',
    brand_strategy: '',
    flaws: '',
    description: '',
    description_en: '',
    reddit_habits: { subreddits: [], posting_frequency: '', interaction_style: '' },
    writing_traits: { sentence_style: '', abbreviations: [], emoji_usage: '', reddit_expressions: [] },
    sample_comments: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name || !formData.background) {
      showToast('请填写名称和背景', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, project_id: projectId }),
      })
      const result = await response.json()

      if (result.success) {
        showToast('人设已创建', 'success')
        onSuccess()
        onClose()
      } else {
        showToast(result.error || '创建失败', 'error')
      }
    } catch (error) {
      showToast('创建人设失败', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900 mb-6">创建自定义人设</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="TechRunner"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="u/tech_runner"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
              <input
                type="text"
                value={formData.avatar_emoji}
                onChange={(e) => setFormData({ ...formData, avatar_emoji: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">背景故事</label>
            <textarea
              value={formData.background}
              onChange={(e) => setFormData({ ...formData, background: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="描述这个人物的背景..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">语气风格</label>
              <input
                type="text"
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="casual / nerdy / enthusiastic"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">品牌提及策略</label>
              <input
                type="text"
                value={formData.brand_strategy}
                onChange={(e) => setFormData({ ...formData, brand_strategy: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="亲身体验分享 / 朋友推荐"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">不完美点（增加真实感）</label>
            <input
              type="text"
              value={formData.flaws}
              onChange={(e) => setFormData({ ...formData, flaws: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="唯一不满意的是价格有点贵..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">英文人设描述（用于内容生成）</label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              placeholder="Full English persona description for AI content generation..."
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Edit Persona Modal
function EditPersonaModal({ personaId, onClose, onSuccess }: { personaId: string; onClose: () => void; onSuccess: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    avatar_emoji: '',
    avatar_color: '',
    background: '',
    tone: '',
    brand_strategy: '',
    flaws: '',
    description: '',
    description_en: '',
  })

  useEffect(() => {
    fetch(`/api/personas/${personaId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setPersona(result.data)
          setFormData({
            name: result.data.name || '',
            username: result.data.username || '',
            avatar_emoji: result.data.avatar_emoji || '',
            avatar_color: result.data.avatar_color || '',
            background: result.data.background || '',
            tone: result.data.tone || '',
            brand_strategy: result.data.brand_strategy || '',
            flaws: result.data.flaws || '',
            description: result.data.description || '',
            description_en: result.data.description_en || '',
          })
        }
        setIsLoading(false)
      })
  }, [personaId])

  const handleSubmit = async () => {
    if (!formData.name) {
      showToast('名称不能为空', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/personas/${personaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const result = await response.json()

      if (result.success) {
        showToast('人设已更新', 'success')
        onSuccess()
        onClose()
      } else {
        showToast(result.error || '更新失败', 'error')
      }
    } catch (error) {
      showToast('更新人设失败', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">加载人设中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900 mb-6">编辑人设</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
              <input
                type="text"
                value={formData.avatar_emoji}
                onChange={(e) => setFormData({ ...formData, avatar_emoji: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">背景故事</label>
            <textarea
              value={formData.background}
              onChange={(e) => setFormData({ ...formData, background: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">语气风格</label>
              <input
                type="text"
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">品牌提及策略</label>
              <input
                type="text"
                value={formData.brand_strategy}
                onChange={(e) => setFormData({ ...formData, brand_strategy: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">不完美点</label>
            <input
              type="text"
              value={formData.flaws}
              onChange={(e) => setFormData({ ...formData, flaws: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">英文人设描述</label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
