/**
 * 帖子评分和分类算法
 * 从 Python 迁移到 TypeScript
 */

interface Post {
  id: string
  project_id: string
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  score: number
  num_comments: number
  created_utc: Date | string | number
  hot_score?: number
  composite_score?: number
  category?: string
  is_candidate?: boolean
  scraped_at?: Date
}

interface Keywords {
  core?: string[]
  longTail?: string[]
  competitor?: string[]
  scenario?: string[]
  seed?: string[]
  brand?: string[]
  product?: string[]
  category?: string[]
  comparison?: string[]
  problem?: string[]
}

/**
 * 计算 Hot Score（热度分 0-100）
 * 
 * 基于帖子的 upvotes、评论数、发帖时间计算热度。
 * 算法：
 * 1. 计算帖子年龄（小时）
 * 2. 时间衰减因子：越新的帖子分数越高
 * 3. 互动量归一化：upvotes + comments 的加权和
 * 4. 最终分数 = 互动分 × 时间衰减
 */
export function calculateHotScore(post: Post): number {
  const upvotes = post.score || 0
  const comments = post.num_comments || 0
  
  // 计算帖子年龄（小时）
  const createdDate = new Date(post.created_utc)
  const now = new Date()
  const ageHours = Math.max(0, (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60))
  
  // 时间衰减因子：使用指数衰减，24 小时后衰减到 50%
  const timeDecay = Math.exp(-ageHours / 24)
  
  // 互动量：upvotes 权重 1.0，comments 权重 1.5（评论比点赞更有价值）
  const interactionScore = upvotes + (comments * 1.5)
  
  // 归一化：使用 log 函数避免极端值影响
  const normalizedInteraction = Math.log10(interactionScore + 1) / Math.log10(1000 + 1)
  
  // 最终分数：互动分 × 时间衰减 × 100
  const hotScore = Math.min(100, Math.max(0, normalizedInteraction * timeDecay * 100))
  
  return Math.round(hotScore * 100) / 100
}

/**
 * 计算 Composite Score（综合分 0-1）
 * 
 * 综合热度、相关性、互动质量的加权分数。
 * 权重：
 * - 热度（Hot Score 归一化）：40%
 * - 关键词相关性：35%
 * - 互动质量（评论/点赞比率）：25%
 */
export function calculateCompositeScore(post: Post, keywords: Keywords): number {
  // 1. 热度分（归一化到 0-1）
  const hotScore = calculateHotScore(post)
  const normalizedHotScore = hotScore / 100
  
  // 2. 关键词相关性
  const relevanceScore = calculateRelevanceScore(post, keywords)
  
  // 3. 互动质量（评论/点赞比率）
  const interactionQuality = calculateInteractionQuality(post)
  
  // 加权综合
  const compositeScore = 
    (normalizedHotScore * 0.4) +
    (relevanceScore * 0.35) +
    (interactionQuality * 0.25)
  
  return Math.min(1, Math.max(0, Math.round(compositeScore * 1000) / 1000))
}

/**
 * 计算关键词相关性（0-1）
 * 
 * 检查标题和正文是否包含关键词，包含越多相关性越高。
 * 长尾词权重更高（更具体），核心词权重较低。
 */
function calculateRelevanceScore(post: Post, keywords: Keywords): number {
  const title = (post.title || '').toLowerCase()
  const body = (post.body || '').toLowerCase()
  const content = `${title} ${body}`
  
  let score = 0
  let maxScore = 0
  
  // 收集所有关键词
  const allKeywords: Array<{ word: string; weight: number }> = []
  
  // 长尾词权重最高（3.0）- 最具体
  if (keywords.longTail) {
    keywords.longTail.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 3.0 }))
  }
  if (keywords.comparison) {
    keywords.comparison.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 3.0 }))
  }
  
  // 场景词和问题词权重较高（2.0）
  if (keywords.scenario) {
    keywords.scenario.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 2.0 }))
  }
  if (keywords.problem) {
    keywords.problem.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 2.0 }))
  }
  
  // 核心词和竞品词权重中等（1.5）
  if (keywords.core) {
    keywords.core.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.5 }))
  }
  if (keywords.competitor) {
    keywords.competitor.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.5 }))
  }
  
  // 品牌词和产品词权重较低（1.0）
  if (keywords.brand) {
    keywords.brand.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.0 }))
  }
  if (keywords.product) {
    keywords.product.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.0 }))
  }
  if (keywords.category) {
    keywords.category.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.0 }))
  }
  if (keywords.seed) {
    keywords.seed.forEach(kw => allKeywords.push({ word: kw.toLowerCase(), weight: 1.0 }))
  }
  
  // 计算匹配分数
  for (const { word, weight } of allKeywords) {
    maxScore += weight
    
    // 标题匹配权重是正文的 2 倍
    if (title.includes(word)) {
      score += weight * 2
    } else if (body.includes(word)) {
      score += weight
    }
  }
  
  // 归一化到 0-1，使用平方根函数避免过度惩罚
  if (maxScore === 0) return 0
  return Math.min(1, Math.sqrt(score / maxScore))
}

