import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

const KIMI_API_KEY = process.env.KIMI_API_KEY || ''
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2.5'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7-Highspeed'

interface AIscoreResult {
  relevance: number
  intent: number
  opportunity: number
  reason: string
  suggested_angle: string
}

async function callAIWithFallback(prompt: string): Promise<AIscoreResult> {
  try {
    const result = await callKimi(prompt)
    return result
  } catch (error) {
    console.error('Kimi failed, trying MiniMax:', error)
    try {
      const result = await callMiniMax(prompt)
      return result
    } catch (miniError) {
      console.error('MiniMax also failed:', miniError)
      throw miniError
    }
  }
}

async function callMiniMax(prompt: string): Promise<AIscoreResult> {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || data.output || ''
  
  return parseAIResponse(content)
}

async function callKimi(prompt: string): Promise<AIscoreResult> {
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
    throw new Error(`Kimi API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  return parseAIResponse(content)
}

function parseAIResponse(content: string): AIscoreResult {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        relevance: Math.min(10, Math.max(0, parsed.relevance || 0)),
        intent: Math.min(10, Math.max(0, parsed.intent || 0)),
        opportunity: Math.min(10, Math.max(0, parsed.opportunity || 0)),
        reason: parsed.reason || '',
        suggested_angle: parsed.suggested_angle || ''
      }
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e)
  }
  
  // 默认返回值
  return {
    relevance: 5,
    intent: 5,
    opportunity: 5,
    reason: '解析失败',
    suggested_angle: ''
  }
}

function buildScoringPrompt(
  productName: string,
  productDescription: string,
  brandNames: string[],
  competitorBrands: string[],
  postTitle: string,
  postBody: string,
  subreddit: string,
  score: number,
  numComments: number
): string {
  return `你是一个 Reddit 内容分析师，正在筛选适合植入品牌评论的帖子。

【品牌信息】
产品: ${productName}
描述: ${productDescription}
自有品牌: ${brandNames.join(', ') || '无'}
竞品: ${competitorBrands.join(', ') || '无'}

【帖子信息】
标题: ${postTitle}
内容: ${postBody?.substring(0, 800) || '无'}
Subreddit: r/${subreddit}
当前互动: ${score} upvotes, ${numComments} comments

【评分任务】
请从三个维度评分（各 0-10 分），只返回 JSON：

1. 相关度 (relevance)
   - 帖子内容是否与产品品类相关？
   - 用户是否在讨论相关话题或问题？

2. 意图匹配 (intent)
   - 用户是否在寻求建议/推荐/解决方案？
   - 是否有明确的购买决策场景？

3. 可植入性 (opportunity)
   - 话题场景是否允许自然地提及产品？
   - 会不会显得突兀或广告感太强？

【输出格式】
{"relevance": 8, "intent": 7, "opportunity": 6, "reason": "用户在比较耳机品牌，适合推荐", "suggested_angle": "强调降噪功能对比 AirPods"}

请直接返回 JSON，不要有其他内容。`
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { project_id, post_ids } = body

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 获取项目信息
    const projectResult = await sql`
      SELECT * FROM projects WHERE id = ${project_id}
    `

    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = projectResult.rows[0]
    const brandNames = project.brand_names ? JSON.parse(project.brand_names) : []
    const competitorBrands = project.competitor_brands ? JSON.parse(project.competitor_brands) : []

    // 获取要评分的帖子
    let postsResult
    if (post_ids && post_ids.length > 0) {
      postsResult = await sql`
        SELECT * FROM posts 
        WHERE project_id = ${project_id} 
        AND id = ANY(${post_ids}) 
        AND ai_scored_at IS NULL 
        LIMIT 50
      `
    } else {
      postsResult = await sql`
        SELECT * FROM posts 
        WHERE project_id = ${project_id} 
        AND ai_scored_at IS NULL 
        LIMIT 50
      `
    }

    if (postsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No posts to score',
          scored: 0
        }
      })
    }

    let scored = 0
    const errors: string[] = []

    for (const post of postsResult.rows) {
      try {
        const prompt = buildScoringPrompt(
          project.product_name || '',
          project.product_description || '',
          brandNames,
          competitorBrands,
          post.title,
          post.body,
          post.subreddit,
          post.score,
          post.num_comments
        )

        const aiResult = await callAIWithFallback(prompt)

        // 计算 ai_label（基于分数）
        const avgScore = (aiResult.relevance + aiResult.intent + aiResult.opportunity) / 3
        const aiLabel = avgScore >= 7 ? 'S' : avgScore >= 5 ? 'A' : avgScore >= 3 ? 'B' : 'C'

        // 更新数据库
        await sql`
          UPDATE posts SET
            ai_relevance_score = ${aiResult.relevance},
            ai_intent_score = ${aiResult.intent},
            ai_opportunity_score = ${aiResult.opportunity},
            ai_suggested_angle = ${aiResult.suggested_angle},
            ai_reasoning = ${aiResult.reason},
            ai_label = ${aiLabel},
            ai_scored_at = NOW()
          WHERE id = ${post.id}
        `

        scored++
        
        // 避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error scoring post ${post.id}:`, error)
        errors.push(`Post ${post.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scored,
        total: postsResult.rows.length,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('Error in AI scoring:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to score posts'
    }, { status: 500 })
  }
}