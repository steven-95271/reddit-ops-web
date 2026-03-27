'use client'

import BaseLayout from '@/components/BaseLayout'

export default function EditorPage() {
  return (
    <BaseLayout>
      <div className="reddit-panel p-6">
        <h2 className="text-lg font-bold text-[#1A1A1B] mb-6">内容编辑器</h2>
        <div className="text-center py-12 text-[#787C7E]">
          <span className="text-4xl mb-4 block">✍️</span>
          <p>暂无内容</p>
        </div>
      </div>
    </BaseLayout>
  )
}