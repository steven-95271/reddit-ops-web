'use client'

import { usePathname } from 'next/navigation'
import BaseLayout from '@/components/BaseLayout'

const steps = [
  { key: 'config', label: 'P1 配置', href: '/workflow/config' },
  { key: 'scraping', label: 'P2 抓取', href: '/workflow/scraping' },
  { key: 'analysis', label: 'P3 分析', href: '/workflow/analysis' },
  { key: 'persona', label: 'P4-1 人设', href: '/workflow/persona' },
  { key: 'content', label: 'P4-2 创作', href: '/workflow/content' },
  { key: 'publish', label: 'P5 发布', href: '/workflow/publish' },
]

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  config: { title: '项目配置', subtitle: '生成关键词和搜索策略' },
  scraping: { title: '内容抓取', subtitle: '从 Reddit 抓取目标帖子' },
  analysis: { title: '热帖分析', subtitle: '评分、分类、筛选候选' },
  persona: { title: '人设设计', subtitle: '创建和管理账号人设' },
  content: { title: '内容创作', subtitle: 'AI 生成互动内容' },
  publish: { title: '发布追踪', subtitle: '审核、发布、品牌追踪' },
}

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentStep = steps.find(s => pathname.startsWith(s.href))
  const currentIndex = currentStep ? steps.indexOf(currentStep) : 0
  const pageInfo = currentStep ? pageTitles[currentStep.key] : { title: '', subtitle: '' }

  return (
    <BaseLayout title={pageInfo.title} subtitle={pageInfo.subtitle}>
      <div className="mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex
            const isCurrent = index === currentIndex
            const isUpcoming = index > currentIndex

            return (
              <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={step.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? 'bg-slate-900 text-white shadow-md'
                      : isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                    {isCompleted ? '✓' : index + 1}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </a>
                {index < steps.length - 1 && (
                  <div className={`w-6 h-0.5 flex-shrink-0 ${
                    isCompleted ? 'bg-green-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {children}
    </BaseLayout>
  )
}
