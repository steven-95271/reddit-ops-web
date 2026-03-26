'use client'

import BaseLayout from '@/components/BaseLayout'

export default function EditorPage() {
  return (
    <BaseLayout>
      <div className="glass-card">
        <h2 className="text-xl font-black text-slate-900 mb-6">内容编辑器</h2>
        <div className="text-center py-12 text-slate-400">
          <span className="text-4xl mb-4 block">✍️</span>
          <p>暂无内容</p>
        </div>
      </div>
    </BaseLayout>
  )
}