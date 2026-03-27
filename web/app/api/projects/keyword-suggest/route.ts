import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || 'sk-cp-ay979ATn71LK52-r38V5tum9nCH4SBe5RuMBXYYog9E4I1f6D-yFhmnAp7GaGAPTf-Ib7kwlqBOd6wktwdoRSlZf8Ykbmvaq8CQhokcxUeMzuiFiZBOs910'
const MINIMAX_API_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'

const SYSTEM_PROMPT = `You are an expert Reddit content operations and social media monitoring specialist.
Your task is to recommend a comprehensive Reddit search monitoring strategy based on seed keywords.

Analyze the keywords and generate:
1. 10-20 English search queries suitable for Reddit search (covering product terms, use-case scenarios, pain points, comparisons, long-tail queries)
2. 5-15 most relevant subreddits with explanations
3. Competitor brands to monitor
4. Classification keywords for post categorization (review, pain_point, controversy, competitor, trend)

You must respond with a valid JSON object in this exact format:
{
  "search_queries": ["query1", "query2", ...],
  "subreddits": [
    {"name": "subreddit_name", "reason": "why relevant", "relevance": "high/medium/low"}
  ],
  "competitor_brands": ["brand1", "brand2", ...],
  "classification_keywords": {
    "review": ["keyword1", "keyword2"],
    "pain_point": ["keyword1", "keyword2"],
    "controversy": ["keyword1", "keyword2"],
    "competitor": ["keyword1", "keyword2"],
    "trend": ["keyword1", "keyword2"]
  },
  "reasoning": "Brief explanation of your recommendations"
}

Be strategic and comprehensive. Consider:
- Product category terms
- Use case scenarios (sports, commuting, work, etc.)
- Comparison queries (vs, best, top)
- Problem/pain point searches
- Trending/hot topic queries
- Community-specific terminology`

const FALLBACK_SUGGESTIONS = {
  "search_queries": [
    "open ear earbuds review",
    "best open back headphones 2025",
    "open ear vs in ear earbuds",
    "bone conduction vs air conduction",
    "open ear earbuds for running",
    "open ear earbuds comfort",
    "safari audio glasses",
    "meta quest audio",
    "amazon echo frames",
    "bose ultra open earbuds"
  ],
  "subreddits": [
    {"name": "headphones", "reason": "Main audio equipment discussion", "relevance": "high"},
    {"name": "earbuds", "reason": "Earbud-specific discussions", "relevance": "high"},
    {"name": "audiophile", "reason": "High-end audio enthusiasts", "relevance": "medium"},
    {"name": "running", "reason": "Sports use case for earbuds", "relevance": "high"},
    {"name": "Fitness", "reason": "Workout gear discussions", "relevance": "medium"},
    {"name": "commuting", "reason": "Daily commute audio needs", "relevance": "medium"}
  ],
  "competitor_brands": [
    "bose", "sony", "apple", "shokz", "aftershokz", 
    "jabra", "samsung", "meta", "amazon", "sennheiser"
  ],
  "classification_keywords": {
    "review": ["review", "comparison", "vs", "best", "ranking", "top", "rated", "recommend", "worth", "rating"],
    "pain_point": ["problem", "issue", "hate", "annoying", "broke", "bad", "terrible", "awful", "disappointed", "fail"],
    "controversy": ["overrated", "unpopular", "change my mind", "fight me", "hot take", "controversial", "disagree"],
    "competitor": ["shokz", "bose", "sony", "apple", "jabra", "samsung", "anker", "soundcore", "jbl", "sennheiser"],
    "trend": ["everyone", "trending", "popular", "viral", "love", "obsessed", "amazing", "game changer", "2025"]
  },
  "reasoning": "Fallback suggestions based on open ear earbuds category"
}

async function callMiniMax(seedKeywords: string[], projectContext: string): Promise<any> {
  const keywordsStr = seedKeywords.join(', ')
  
  const userPrompt = projectContext 
    ? `My seed keywords are: ${keywordsStr}\n\nProject background:\n${projectContext}\n\nPlease provide your recommendations in the specified JSON format.`
    : `My seed keywords are: ${keywordsStr}\n\nPlease provide your recommendations in the specified JSON format.`

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    })

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return FALLBACK_SUGGESTIONS
  } catch (error) {
    console.error('MiniMax API call failed:', error)
    return FALLBACK_SUGGESTIONS
  }
}

// POST /api/projects/keyword-suggest
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seed_keywords = [], project_context = '', project_id } = body

    console.log('Keyword suggestion request:', { seed_keywords, project_context, project_id })

    // Call MiniMax AI
    const suggestions = await callMiniMax(seed_keywords, project_context)

    // If project_id provided, also update the project with these suggestions
    if (project_id && suggestions) {
      try {
        await sql.query(`
          UPDATE projects SET 
            search_query = $1,
            subreddits = $2,
            suggested_keywords = $3,
            classification_keywords = $4
          WHERE id = $5
        `, [
          JSON.stringify(suggestions.search_queries || []),
          JSON.stringify(suggestions.subreddits || []),
          JSON.stringify(suggestions.competitor_brands || []),
          JSON.stringify(suggestions.classification_keywords || {}),
          project_id
        ])
      } catch (e) {
        console.error('Failed to update project:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      suggestions,
      seed_keywords,
      has_ai: true
    })
  } catch (error) {
    console.error('Keyword suggestion error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to generate suggestions',
      suggestions: FALLBACK_SUGGESTIONS,
      has_ai: false
    })
  }
}

// GET /api/projects/keyword-suggest?seed=xxx&context=yyy
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const seedStr = searchParams.get('seed') || 'open ear earbuds'
  const context = searchParams.get('context') || ''
  const seedKeywords = seedStr.split(',').map(s => s.trim()).filter(Boolean)

  const suggestions = await callMiniMax(seedKeywords, context)

  return NextResponse.json({
    ok: true,
    suggestions,
    seed_keywords: seedKeywords,
    has_ai: true
  })
}