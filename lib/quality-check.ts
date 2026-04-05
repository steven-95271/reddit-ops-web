/**
 * 内容质量评分引擎
 * 检测 AI 生成内容的质量问题并给出评分
 */

interface QualityResult {
  score: number
  issues: string[]
}

// AI 高频禁词表
const AI_BANNED_WORDS = [
  'delve', 'leverage', 'utilize', 'facilitate', 'streamline',
  'foster', 'harness', 'moreover', 'furthermore', 'additionally',
  'consequently', 'comprehensive', 'robust', 'seamless',
  'cutting-edge', 'game-changer',
]

const AI_BANNED_PHRASES = [
  "it's worth noting", "it's important to note", 'in conclusion',
  'it is worth noting', 'it is important to note',
]

// Reddit 特有表达
const REDDIT_EXPRESSIONS = [
  'tbh', 'imo', 'ngl', 'fwiw', 'lol', 'nah',
  'edit:', 'btw', 'not sponsored', 'take this with a grain of salt',
  'ymmv', 'ianal', 'fwiw', 'haha', 'honestly', 'literally',
]

// AI 典型开头
const AI_TYPICAL_STARTS = [
  'i think', 'in my opinion', 'i believe', 'it is',
  'i would say', 'i feel like', 'from my perspective',
]

/**
 * 检查内容质量
 * @param text 生成的内容文本
 * @param brandNames 品牌名列表
 * @returns { score: 0-100, issues: 具体问题列表 }
 */
export function checkContentQuality(text: string, brandNames: string[] = []): QualityResult {
  let score = 100
  const issues: string[] = []

  if (!text || text.trim().length === 0) {
    return { score: 0, issues: ['内容为空'] }
  }

  const lowerText = text.toLowerCase()
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

  // 1. AI 高频词检测（每个扣 5 分）
  let bannedWordCount = 0
  for (const word of AI_BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    const matches = text.match(regex)
    if (matches) {
      bannedWordCount += matches.length
    }
  }
  for (const phrase of AI_BANNED_PHRASES) {
    if (lowerText.includes(phrase)) {
      bannedWordCount++
    }
  }
  if (bannedWordCount > 0) {
    const deduction = bannedWordCount * 5
    score -= deduction
    issues.push(`检测到 ${bannedWordCount} 个 AI 高频词（-${deduction}分）`)
  }

  // 2. 句式多样性：统计各句词数的标准差
  if (sentences.length > 1) {
    const wordCounts = sentences.map(s => s.trim().split(/\s+/).length)
    const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    const variance = wordCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / wordCounts.length
    const stdDev = Math.sqrt(variance)

    if (stdDev < 3) {
      score -= 10
      issues.push('句式过于单一，缺乏长短句变化（-10分）')
    }
  }

  // 3. 品牌提及次数（超过 2 次扣 15 分）
  let brandMentionCount = 0
  for (const brand of brandNames) {
    if (brand && brand.trim()) {
      const regex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        brandMentionCount += matches.length
      }
    }
  }
  if (brandMentionCount > 2) {
    score -= 15
    issues.push(`品牌提及 ${brandMentionCount} 次，超过建议的 2 次（-15分）`)
  }

  // 4. 内容长度（词数 < 50 或 > 500 扣 10 分）
  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < 50) {
    score -= 10
    issues.push(`内容过短（${wordCount} 词），建议 50-500 词（-10分）`)
  } else if (wordCount > 500) {
    score -= 10
    issues.push(`内容过长（${wordCount} 词），建议 50-500 词（-10分）`)
  }

  // 5. Reddit 调性：检查是否包含 Reddit 特有表达
  const hasRedditExpression = REDDIT_EXPRESSIONS.some(expr => lowerText.includes(expr))
  if (!hasRedditExpression) {
    score -= 5
    issues.push('缺少 Reddit 特有表达（如 tbh, imo, ngl 等）（-5分）')
  }

  // 6. 开头模式：检查首句是否是 AI 典型开头
  const firstSentence = sentences[0]?.trim().toLowerCase() || ''
  const hasAITypicalStart = AI_TYPICAL_STARTS.some(start => firstSentence.startsWith(start))
  if (hasAITypicalStart) {
    score -= 10
    issues.push('开头使用了 AI 典型句式（如 "I think..."）（-10分）')
  }

  // 确保分数不低于 0
  score = Math.max(0, score)

  return { score, issues }
}
