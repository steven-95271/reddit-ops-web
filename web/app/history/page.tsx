'use client'

import BaseLayout from '@/components/BaseLayout'

export default function HistoryPage() {
  return (
    <BaseLayout>
      <div className="reddit-panel p-6">
        <h2 className="text-lg font-bold text-dark-text mb-6">发布记录</h2>
        <div className="text-center py-12 text-dark-muted">
          <span className="text-4xl mb-4 block">📋</span>
          <p>暂无历史记录</p>
        </div>
      </div>
    </BaseLayout>
  )
}