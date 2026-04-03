'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

interface PublishItem {
  id: string
  personaName: string
  personaEmoji: string
  title: string
  status: 'pending' | 'approved' | 'rejected' | 'published'
  platform: string
  publishedAt?: string
}

const mockPublishItems: PublishItem[] = [
  { id: 'p1', personaName: 'AudioGeek', personaEmoji: '🎧', title: 'After 2 weeks with Oladance OWS Pro...', status: 'approved', platform: 'Reddit' },
  { id: 'p2', personaName: 'SportyRunner', personaEmoji: '🏃', title: 'My go-to earbuds for marathon training...', status: 'approved', platform: 'Reddit' },
  { id: 'p3', personaName: 'CommuterLife', personaEmoji: '🚇', title: 'Finally found earbuds I can wear all day...', status: 'pending', platform: 'Reddit' },
]

const mockBrandMentions = [
  { brand: 'Oladance', post: 'Just tried OWS Pro, surprisingly good', subreddit: 'headphones', sentiment: 'positive', date: '2024-03-01' },
  { brand: 'Shokz', post: 'Shokz OpenFit review after 6 months', subreddit: 'running', sentiment: 'positive', date: '2024-02-28' },
  { brand: 'Oladance', post: 'OWS Pro vs OpenFit comparison', subreddit: 'earbuds', sentiment: 'neutral', date: '2024-02-27' },
]

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  negative: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-green-100 text-green-700',
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '待发布',
  rejected: '已拒绝',
  published: '已发布',
}

export default function PublishPage() {
  const [activeTab, setActiveTab] = useState<'review' | 'publish' | 'tracking'>('review')
  const [items, setItems] = useState<PublishItem[]>(mockPublishItems)

  const handlePublish = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'published' as const, publishedAt: new Date().toISOString() } : item))
    showToast('内容已发布', 'success')
  }

  const stats = {
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    published: items.filter(i => i.status === 'published').length,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card text-center">
          <div className="text-3xl font-black text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-slate-500 font-medium mt-1">待审核</div>
        </div>
        <div className="glass-card text-center">
          <div className="text-3xl font-black text-blue-600">{stats.approved}</div>
          <div className="text-sm text-slate-500 font-medium mt-1">待发布</div>
        </div>
        <div className="glass-card text-center">
          <div className="text-3xl font-black text-green-600">{stats.published}</div>
          <div className="text-sm text-slate-500 font-medium mt-1">已发布</div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'review' as const, label: '审核' },
          { key: 'publish' as const, label: '发布' },
          { key: 'tracking' as const, label: '品牌追踪' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'review' && (
        <div className="glass-card">
          <h2 className="text-xl font-black text-slate-900 mb-4">内容审核</h2>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg">{item.personaEmoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.personaName} · {item.platform}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[item.status]}`}>
                    {statusLabels[item.status]}
                  </span>
                  {item.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'rejected' as const } : i))
                          showToast('已拒绝', 'info')
                        }}
                        className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50"
                      >
                        拒绝
                      </button>
                      <button
                        onClick={() => {
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'approved' as const } : i))
                          showToast('已通过', 'success')
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                      >
                        通过
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'publish' && (
        <div className="glass-card">
          <h2 className="text-xl font-black text-slate-900 mb-4">发布队列</h2>
          {items.filter(i => i.status === 'approved').length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-4xl mb-4 block">📤</span>
              <p>暂无待发布内容，请先通过审核</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.filter(i => i.status === 'approved').map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.personaEmoji}</span>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{item.title}</div>
                      <div className="text-xs text-slate-400">{item.personaName} · {item.platform}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePublish(item.id)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    发布
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="space-y-6">
          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">品牌提及</h2>
            <div className="space-y-3">
              {mockBrandMentions.map((mention, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{mention.post}</div>
                    <div className="text-xs text-slate-400 mt-1">r/{mention.subreddit} · {mention.date}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs font-bold text-slate-600">{mention.brand}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sentimentColors[mention.sentiment]}`}>
                      {mention.sentiment === 'positive' ? '正面' : mention.sentiment === 'negative' ? '负面' : '中性'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">情感分析</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-green-600">2</div>
                <div className="text-xs text-green-600 font-medium mt-1">正面</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-slate-600">1</div>
                <div className="text-xs text-slate-500 font-medium mt-1">中性</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-red-600">0</div>
                <div className="text-xs text-red-500 font-medium mt-1">负面</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
