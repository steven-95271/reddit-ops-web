'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

interface ContentItem {
  id: string
  personaName: string
  personaEmoji: string
  personaColor: string
  sourceTitle: string
  title: string
  body: string
  tags: string[]
  status: 'pending' | 'approved' | 'rejected'
  method: 'ai' | 'template'
}

const mockContent: ContentItem[] = [
  {
    id: 'c1',
    personaName: 'AudioGeek',
    personaEmoji: '🎧',
    personaColor: '#8b5cf6',
    sourceTitle: 'Shokz OpenFit vs Oladance OWS Pro',
    title: 'After 2 weeks with Oladance OWS Pro, here\'s my take vs Shokz OpenFit',
    body: 'Been testing both for two weeks now, and I have thoughts.\n\n**Sound Quality:**\nOladance wins. The dual 23×10mm drivers deliver actual bass, not that tinny bone conduction sound.\n\n**Comfort:**\nBoth solid, but Shokz feels more "secured" during runs. Oladance has better weight distribution for all-day wear.\n\n**Battery:**\nOladance: 16h (real world). Shokz: 8h.\n\n**Verdict:**\nIf you prioritize sound quality above everything, Oladance. If you do hardcore trail runs, Shokz.',
    tags: ['review', 'openEar', 'comparison'],
    status: 'pending',
    method: 'ai',
  },
  {
    id: 'c2',
    personaName: 'SportyRunner',
    personaEmoji: '🏃',
    personaColor: '#22c55e',
    sourceTitle: 'Best open ear earbuds for running in 2024?',
    title: 'My go-to earbuds for marathon training - open ear changed everything',
    body: 'I\'ve been running with open ear earbuds for 3 months now and here\'s what I\'ve learned.\n\n**Safety first:** I can hear traffic, other runners, and my surroundings. Game changer for trail runs.\n\n**Sound quality:** Not audiophile level, but good enough for motivation music.\n\n**Sweat resistance:** Both Shokz and Oladance held up through 500+ km of sweaty runs.\n\n**My recommendation:** If you run outdoors, open ear is the way to go.',
    tags: ['running', 'experience', 'gear'],
    status: 'pending',
    method: 'ai',
  },
  {
    id: 'c3',
    personaName: 'CommuterLife',
    personaEmoji: '🚇',
    personaColor: '#3b82f6',
    sourceTitle: 'Open ear technology is getting really good',
    title: 'Finally found earbuds I can wear all day at the office',
    body: 'As someone who commutes 1.5 hours daily and works in an open office, I need earbuds that:\n\n1. Don\'t isolate me completely\n2. Are comfortable for 8+ hours\n3. Let me hear when someone talks to me\n\nOpen ear earbuds check all three boxes. Here\'s my experience after 2 months of daily use.',
    tags: ['commuting', 'office', 'daily-use'],
    status: 'pending',
    method: 'ai',
  },
]

export default function ContentPage() {
  const [contents, setContents] = useState<ContentItem[]>(mockContent)
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 3000))
    setIsGenerating(false)
    showToast('已生成 6 条内容（3人设 × 2条）', 'success')
  }

  const handleApprove = (id: string) => {
    setContents(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' as const } : c))
    showToast('内容已通过', 'success')
  }

  const handleReject = (id: string) => {
    setContents(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c))
    showToast('内容已拒绝', 'info')
  }

  const statusCounts = {
    pending: contents.filter(c => c.status === 'pending').length,
    approved: contents.filter(c => c.status === 'approved').length,
    rejected: contents.filter(c => c.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">内容创作</h2>
          <p className="text-sm text-slate-500 mt-1">
            {contents.length} 条内容 · {statusCounts.pending} 待审核 · {statusCounts.approved} 已通过
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {isGenerating ? '生成中...' : 'AI 批量生成'}
        </button>
      </div>

      {isGenerating && (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <p className="text-lg font-bold text-slate-700">AI 正在创作内容...</p>
          <p className="text-sm text-slate-400 mt-2">扮演不同人设，基于候选热帖生成原创内容</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {contents.map(content => (
          <div key={content.id} className={`glass-card transition-all ${
            content.status === 'approved' ? 'border-l-4 border-l-green-500' :
            content.status === 'rejected' ? 'border-l-4 border-l-red-500 opacity-60' : ''
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{content.personaEmoji}</span>
                <span className="text-sm font-bold text-slate-800">{content.personaName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  content.method === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {content.method === 'ai' ? 'AI' : '模板'}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                content.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                content.status === 'approved' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>
                {content.status === 'pending' ? '待审核' : content.status === 'approved' ? '已通过' : '已拒绝'}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-2">{content.title}</h3>
            <p className="text-xs text-slate-500 mb-3 line-clamp-3 whitespace-pre-line">{content.body}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {content.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-medium text-slate-500">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <span>来源: {content.sourceTitle}</span>
            </div>

            {content.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedContent(content)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  查看/编辑
                </button>
                <button
                  onClick={() => handleReject(content.id)}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50"
                >
                  拒绝
                </button>
                <button
                  onClick={() => handleApprove(content.id)}
                  className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  通过
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setSelectedContent(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{selectedContent.personaEmoji}</span>
              <h3 className="text-lg font-black text-slate-900">{selectedContent.personaName}</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">标题</label>
                <input
                  type="text"
                  defaultValue={selectedContent.title}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">正文</label>
                <textarea
                  defaultValue={selectedContent.body}
                  rows={10}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelectedContent(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                关闭
              </button>
              <button
                onClick={() => {
                  setSelectedContent(null)
                  showToast('内容已保存', 'success')
                }}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => showToast('内容已确认，进入 P5 发布', 'success')}
        className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
      >
        确认并进入 P5 发布 →
      </button>
    </div>
  )
}