/**
 * 计算互动质量（0-1）
 * 
 * 基于评论数/点赞数比率。
 * 比率越高说明讨论越深入（不是单纯点赞）。
 * 理想比率：0.1-0.5（每 10 个点赞有 1-5 条评论）
 */
function calculateInteractionQuality(post: Post): number {
  const upvotes = post.score || 0
  const comments = post.num_comments || 0
  
  if (upvotes === 0 && comments === 0) return 0
  if (upvotes === 0) return Math.min(1, comments / 10)
  
  const ratio = comments / upvotes
  
  // 使用高斯函数，峰值在 ratio = 0.3
  // ratio < 0.05: 低质量（纯点赞无讨论）
  // ratio 0.1-0.5: 高质量（有深度讨论）
  // ratio > 1.0: 可能争议过大
  const quality = Math.exp(-Math.pow((ratio - 0.3) / 0.4, 2))
  
  return Math.min(1, Math.max(0, quality))
}

/**
 * 根据综合分返回等级
 * 
 * S 级（≥0.8）：最高价值帖
 * A 级（≥0.6）：高价值帖
 * B 级（≥0.4）：中等价值
 * C 级（<0.4）：低价值
 */
export function classifyGrade(compositeScore: number): 'S' | 'A' | 'B' | 'C' {
  if (compositeScore >= 0.8) return 'S'
  if (compositeScore >= 0.6) return 'A'
  if (compositeScore >= 0.4) return 'B'
  return 'C'
}

/**
 * 五维分类
 * 
 * A 类 - 结构型测评帖：包含 "best...for" 或 "recommend"
 * B 类 - 场景痛点帖：包含 "problem/issue/hate/broken/sucks"
 * C 类 - 观点争议帖：包含 "vs/compare/which/better"
 * D 类 - 竞品/KOL 帖：包含竞品品牌名
 * E 类 - 平台趋势帖：其他
 */
export function classifyCategory(
  post: Post,
  keywords: Keywords,
  competitors: string[] = []
): 'A' | 'B' | 'C' | 'D' | 'E' {
  const title = (post.title || '').toLowerCase()
  const body = (post.body || '').toLowerCase()
  const content = `${title} ${body}`
  
  // A 类：结构型测评帖
  const aPatterns = [
    /\bbest\s+\w+\s+for\b/i,
    /\btop\s+\w+\s+for\b/i,
    /\brecommend/i,
    /\brecommendation/i,
    /\breview\b/i,
    /\bworth it\b/i,
  ]
  if (aPatterns.some(pattern => pattern.test(content))) {
    return 'A'
  }
  
  // B 类：场景痛点帖
  const bPatterns = [
    /\bproblem\b/i,
    /\bissue\b/i,
    /\bhate\b/i,
    /\bbroken\b/i,
    /\bsucks\b/i,
    /\bterrible\b/i,
    /\bawful\b/i,
    /\bdisappoint/i,
    /\bcomplaint\b/i,
    /\bnot working\b/i,
    /\bdoesn'?t work\b/i,
  ]
  if (bPatterns.some(pattern => pattern.test(content))) {
    return 'B'
  }
  
  // C 类：观点争议帖
  const cPatterns = [
    /\bvs\b/i,
    /\bversus\b/i,
    /\bcompare\b/i,
    /\bcomparison\b/i,
    /\bwhich\b/i,
    /\bbetter\b/i,
    /\bworse\b/i,
    /\bor\b/i,
    /\bdifference\b/i,
  ]
  if (cPatterns.some(pattern => pattern.test(content))) {
    return 'C'
  }
  
  // D 类：竞品/KOL 帖
  const lowerCompetitors = competitors.map(c => c.toLowerCase())
  if (lowerCompetitors.some(competitor => content.includes(competitor))) {
    return 'D'
  }
  
  // E 类：平台趋势帖（其他）
  return 'E'
}

/**
 * 批量评分和分类
 */
export function scoreAndClassifyPosts(
  posts: Post[],
  keywords: Keywords,
  competitors: string[] = []
): Array<Post & { grade: string; category: string }> {
  return posts.map(post => {
    const hotScore = calculateHotScore(post)
    const compositeScore = calculateCompositeScore(post, keywords)
    const grade = classifyGrade(compositeScore)
    const category = classifyCategory(post, keywords, competitors)
    
    return {
      ...post,
      hot_score: hotScore,
      composite_score: compositeScore,
      category,
      grade,
    }
  })
}
