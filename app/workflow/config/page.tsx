'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

const defaultKeywords = {
  core: ['open ear earbuds', 'bone conduction', 'wireless earbuds'],
  longTail: ['best open ear earbuds 2024', 'open ear vs in ear', 'open ear earbuds for running'],
  competitor: ['Shokz', 'Bose', 'soundcore'],
  scenario: ['running', 'cycling', 'office work', 'commuting'],
}

const defaultSubreddits = [
  { name: 'headphones', reason: '耳机讨论主社区', relevance: 'high' },
  { name: 'earbuds', reason: '耳塞专门讨论区', relevance: 'high' },
  { name: 'audiophile', reason: '音质发烧友', relevance: 'high' },
  { name: 'running', reason: '运动场景', relevance: 'medium' },
  { name: 'gadgets', reason: '数码产品讨论', relevance: 'medium' },
]

export default function ConfigPage() {
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input')
  const [formData, setFormData] = useState({
    projectBackground: '',
    targetAudience: '',
    seedKeywords: '',
    brandNames: '',
    competitorBrands: '',
  })
  const [generatedData, setGeneratedData] = useState<any>(null)

  const handleGenerate = async () => {
    if (!formData.projectBackground || !formData.seedKeywords) {
      showToast('请填写项目背景和种子关键词', 'error')
      return
    }

    setStep('generating')

    // Mock: simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 2000))

    setGeneratedData({
      keywords: defaultKeywords,
      subreddits: defaultSubreddits,
      searchStrategy: {
        queries: ['open ear earbuds', 'bone con headphones', 'open ear running'],
        subreddits: ['headphones', 'earbuds', 'audiophile'],
        timeFilter: 'week',
        postLimit: 100,
      },
    })
    setStep('result')
    showToast('配置生成成功', 'success')
  }

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <div className="glass-card">
          <h2 className="text-xl font-black text-slate-900 mb-6">项目信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">项目背景</label>
              <textarea
                value={formData.projectBackground}
                onChange={e => setFormData({ ...formData, projectBackground: e.target.value })}
                rows={3}
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
                placeholder="描述你的产品和目标市场..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">目标人群</label>
              <input
                type="text"
                value={formData.targetAudience}
                onChange={e => setFormData({ ...formData, targetAudience: e.target.value })}
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
                placeholder="例如：25-40岁运动爱好者"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">种子关键词</label>
              <input
                type="text"
                value={formData.seedKeywords}
                onChange={e => setFormData({ ...formData, seedKeywords: e.target.value })}
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
                placeholder="用逗号分隔，例如：open ear, bone conduction"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">品牌名称</label>
                <input
                  type="text"
                  value={formData.brandNames}
                  onChange={e => setFormData({ ...formData, brandNames: e.target.value })}
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
                  placeholder="例如：Oladance"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">竞品品牌</label>
                <input
                  type="text"
                  value={formData.competitorBrands}
                  onChange={e => setFormData({ ...formData, competitorBrands: e.target.value })}
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
                  placeholder="例如：Shokz, Bose"
                />
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              AI 生成配置 →
            </button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="glass-card flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <p className="text-lg font-bold text-slate-700">AI 正在生成配置...</p>
          <p className="text-sm text-slate-400 mt-2">扩展关键词、推荐 Subreddits、生成搜索策略</p>
        </div>
      )}

      {step === 'result' && generatedData && (
        <div className="space-y-6">
          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">关键词策略</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(generatedData.keywords).map(([key, words]: [string, any]) => (
                <div key={key} className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">{key}</div>
                  <div className="flex flex-wrap gap-2">
                    {words.map((w: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-700 border border-slate-200">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">推荐 Subreddits</h2>
            <div className="space-y-2">
              {generatedData.subreddits.map((sub: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${sub.relevance === 'high' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm font-bold text-slate-800">r/{sub.name}</span>
                    <span className="text-xs text-slate-400">{sub.reason}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    sub.relevance === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {sub.relevance === 'high' ? '高相关' : '中相关'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">搜索策略</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">搜索词</div>
                <div className="space-y-1">
                  {generatedData.searchStrategy.queries.map((q: string, i: number) => (
                    <div key={i} className="text-sm text-slate-700">• {q}</div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">时间范围</div>
                <div className="text-lg font-black text-slate-900">最近 7 天</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">数量限制</div>
                <div className="text-lg font-black text-slate-900">{generatedData.searchStrategy.postLimit} 条</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('input')}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              重新生成
            </button>
            <button
              onClick={() => showToast('配置已确认，进入 P2 抓取', 'success')}
              className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              确认并进入 P2 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
