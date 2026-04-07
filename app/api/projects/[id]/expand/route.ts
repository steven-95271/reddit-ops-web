import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

interface KeywordReasoning {
  brand: string
  painPoints: string
  voice: string
  scenario: string
  comparison: string
  questions: string
  redditSyntax: string
}

interface SubredditItem {
  name: string
  reason: string
  estimatedPosts: 'daily' | 'weekly'
  relevance: 'high' | 'medium' | 'low'
}

interface ExpandResult {
  keywords: {
    brand: string[]
    painPoints: string[]
    voice: string[]
    scenario: string[]
    comparison: string[]
    questions: string[]
    redditSyntax: string[]
  }
  keywordsReasoning: KeywordReasoning
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

    const prompt = `You are a Reddit marketing expert. Generate keywords optimized for Apify Reddit scraping.

Product Information:
- Product Name: ${project.product_name || 'N/A'}
- Product Description: ${project.product_description || 'N/A'}
- Target Audience: ${project.target_audience || 'N/A'}
- Brand Names: ${brandNames.join(', ') || 'N/A'}
- Competitor Brands: ${competitorBrands.join(', ') || 'N/A'}
- Seed Keywords: ${seedKeywords.join(', ') || 'N/A'}

Generate 7 keyword categories for Reddit scraping. These will be used with Apify to find relevant posts.

**KEYWORD CATEGORIES:**

1. **brand** (3-5 keywords)
   - Brand names, product names, model numbers
   - Example: "Shokz", "OpenRun Pro", "bone conduction headphones"
   - Purpose: Monitor brand mentions and reputation

2. **painPoints** (8-12 keywords)
   - User complaints, frustrations, problems
   - Include emotion words: "hate", "frustrated", "annoying", "broken", "doesn't work", "disappointed", "terrible", "worst", "regret buying", "waste of money", "returning", "issues with"
   - Example: "Shokz stopped working", "headphones hurt my ears", "frustrated with battery life"
   - Purpose: Find unhappy users to understand problems or identify opportunities

3. **voice** (8-12 keywords)
   - Positive user expressions, recommendations, praise
   - Include sentiment words: "love", "recommend", "best", "game changer", "amazing", "worth it", "lifesaver", "must have", "incredible", "perfect for", "obsessed with", "can't live without"
   - Example: "love my Shokz", "best headphones for running", "game changer for cycling"
   - Purpose: Find authentic user testimonials and advocates

4. **scenario** (6-8 keywords)
   - Specific use cases and contexts
   - Include: "for work", "for travel", "for gym", "for running", "for cycling", "for commute", "for office", "for outdoors", "while driving", "at home"
   - Example: "headphones for running", "earbuds for cycling commute", "best for workout"
   - Purpose: Find users discussing product in specific contexts

5. **comparison** (5-8 keywords)
   - Brand comparisons, alternatives, competitors
   - Include: "vs", "versus", "alternative to", "better than", "compared to", "or", "like", "similar to"
   - Example: "Shokz vs Bose", "alternative to AirPods", "better than bone conduction"
   - Purpose: Find users in decision-making phase

6. **questions** (8-12 keywords)
   - User questions and help-seeking phrases
   - Include: "how to", "what's the best", "which", "should I buy", "is it worth", "can I", "does it", "why", "help me", "looking for", "need advice", "anyone tried"
   - Example: "how to connect Shokz", "which bone conduction headphones", "is Shokz worth it"
   - Purpose: Find users actively seeking recommendations

7. **redditSyntax** (3-5 keywords)
   - Reddit-specific search patterns
   - Include: "[brand] review", "is [product] worth it", "[product] experience", "thoughts on [brand]", "[brand] vs alternatives"
   - Example: "Shokz review", "is OpenRun worth it", "bone conduction headphones experience"
   - Purpose: Optimize for Reddit's search behavior

**SUBREDDITS:**
Generate 8-15 subreddits across 3 relevance levels:
- high: 3-5 subreddits directly related to the product category
- medium: 3-5 subreddits for related interests or broader topics
- low: 2-5 subreddits with broad but relevant audiences

Return ONLY valid JSON:
{
  "keywords": {
    "brand": ["keyword1", "keyword2"],
    "painPoints": ["keyword1", "keyword2"],
    "voice": ["keyword1", "keyword2"],
    "scenario": ["keyword1", "keyword2"],
    "comparison": ["keyword1", "keyword2"],
    "questions": ["keyword1", "keyword2"],
    "redditSyntax": ["keyword1", "keyword2"]
  },
  "keywordsReasoning": {
    "brand": "Brief explanation of brand keyword selection strategy",
    "painPoints": "Brief explanation of pain point keyword selection strategy",
    "voice": "Brief explanation of user voice keyword selection strategy",
    "scenario": "Brief explanation of scenario keyword selection strategy",
    "comparison": "Brief explanation of comparison keyword selection strategy",
    "questions": "Brief explanation of question keyword selection strategy",
    "redditSyntax": "Brief explanation of Reddit-specific syntax selection strategy"
  },
  "subreddits": {
    "high": [
      {"name": "headphones", "reason": "Direct product category", "estimatedPosts": "daily"}
    ],
    "medium": [
      {"name": "running", "reason": "Target audience activity", "estimatedPosts": "daily"}
    ],
    "low": [
      {"name": "gadgets", "reason": "Broad tech interest", "estimatedPosts": "weekly"}
    ]
  }
}

IMPORTANT:
- Keywords must be simple strings optimized for Reddit/Apify search
- Include actual competitor brand names in comparison keywords
- Subreddit names WITHOUT "r/" prefix
- All keywords in English
- Total keywords: 45-60 across all categories`

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
      brand: expandResult.keywords.brand || [],
      painPoints: expandResult.keywords.painPoints || [],
      voice: expandResult.keywords.voice || [],
      scenario: expandResult.keywords.scenario || [],
      comparison: expandResult.keywords.comparison || [],
      questions: expandResult.keywords.questions || [],
      redditSyntax: expandResult.keywords.redditSyntax || []
    }

    const updatedSubreddits = {
      high: expandResult.subreddits.high || [],
      medium: expandResult.subreddits.medium || [],
      low: expandResult.subreddits.low || []
    }

    const keywordsReasoning = expandResult.keywordsReasoning || {
      brand: '',
      painPoints: '',
      voice: '',
      scenario: '',
      comparison: '',
      questions: '',
      redditSyntax: ''
    }

    const now = new Date().toISOString()
    await sql`
      UPDATE projects 
      SET 
        keywords = ${JSON.stringify(updatedKeywords)},
        subreddits = ${JSON.stringify(updatedSubreddits)},
        updated_at = ${now}
      WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      data: {
        keywords: updatedKeywords,
        keywordsReasoning,
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
