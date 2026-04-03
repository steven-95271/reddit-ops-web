'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

interface Persona {
  id: string
  name: string
  username: string
  emoji: string
  color: string
  background: string
  tone: string
  writingStyle: string
  focus: string[]
  subreddits: string[]
  isCustom: boolean
}

const defaultPersonas: Persona[] = [
  {
    id: 'persona_1',
    name: 'SportyRunner',
    username: 'u/sporty_runner_mike',
    emoji: '🏃',
    color: '#22c55e',
    background: '热爱跑步和户外运动，马拉松爱好者，每周跑量50km+，关注运动耳机和装备评测',
    tone: '活泼/第一人称',
    writingStyle: '分享个人运动体验，语气活泼，喜欢用清单和干货内容',
    focus: ['running', 'workout', 'sports', 'fitness', 'marathon'],
    subreddits: ['r/running', 'r/Fitness', 'r/runningshoes'],
    isCustom: false,
  },
  {
    id: 'persona_2',
    name: 'AudioGeek',
    username: 'u/audio_beats_mike',
    emoji: '🎧',
    color: '#8b5cf6',
    background: '音频发烧友，对音质有追求，熟悉各类音频设备参数，喜欢对比评测',
    tone: '专业/分析型',
    writingStyle: '技术分析风格，擅长参数对比，测评深入',
    focus: ['audiophile', 'headphones', 'earbuds', 'sound_quality', 'audio_tech'],
    subreddits: ['r/audiophile', 'r/headphones', 'r/earbuds'],
    isCustom: false,
  },
  {
    id: 'persona_3',
    name: 'CommuterLife',
    username: 'u/commuter_daily',
    emoji: '🚇',
    color: '#3b82f6',
    background: '朝九晚五的上班族，每天通勤1-2小时，注重实用性和性价比',
    tone: '务实/生活化',
    writingStyle: '分享通勤日常，推荐实用好物，贴近普通人生活',
    focus: ['commuting', 'work', 'daily_life', 'productivity', 'budget'],
    subreddits: ['r/commuting', 'r/gadgets', 'r/BudgetAudiophile'],
    isCustom: false,
  },
]

