'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

export default function ScrapingPage() {
  const [status, setStatus] = useState<'idle' | 'preview' | 'running' | 'completed'>('idle')
  const [mode, setMode] = useState<'mock' | 'real'>('mock')
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ total: 0, bySubreddit: {} as Record<string, number> })

  const previewData = {
    searchQueries: ['open ear earbuds', 'bone con headphones', 'open ear running'],
    subreddits: ['r/headphones', 'r/earbuds', 'r/audiophile'],
    estimatedPosts: '87 条',
    timeRange: '最近 7 天',
  }

  const mockResults = {
    totalPosts: 87,
    bySubreddit: { headphones: 32, earbuds: 28, audiophile: 18, running: 9 },
    topPosts: [
      { id: 1, title: 'Best open ear earbuds for running in 2024?', subreddit: 'running', upvotes: 234, comments: 67, score: 0.89 },
      { id: 2, title: 'Shokz OpenFit vs Oladance OWS Pro - honest comparison', subreddit: 'headphones', upvotes: 456, comments: 123, score: 0.92 },
      { id: 3, title: 'Finally found earbuds that don\'t hurt during long runs', subreddit: 'running', upvotes: 189, comments: 45, score: 0.76 },
      { id: 4, title: 'Open ear technology is getting really good', subreddit: 'audiophile', upvotes: 312, comments: 89, score: 0.85 },
      { id: 5, title: 'Bone conduction vs air conduction - which is better?', subreddit: 'earbuds', upvotes: 167, comments: 56, score: 0.71 },
    ],
  }

  const handleStart = async () => {
    setStatus('preview')
  }

  const handleConfirm = async () => {
    setStatus('running')
    setProgress(0)

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setStatus('completed')
          setStats({
            total: mockResults.totalPosts,
            bySubreddit: mockResults.bySubreddit,
          })
          showToast(`抓取完成！共获取 ${mockResults.totalPosts} 条帖子`, 'success')
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  return (
    <div className="space-y-6">
      {status === 'idle' && (
        <div className="glass-card">
          <h2 className="text-xl font-black text-slate-900 mb-6">抓取配置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">抓取模式</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setMode('mock')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    mode === 'mock'
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-lg font-bold text-slate-900">🧪 Mock 模式</div>
                  <div className="text-xs text-slate-500 mt-1">使用预置数据，快速测试流程</div>
                </button>
                <button
                  onClick={() => setMode('real')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    mode === 'real'
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-lg font-bold text-slate-900">🌐 真实抓取</div>
                  <div className="text-xs text-slate-500 mt-1">通过 APIFY 抓取真实 Reddit 数据</div>
                </button>
              </div>
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              查看抓取预览 →
            </button>
          </div>
        </div>
      )}

      {status === 'preview' && (
        <div className="space-y-6">
          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">抓取预览</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">搜索词</div>
                {previewData.searchQueries.map((q, i) => (
                  <div key={i} className="text-sm text-slate-700 py-1">• {q}</div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">目标板块</div>
                {previewData.subreddits.map((s, i) => (
                  <div key={i} className="text-sm text-slate-700 py-1">• {s}</div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">预估数量</div>
                <div className="text-2xl font-black text-slate-900">{previewData.estimatedPosts}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">时间范围</div>
                <div className="text-2xl font-black text-slate-900">{previewData.timeRange}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStatus('idle')}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              返回
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              开始抓取 {mode === 'mock' ? '(Mock)' : '(真实)'} →
            </button>
          </div>
        </div>
      )}

      {status === 'running' && (
        <div className="glass-card flex flex-col items-center justify-center py-20">
          <div className="w-full max-w-md">
            <div className="flex justify-between text-sm font-semibold text-slate-600 mb-2">
              <span>正在抓取...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-400 mt-4 text-center">
              {progress < 30 ? '正在连接 APIFY...' : progress < 60 ? '正在抓取帖子...' : progress < 90 ? '正在解析数据...' : '即将完成...'}
            </p>
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="space-y-6">
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900">抓取结果</h2>
              <span className="badge bg-green-100 text-green-700">✅ 完成</span>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-slate-900">{stats.total}</div>
                <div className="text-xs text-slate-500 font-medium mt-1">总帖子数</div>
              </div>
              {Object.entries(stats.bySubreddit).map(([sub, count]) => (
                <div key={sub} className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-slate-900">{count}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">r/{sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h2 className="text-xl font-black text-slate-900 mb-4">Top 帖子预览</h2>
            <div className="space-y-3">
              {mockResults.topPosts.map((post) => (
                <div key={post.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-800">{post.title}</div>
                    <div className="text-xs text-slate-400 mt-1">r/{post.subreddit} · 👍 {post.upvotes} · 💬 {post.comments}</div>
                  </div>
                  <div className={`ml-4 px-3 py-1 rounded-full text-xs font-bold ${
                    post.score >= 0.8 ? 'bg-green-100 text-green-700' :
                    post.score >= 0.6 ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {(post.score * 100).toFixed(0)}分
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => showToast('数据已确认，进入 P3 分析', 'success')}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
          >
            确认并进入 P3 分析 →
          </button>
        </div>
      )}
    </div>
  )
}
