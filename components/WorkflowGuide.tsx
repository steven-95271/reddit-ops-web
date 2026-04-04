'use client'

import { useState } from 'react'

interface Step {
  title: string
  description: string
}

interface WorkflowGuideProps {
  title: string
  description: string
  steps: Step[]
}

export default function WorkflowGuide({ title, description, steps }: WorkflowGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 overflow-hidden">
      {/* 收起状态 - 摘要行 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 truncate max-w-2xl">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-blue-600">
          <span className="text-sm font-medium">
            {isExpanded ? '收起' : '了解此步骤'}
          </span>
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 展开状态 - 详细步骤 */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-blue-100">
          <div className="pt-4">
            <p className="text-slate-700 mb-4">{description}</p>
            
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{step.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="absolute left-10 mt-8 w-0.5 h-6 bg-blue-200"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
