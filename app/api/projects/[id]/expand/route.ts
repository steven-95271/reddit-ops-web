import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

interface SubredditTarget {
  subreddit: string
  reason: string
  relevance: 'high' | 'medium'
  search_within: string[]
}

interface ExpandResult {
  phase1_brand: {
    description: string
    queries: string[]
  }
  phase2_competitor: {
    description: string
    queries: string[]
  }
  phase3_scene_pain: {
    description: string
    queries: string[]
  }
  phase4_subreddits: {
    description: string
    targets: SubredditTarget[]
  }
}

const KIMI_API_KEY = process.env.KIMI_API_KEY || ''
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2-5'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7-Highspeed'

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

    const result = await sql`SELECT * FROM projects WHERE id = ${id}`

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = result.rows[0]

    const brandNames = project.brand_names ? JSON.parse(project.brand_names) : []
    const competitorBrands = project.competitor_brands ? JSON.parse(project.competitor_brands) : []
    const existingKeywords = project.keywords ? JSON.parse(project.keywords) : {}
    const seedKeywords = existingKeywords.seed || []

    const prompt = `You are a Reddit growth hacker helping a brand run covert marketing operations.

Product: ${project.product_name || 'N/A'}
Description: ${project.product_description || 'N/A'}
Target audience: ${project.target_audience || 'N/A'}
Our brand: ${brandNames.join(', ') || 'N/A'}
Competitor brands: ${competitorBrands.join(', ') || 'N/A'}
Seed keywords: ${seedKeywords.join(', ') || 'N/A'}

Generate a 4-phase Reddit search strategy. Each query must be something a REAL USER would type into Reddit's search bar — natural language, not SEO keywords.

PHASE 1 - Brand & Category Queries (cast wide net, high volume):
- Include our brand name variations + generic category searches
- Mix: "[brand] review", "[brand] vs", "[category] recommendation", "[category] worth it"
- Goal: capture all hot discussions about our product and category
- Generate 8-10 queries

PHASE 2 - Competitor Intelligence (high-value purchase decision moments):
- Focus on competitor brand names as the SUBJECT (not our brand)
- Patterns: "[competitor] problems", "[competitor] alternative", "[competitor] vs [category]", "switched from [competitor]", "[competitor] review 2026"
- Goal: find users actively comparing options before buying
- Use current year: 2026
- Generate 6-8 queries

PHASE 3 - Scene & Pain Point Queries (authentic user voice):
- Real usage scenarios: commuting, running, working from home, gym, etc.
- Real pain points: ear discomfort, falling out, sound quality, battery, etc.
- Patterns: "headphones for [specific scenario]", "[pain point] earphones", "tired of [problem]", "best [category] for [specific person type]"
- Goal: find organic discussions where product recommendation feels natural
- Generate 8-10 queries

PHASE 4 - Subreddit Targeting (precision deep-dig):
- Only recommend subreddits where this product category is discussed NATURALLY
- For each subreddit, provide 3-5 search terms to use WITHIN that subreddit
- Only include high and medium relevance communities (NO low relevance)
- Explain WHY users in this community would naturally discuss this product type
- Generate 6-10 subreddits total

Return as JSON only, no explanation:
{
  "phase1_brand": {
    "description": "Brand core keywords - wide net casting",
    "queries": ["query1", "query2", ...]
  },
  "phase2_competitor": {
    "description": "Competitor comparison - high-value intelligence",
    "queries": ["query1", "query2", ...]
  },
  "phase3_scene_pain": {
    "description": "Scene & pain point keywords - user voice",
    "queries": ["query1", "query2", ...]
  },
  "phase4_subreddits": {
    "description": "Precision Subreddit targeting",
    "targets": [
      {
        "subreddit": "headphones",
        "reason": "Why this community discusses this product type",
        "relevance": "high",
        "search_within": ["search term 1", "search term 2", "search term 3"]
      }
    ]
  }
}

IMPORTANT:
- Queries must be natural language, like real Reddit users type
- Include brand names and competitor names where relevant
- Subreddit names WITHOUT "r/" prefix
- All content in English
- Phase 4: ONLY high and medium relevance, NO low relevance subreddits`

    const aiResponse = await callAIWithFallback(prompt)

    let expandResult: ExpandResult
    try {
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

    const updatedKeywords = {
      ...existingKeywords,
      seed: seedKeywords,
      phase1_brand: expandResult.phase1_brand || { description: '', queries: [] },
      phase2_competitor: expandResult.phase2_competitor || { description: '', queries: [] },
      phase3_scene_pain: expandResult.phase3_scene_pain || { description: '', queries: [] },
      phase4_subreddits: expandResult.phase4_subreddits || { description: '', targets: [] }
    }

    const now = new Date().toISOString()
    await sql`
      UPDATE projects 
      SET 
        keywords = ${JSON.stringify(updatedKeywords)},
        updated_at = ${now}
      WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      data: {
        keywords: updatedKeywords
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
