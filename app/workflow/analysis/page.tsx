'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

const mockCandidates = [
  { id: 1, title: 'Best open ear earbuds for running in 2024?', subreddit: 'running', upvotes: 234, comments: 67, score: 0.89, level: 'S', category: 'A', categoryName: '深度测评' },
  { id: 2, title: 'Shokz OpenFit vs Oladance OWS Pro - honest comparison', subreddit: 'headphones', upvotes: 456, comments: 123, score: 0.92, level: 'S', category: 'A', categoryName: '深度测评' },
  { id: 3, title: 'Finally found earbuds that don\'t hurt during long runs', subreddit: 'running', upvotes: 189, comments: 45, score: 0.76, level: 'A', category: 'B', categoryName: '场景痛点' },
  { id: 4, title: 'Open ear technology is getting really good', subreddit: 'audiophile', upvotes: 312, comments: 89, score: 0.85, level: 'S', category: 'E', categoryName: '平台趋势' },
  { id: 5, title: 'Bone conduction vs air conduction - which is better?', subreddit: 'earbuds', upvotes: 167, comments: 56, score: 0.71, level: 'A', category: 'C', categoryName: '观点争议' },
  { id: 6, title: 'My experience with Oladance after 6 months', subreddit: 'headphones', upvotes: 145, comments: 38, score: 0.68, level: 'A', category: 'A', categoryName: '深度测评' },
  { id: 7, title: 'Why I switched from Shokz to open ear', subreddit: 'running', upvotes: 201, comments: 72, score: 0.78, level: 'A', category: 'D', categoryName: '竞品KOL' },
  { id: 8, title: 'Open ear earbuds for cycling - safety first', subreddit: 'gadgets', upvotes: 98, comments: 29, score: 0.55, level: 'B', category: 'B', categoryName: '场景痛点' },
]

const categoryColors: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-red-100 text-red-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-purple-100 text-purple-700',
  E: 'bg-green-100 text-green-700',
}

const levelColors: Record<string, string> = {
  S: 'bg-slate-900 text-white',
  A: 'bg-blue-600 text-white',
  B: 'bg-yellow-500 text-white',
  C: 'bg-slate-300 text-slate-600',
}

export default function AnalysisPage() {
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'upvotes' | 'comments'>('score')

  const filtered = mockCandidates
    .filter(c => filter === 'all' || c.category === filter)
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'upvotes') return b.upvotes - a.upvotes
      return b.comments - a.comments
    })

  const categoryStats = {
    A: mockCandidates.filter(c => c.category === 'A').length,
    B: mockCandidates.filter(c => c.category === 'B').length,
    C: mockCandidates.filter(c => c.category === 'C').length,
    D: mockCandidates.filter(c => c.category === 'D').length,
    E: mockCandidates.filter(c => c.category === 'E').length,
  }

  const levelStats = {
    S: mockCandidates.filter(c => c.level === 'S').length,
    A: mockCandidates.filter(c => c.level === 'A').length,
    B: mockCandidates.filter(c => c.level === 'B').length,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">评分分布</h3>
          <div className="flex gap-3">
            {Object.entries(levelStats).map(([level, count]) => (
              <div key={level} className="flex-1 text-center">
                <div className={`text-3xl font-black ${level === 'S' ? 'text-slate-900' : level === 'A' ? 'text-blue-600' : 'text-yellow-500'}`}>
                  {count}
                </div>
                <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${levelColors[level]}`}>
                  {level} 级
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">分类分布</h3>
          <div className="space-y-2">
            {Object.entries(categoryStats).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${categoryColors[cat]}`}>
                  {cat} 类
                </span>
                <span className="text-sm font-black text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">总览</h3>
          <div className="text-center">
            <div className="text-4xl font-black text-slate-900">{mockCandidates.length}</div>
            <div className="text-sm text-slate-500 font-medium mt-1">候选热帖</div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-900">候选热帖列表</h2>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option value="all">全部分类</option>
              <option value="A">A 深度测评</option>
              <option value="B">B 场景痛点</option>
              <option value="C">C 观点争议</option>
              <option value="D">D 竞品KOL</option>
              <option value="E">E 平台趋势</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option value="score">按评分</option>
              <option value="upvotes">按点赞</option>
              <option value="comments">按评论</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${levelColors[post.level]}`}>
                {post.level}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">{post.title}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400">r/{post.subreddit}</span>
                  <span className="text-xs text-slate-400">👍 {post.upvotes}</span>
                  <span className="text-xs text-slate-400">💬 {post.comments}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${categoryColors[post.category]}`}>
                    {post.categoryName}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-slate-900">{(post.score * 100).toFixed(0)}</div>
                <div className="text-xs text-slate-400">综合评分</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => showToast('候选已确认，进入 P4-1 人设设计', 'success')}
        className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
      >
        确认并进入 P4-1 人设设计 →
      </button>
    </div>
  )
}
