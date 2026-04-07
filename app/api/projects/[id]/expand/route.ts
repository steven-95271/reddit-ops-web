import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

interface SubredditItem {
  name: string
  reason: string
  estimatedPosts: 'daily' | 'weekly'
  relevance: 'high' | 'medium' | 'low'
}

interface ExpandResult {
  keywords: {
    core: string[]
    longTail: string[]
    competitor: string[]
    scenario: string[]
  }
  subreddits: {
    high: SubredditItem[]
    medium: SubredditItem[]
    low: SubredditItem[]
  }
}

const KIMI_API_KEY = process.env.KIMI_API_KEY || ''
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2-5'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-Text-01'

async function callAIWithFallback(prompt: string): Promise<string> {
  try {
    console.log('Trying Kimi K2.5...')
    const result = await callKimi(prompt)
    console.log('Kimi K2.5 success')
    return result
  } catch (error) {
    console.error('Kimi K2.5 failed:', error)
  }

  console.log('Falling back to MiniMax-M2.7-Highspeed...')
  try {
    if (!MINIMAX_API_KEY) {
      throw new Error('MINIMAX_API_KEY not configured')
    }
    const result = await callMiniMax(prompt)
    console.log('MiniMax API success')
    return result
  } catch (error) {
    console.error('MiniMax API also failed:', error)
    throw error
  }
}

async function callMiniMax(prompt: string): Promise<string> {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('[MiniMax Response]', JSON.stringify(data, null, 2))
  
  // MiniMax M2.7 模型可能将内容放在 reasoning_content 或 content 中
  const message = data.choices?.[0]?.message || {}
  const content = message.content || 
                  message.reasoning_content || 
                  data.choices?.[0]?.text || 
                  data.output || 
                  data.result ||
                  data.text ||
                  ''
  
  if (!content) {
    console.error('[MiniMax Error] Invalid response structure:', JSON.stringify(data, null, 2))
    throw new Error(`MiniMax API returned invalid response structure. Response: ${JSON.stringify(data).substring(0, 500)}`)
  }
  
  return content
}

async function callKimi(prompt: string): Promise<string> {
  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not configured')
  }

  const response = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log('[Kimi Response]', JSON.stringify(data, null, 2))
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[Kimi Error] Invalid response structure:', data)
    throw new Error('Kimi API returned invalid response structure')
  }
  
  return data.choices[0].message.content || ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required'
      }, { status: 400 })
    }

    // 从数据库读取项目信息
    const result = await sql`SELECT * FROM projects WHERE id = ${id}`

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = result.rows[0]

    // 解析 JSON 字段
    const brandNames = project.brand_names ? JSON.parse(project.brand_names) : []
    const competitorBrands = project.competitor_brands ? JSON.parse(project.competitor_brands) : []
    const existingKeywords = project.keywords ? JSON.parse(project.keywords) : {}
    const seedKeywords = existingKeywords.seed || []

    // 构建 AI prompt
    const prompt = `You are a Reddit marketing expert. Based on the following product information, generate keyword suggestions and Subreddit recommendations for Reddit marketing campaigns.

Product Information:
- Product Name: ${project.product_name || 'N/A'}
- Product Description: ${project.product_description || 'N/A'}
- Target Audience: ${project.target_audience || 'N/A'}
- Brand Names: ${brandNames.join(', ') || 'N/A'}
- Competitor Brands: ${competitorBrands.join(', ') || 'N/A'}
- Seed Keywords: ${seedKeywords.join(', ') || 'N/A'}

Please generate the following in JSON format:

1. **Keywords** (4 categories, 5-10 keywords each):
   - core: Core product keywords (product name, brand, category terms)
   - longTail: Long-tail keywords (specific use cases, detailed queries)
   - competitor: Competitor comparison keywords ("vs", "alternative", "comparison")
   - scenario: Scenario/use case keywords (running, commuting, workout, etc.)

2. **Subreddits** (5-10 subreddits with relevance levels):
   - high: High relevance subreddits (directly related to product/category)
   - medium: Medium relevance subreddits (indirectly related)
   - low: Low relevance subreddits (broad interest but still relevant)

Each subreddit should include:
   - name: Subreddit name (without r/ prefix)
   - reason: Brief reason in English why this subreddit is relevant
   - estimatedPosts: Either "daily" or "weekly"

Return ONLY valid JSON in this exact format:
{
  "keywords": {
    "core": ["keyword1", "keyword2", ...],
    "longTail": ["keyword1", "keyword2", ...],
    "competitor": ["keyword1", "keyword2", ...],
    "scenario": ["keyword1", "keyword2", ...]
  },
  "subreddits": {
    "high": [
      {"name": "subreddit_name", "reason": "relevance reason", "estimatedPosts": "daily"}
    ],
    "medium": [...],
    "low": [...]
  }
}

Important:
- Use English keywords optimized for Reddit search
- Ensure competitor keywords include actual competitor brand names
- Subreddit names should NOT include "r/" prefix
- Make keywords specific and searchable on Reddit`

    // 调用 AI API
    const aiResponse = await callAIWithFallback(prompt)

    // 解析 AI 返回的 JSON
    let expandResult: ExpandResult
    try {
      // 尝试提取 JSON 部分（AI 有时会在 JSON 外包裹其他文字）
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse
      expandResult = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response'
      }, { status: 500 })
    }

    // 构建新的 keywords 对象
    const updatedKeywords = {
      ...existingKeywords,
      core: expandResult.keywords.core || [],
      longTail: expandResult.keywords.longTail || [],
      competitor: expandResult.keywords.competitor || [],
      scenario: expandResult.keywords.scenario || []
    }

    // 构建 subreddits 对象
    const updatedSubreddits = {
      high: expandResult.subreddits.high || [],
      medium: expandResult.subreddits.medium || [],
      low: expandResult.subreddits.low || []
    }

    // 更新数据库
    const now = new Date().toISOString()
    await sql`
      UPDATE projects 
      SET 
        keywords = ${JSON.stringify(updatedKeywords)},
        subreddits = ${JSON.stringify(updatedSubreddits)},
        updated_at = ${now}
      WHERE id = ${id}
    `

    // 返回扩展结果
    return NextResponse.json({
      success: true,
      data: {
        keywords: updatedKeywords,
        subreddits: updatedSubreddits
      }
    })

  } catch (error) {
    console.error('Error expanding project:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to expand project'
    }, { status: 500 })
  }
}
