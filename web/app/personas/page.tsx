'use client'

import { useState, useEffect } from 'react'
import { showToast } from '@/components/Toast'

interface PersonaTemplate {
  id: string
  name: string
  description: string
  role_type: string
  content_strategy_summary: {
    post_frequency: string
    primary_tone: string
    comment_style: string
  }
}

interface GeneratedPersona {
  name: string
  username: string
  role_type: string
  description: string
  content_strategy_preview: {
    post_frequency: string
    primary_tone: string
    comment_style: string
  }
}

export default function PersonasPage() {
  const [templates, setTemplates] = useState<PersonaTemplate[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedPersonas, setGeneratedPersonas] = useState<GeneratedPersona[]>([])
  const [projectId, setProjectId] = useState('')
  const [prototypeUrl, setPrototypeUrl] = useState('')
  const [usePrototype, setUsePrototype] = useState(false)
  const [projectInfo, setProjectInfo] = useState({
    product_name: '',
    category: '',
    target_audience: '',
    key_benefits: [] as string[],
  })

  useEffect(() => {
    loadTemplates()
    const urlParams = new URLSearchParams(window.location.search)
    const pid = urlParams.get('project_id')
    if (pid) setProjectId(pid)
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/personas/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates)
      }
    } catch (e) {
      console.error('Failed to load templates:', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    )
  }

  const selectRecommended = () => {
    setSelectedTemplates(['tech_expert', 'casual_user', 'skeptical_buyer', 'newcomer'])
  }

  const generatePersonas = async () => {
    if (!projectInfo.product_name) {
      showToast('请输入产品名称', 'error')
      return
    }

    try {
      setGenerating(true)
      const res = await fetch('/api/personas/templates/generate-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_info: projectInfo,
          use_prototype: usePrototype,
          prototype_url: prototypeUrl,
          selected_templates: selectedTemplates.length > 0 ? selectedTemplates : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedPersonas(data.personas || [])
        showToast(`成功生成 ${data.generated_count} 个人设！`, 'success')
      } else {
        throw new Error('Failed to generate')
      }
    } catch (e) {
      showToast('生成失败', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const savePersona = async (persona: GeneratedPersona) => {
    if (!projectId) {
      showToast('请先选择项目', 'error')
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: persona.name,
          username: persona.username,
          description: persona.description,
          role_type: persona.role_type,
        }),
      })

      if (res.ok) {
        showToast(`${persona.name} 已保存！`, 'success')
      }
    } catch (e) {
      showToast('保存失败', 'error')
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title mb-2">👤 人设矩阵</h1>
        <p className="text-[#787C7E]">基于AI生成逼真的Reddit运营人设</p>
      </div>

      {/* Project Info */}
      <div className="reddit-panel p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📋 项目信息</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">产品名称 *</label>
            <input
              type="text"
              className="reddit-input"
              placeholder="例如：开放式耳机"
              value={projectInfo.product_name}
              onChange={e => setProjectInfo({ ...projectInfo, product_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#787C7E] mb-1">产品品类</label>
            <input
              type="text"
              className="reddit-input"
              placeholder="例如：音频设备"
              value={projectInfo.category}
              onChange={e => setProjectInfo({ ...projectInfo, category: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-[#787C7E] mb-1">目标受众</label>
            <input
              type="text"
              className="reddit-input"
              placeholder="例如：运动爱好者、科技发烧友"
              value={projectInfo.target_audience}
              onChange={e => setProjectInfo({ ...projectInfo, target_audience: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div className="reddit-panel p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">🎭 预置人设模板</h2>
          <button onClick={selectRecommended} className="btn-secondary text-sm">
            使用推荐组合
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#787C7E]">加载中...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className={`p-4 border rounded cursor-pointer transition-colors ${
                  selectedTemplates.includes(template.id)
                    ? 'border-[#FF4500] bg-[#FF4500]/5'
                    : 'border-[#E5E5E5] hover:border-[#FF4500]'
                }`}
                onClick={() => toggleTemplate(template.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{template.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-[#F6F7F8] rounded">
                    {template.role_type}
                  </span>
                </div>
                <p className="text-sm text-[#787C7E] mb-3">{template.description}</p>
                <div className="text-xs text-[#787C7E]">
                  <span>发帖频率: {template.content_strategy_summary.post_frequency}</span>
                  <span className="mx-2">|</span>
                  <span>风格: {template.content_strategy_summary.primary_tone}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prototype Option */}
      <div className="reddit-panel p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="usePrototype"
            checked={usePrototype}
            onChange={e => setUsePrototype(e.target.checked)}
            className="w-4 h-4 accent-[#FF4500]"
          />
          <label htmlFor="usePrototype" className="font-semibold">
            基于标杆账号生成
          </label>
        </div>
        {usePrototype && (
          <input
            type="text"
            className="reddit-input w-full"
            placeholder="输入Reddit标杆账号URL，例如：https://reddit.com/user/ExampleUser"
            value={prototypeUrl}
            onChange={e => setPrototypeUrl(e.target.value)}
          />
        )}
      </div>

      {/* Generate Button */}
      <div className="text-center mb-8">
        <button
          onClick={generatePersonas}
          disabled={generating || !projectInfo.product_name}
          className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <span>🤖 生成中...</span>
          ) : (
            <span>🚀 AI 生成人设</span>
          )}
        </button>
      </div>

      {/* Generated Personas */}
      {generatedPersonas.length > 0 && (
        <div className="reddit-panel p-6">
          <h2 className="text-lg font-semibold mb-4">✨ 生成结果</h2>
          <div className="space-y-4">
            {generatedPersonas.map((persona, index) => (
              <div key={index} className="border border-[#E5E5E5] rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-lg">{persona.name}</div>
                    <div className="text-sm text-[#787C7E] mb-2">{persona.username}</div>
                    <p className="text-sm mb-3">{persona.description}</p>
                    <div className="flex gap-4 text-xs text-[#787C7E]">
                      <span>类型: {persona.role_type}</span>
                      <span>发帖: {persona.content_strategy_preview.post_frequency}</span>
                      <span>风格: {persona.content_strategy_preview.primary_tone}</span>
                      <span>评论: {persona.content_strategy_preview.comment_style}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => savePersona(persona)}
                    className="btn-secondary text-sm"
                    disabled={!projectId}
                  >
                    保存
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
