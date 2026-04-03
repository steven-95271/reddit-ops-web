'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const workflowSteps = [
  { step: 'P1', label: '配置', desc: 'AI 生成关键词和搜索策略' },
  { step: 'P2', label: '抓取', desc: '从 Reddit 抓取目标帖子' },
  { step: 'P3', label: '分析', desc: '评分、分类、筛选候选热帖' },
  { step: 'P4-1', label: '人设', desc: '创建账号人设' },
  { step: 'P4-2', label: '创作', desc: 'AI 生成互动内容' },
  { step: 'P5', label: '发布', desc: '审核、发布、品牌追踪' },
]

export default function Home() {
  const router = useRouter()
  const [showWelcome, setShowWelcome] = useState(true)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('reddit-ops-welcomed')
    if (hasSeenWelcome) {
      router.replace('/workflow/config')
    }
  }, [router])

  const handleEnter = () => {
    if (dontShowAgain) {
      localStorage.setItem('reddit-ops-welcomed', 'true')
    }
    router.push('/workflow/config')
  }

  const handleSkip = () => {
    router.push('/workflow/config')
  }

  if (!showWelcome) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
      <div className="max-w-2xl w-full mx-4">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 md:p-12">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-2xl shadow-lg">🚀</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">Reddit Ops</h1>
                <p className="text-sm text-slate-500">内容运营自动化系统</p>
              </div>
            </div>

            <p className="text-lg text-slate-600 text-center mb-8">
              这是一个 Reddit 内容运营工具，帮你<span className="text-slate-900 font-bold">自动抓取热帖</span>、<span className="text-slate-900 font-bold">分析趋势</span>、<span className="text-slate-900 font-bold">生成原创内容</span>，最终实现品牌传播和流量获取。
            </p>

            <div className="mb-8">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">工作流程</h2>
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                {workflowSteps.map((s, i) => (
                  <div key={s.step} className="flex-shrink-0 flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-black">
                        {s.step}
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-2">{s.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 text-center max-w-[60px]">{s.desc}</div>
                    </div>
                    {i < workflowSteps.length - 1 && (
                      <div className="w-4 h-0.5 bg-slate-200 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <input
                type="checkbox"
                id="dontShow"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <label htmlFor="dontShow" className="text-sm text-slate-500">下次不再显示</label>
            </div>

            <button
              onClick={handleEnter}
              className="w-full py-4 bg-slate-900 text-white rounded-xl text-lg font-bold hover:bg-slate-800 transition-colors"
            >
              开始使用 →
            </button>

            <button
              onClick={handleSkip}
              className="w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              跳过介绍
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