export default function PersonaPage() {
  const [personas, setPersonas] = useState<Persona[]>(defaultPersonas)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({
    name: '',
    username: '',
    emoji: '👤',
    color: '#6366f1',
    background: '',
    tone: '',
    writingStyle: '',
    focus: [],
    subreddits: [],
    isCustom: true,
  })
  const [focusInput, setFocusInput] = useState('')
  const [subredditInput, setSubredditInput] = useState('')

  const handleSaveEdit = (updated: Persona) => {
    setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p))
    setEditingPersona(null)
    showToast('人设已更新', 'success')
  }

  const handleCreatePersona = () => {
    if (!newPersona.name || !newPersona.background) {
      showToast('请填写名称和背景', 'error')
      return
    }
    const persona: Persona = {
      id: `persona_${Date.now()}`,
      name: newPersona.name || '',
      username: newPersona.username || `u/${(newPersona.name || '').toLowerCase().replace(/\s/g, '_')}`,
      emoji: newPersona.emoji || '👤',
      color: newPersona.color || '#6366f1',
      background: newPersona.background || '',
      tone: newPersona.tone || '',
      writingStyle: newPersona.writingStyle || '',
      focus: newPersona.focus || [],
      subreddits: newPersona.subreddits || [],
      isCustom: true,
    }
    setPersonas(prev => [...prev, persona])
    setShowNewForm(false)
    setNewPersona({ name: '', username: '', emoji: '👤', color: '#6366f1', background: '', tone: '', writingStyle: '', focus: [], subreddits: [], isCustom: true })
    setFocusInput('')
    setSubredditInput('')
    showToast('新人设已创建', 'success')
  }

  const addFocus = () => {
    if (focusInput.trim()) {
      setNewPersona(prev => ({ ...prev, focus: [...(prev.focus || []), focusInput.trim()] }))
      setFocusInput('')
    }
  }

  const addSubreddit = () => {
    if (subredditInput.trim()) {
      const sub = subredditInput.trim().replace('r/', '')
      setNewPersona(prev => ({ ...prev, subreddits: [...(prev.subreddits || []), `r/${sub}`] }))
      setSubredditInput('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">人设库</h2>
          <p className="text-sm text-slate-500 mt-1">{personas.length} 个人设 · {personas.filter(p => p.isCustom).length} 个自定义</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          + 新建人设
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map(persona => (
          <div key={persona.id} className="glass-card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: persona.color + '20' }}>
                  {persona.emoji}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{persona.name}</div>
                  <div className="text-xs text-slate-400">{persona.username}</div>
                </div>
              </div>
              <button
                onClick={() => setEditingPersona(persona)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                编辑
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 line-clamp-2">{persona.background}</p>

            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">语气</div>
                <div className="text-xs text-slate-700">{persona.tone}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">写作风格</div>
                <div className="text-xs text-slate-700 line-clamp-2">{persona.writingStyle}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">关注领域</div>
                <div className="flex flex-wrap gap-1">
                  {persona.focus.slice(0, 3).map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-medium text-slate-600">
                      {f}
                    </span>
                  ))}
                  {persona.focus.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-medium text-slate-400">
                      +{persona.focus.length - 3}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">目标板块</div>
                <div className="flex flex-wrap gap-1">
                  {persona.subreddits.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-medium text-slate-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingPersona && (
        <EditPersonaModal
          persona={editingPersona}
          onSave={handleSaveEdit}
          onClose={() => setEditingPersona(null)}
        />
      )}

      {showNewForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowNewForm(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-6">新建人设</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">名称</label>
                  <input
                    type="text"
                    value={newPersona.name || ''}
                    onChange={e => setNewPersona(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="TechRunner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">用户名</label>
                  <input
                    type="text"
                    value={newPersona.username || ''}
                    onChange={e => setNewPersona(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="u/tech_runner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={newPersona.emoji || ''}
                    onChange={e => setNewPersona(prev => ({ ...prev, emoji: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="🏃"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">背景故事</label>
                <textarea
                  value={newPersona.background || ''}
                  onChange={e => setNewPersona(prev => ({ ...prev, background: e.target.value }))}
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
                    value={newPersona.tone || ''}
                    onChange={e => setNewPersona(prev => ({ ...prev, tone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="专业/分析型"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">写作风格</label>
                  <input
                    type="text"
                    value={newPersona.writingStyle || ''}
                    onChange={e => setNewPersona(prev => ({ ...prev, writingStyle: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="技术分析，参数对比"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">关注领域</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={focusInput}
                    onChange={e => setFocusInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFocus())}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="输入后回车添加"
                  />
                  <button onClick={addFocus} className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200">+</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(newPersona.focus || []).map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">目标板块</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subredditInput}
                    onChange={e => setSubredditInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubreddit())}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="输入板块名后回车"
                  />
                  <button onClick={addSubreddit} className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200">+</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(newPersona.subreddits || []).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewForm(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleCreatePersona} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => showToast('人设已确认，进入 P4-2 内容创作', 'success')}
        className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
      >
        确认并进入 P4-2 内容创作 →
      </button>
    </div>
  )
}

function EditPersonaModal({ persona, onSave, onClose }: { persona: Persona; onSave: (p: Persona) => void; onClose: () => void }) {
  const [edited, setEdited] = useState<Persona>({ ...persona })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900 mb-6">编辑人设</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">名称</label>
            <input
              type="text"
              value={edited.name}
              onChange={e => setEdited({ ...edited, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">背景故事</label>
            <textarea
              value={edited.background}
              onChange={e => setEdited({ ...edited, background: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">语气</label>
              <input
                type="text"
                value={edited.tone}
                onChange={e => setEdited({ ...edited, tone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">写作风格</label>
              <input
                type="text"
                value={edited.writingStyle}
                onChange={e => setEdited({ ...edited, writingStyle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
            取消
          </button>
          <button onClick={() => onSave(edited)} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
