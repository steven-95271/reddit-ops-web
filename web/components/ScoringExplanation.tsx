'use client'

export default function ScoringExplanation() {
  const categories = [
    {
      code: 'A',
      name: '深度测评',
      color: '#ff7e67',
      description: '用户分享详细的产品使用体验、优缺点分析',
      example: '"I have been using this for 3 months and here is my detailed review..."',
      weight: 25,
    },
    {
      code: 'B',
      name: '场景痛点',
      color: '#4fd1c5',
      description: '描述具体使用场景中的问题或需求',
      example: '"As someone who runs marathons, I need earbuds that stay in place..."',
      weight: 25,
    },
    {
      code: 'C',
      name: '观点争议',
      color: '#f59e0b',
      description: '引发讨论的观点或对比类内容',
      example: '"Is this really worth $200? Here is my honest comparison with..."',
      weight: 20,
    },
    {
      code: 'D',
      name: '竞品KOL',
      color: '#8b5cf6',
      description: '来自高影响力用户的推荐或评测',
      example: '"The tech reviewer with 50k followers just posted about this..."',
      weight: 15,
    },
    {
      code: 'E',
      name: '平台趋势',
      color: '#10b981',
      description: '符合当前热门话题趋势的内容',
      example: '"This just hit the front page - here is why everyone is talking about it..."',
      weight: 15,
    },
  ]

  return (
    <div className="reddit-panel p-6">
      <h2 className="text-lg font-bold text-dark-text mb-4">📊 评分机制说明</h2>
      
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.code} className="border border-dark-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: cat.color }}
              >
                {cat.code}
              </span>
              <span className="font-semibold text-dark-text">{cat.name}</span>
              <span className="text-xs text-dark-muted ml-auto">权重 {cat.weight}%</span>
            </div>
            <p className="text-sm text-dark-muted mb-2">{cat.description}</p>
            <p className="text-xs text-dark-muted italic">例: {cat.example}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-dark-hover rounded-lg">
        <h3 className="font-semibold text-dark-text mb-2">计算公式</h3>
        <p className="text-sm text-dark-muted">
          综合评分 = Σ(类别得分 × 权重) + 热度分 + 互动分
        </p>
        <ul className="text-sm text-dark-muted mt-2 space-y-1">
          <li>• 热度分: log( upvotes + 1 ) × 0.3</li>
          <li>• 互动分: log( comments + 1 ) × 0.2</li>
          <li>• 原创分: 有正文内容 +0.2</li>
        </ul>
      </div>
    </div>
  )
}
