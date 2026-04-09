import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { ExtractedProductInfo } from '@/lib/types/p1'
import { generateKeywordsWithAI, generateSubredditsWithAI } from '@/lib/ai/minimax'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[Expand] API route hit')
  console.log('[Expand] MINIMAX_API_KEY exists:', !!process.env.MINIMAX_API_KEY)
  console.log('[Expand] MINIMAX_GROUP_ID exists:', !!process.env.MINIMAX_GROUP_ID)

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

    const existingKeywords = project.keywords ? JSON.parse(project.keywords) : {}

    const rawSeeds = existingKeywords.seed || []
    const seedKeywords = Array.isArray(rawSeeds)
      ? rawSeeds.flatMap((s: string) => s.split(/[,，、]/)).map((s: string) => s.trim()).filter(Boolean)
      : String(rawSeeds).split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)

    const rawCompetitors = project.competitor_brands ? JSON.parse(project.competitor_brands) : []
    const competitorBrands = Array.isArray(rawCompetitors)
      ? rawCompetitors.flatMap((s: string) => s.split(/[,，、]/)).map((s: string) => s.trim()).filter(Boolean)
      : String(rawCompetitors).split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)

    const productInfo: ExtractedProductInfo = {
      productType: '',
      productName: project.product_name || '',
      sellingPoints: [],
      targetAudience: project.target_audience ? [project.target_audience] : [],
      competitors: competitorBrands,
      seedKeywords: seedKeywords
    }

    console.log('[Expand] productInfo:', JSON.stringify(productInfo, null, 2))

    console.log('[Expand] Calling generateKeywordsWithAI...')
    const keywordsResult = await generateKeywordsWithAI(productInfo)
    console.log('[Expand] generateKeywordsWithAI done, brands:', keywordsResult.brand.length, '| comparisons:', keywordsResult.comparison.length, '| scenarios:', keywordsResult.scenario.length)

    console.log('[Expand] Calling generateSubredditsWithAI...')
    const subredditsResult = await generateSubredditsWithAI(productInfo, keywordsResult)
    console.log('[Expand] generateSubredditsWithAI done, high:', subredditsResult.subreddits.high.length, '| medium:', subredditsResult.subreddits.medium.length)

    const expandResult: ExpandResult = {
      phase1_brand: {
        description: keywordsResult.brand[0]?.reason || 'Brand core keywords',
        queries: keywordsResult.brand.map(k => k.keyword)
      },
      phase2_competitor: {
        description: keywordsResult.comparison[0]?.reason || 'Competitor comparison keywords',
        queries: keywordsResult.comparison.map(k => k.keyword)
      },
      phase3_scene_pain: {
        description: keywordsResult.scenario[0]?.reason || 'Scene & pain point keywords',
        queries: keywordsResult.scenario.map(k => k.keyword)
      },
      phase4_subreddits: {
        description: 'Precision Subreddit targeting',
        targets: [
          ...subredditsResult.subreddits.high.map(s => ({
            subreddit: s.name,
            reason: s.reason,
            relevance: 'high' as const,
            search_within: (s.searchKeywords || keywordsResult.scenario.slice(0, 3).map(k => k.keyword))
          })),
          ...subredditsResult.subreddits.medium.map(s => ({
            subreddit: s.name,
            reason: s.reason,
            relevance: 'medium' as const,
            search_within: (s.searchKeywords || keywordsResult.scenario.slice(0, 3).map(k => k.keyword))
          }))
        ]
      }
    }

    const updatedKeywords = {
      ...existingKeywords,
      seed: seedKeywords,
      reasoning: keywordsResult.reasoning || '',
      phase1_brand: expandResult.phase1_brand,
      phase2_competitor: expandResult.phase2_competitor,
      phase3_scene_pain: expandResult.phase3_scene_pain,
      phase4_subreddits: expandResult.phase4_subreddits
    }

    const now = new Date().toISOString()
    await sql`
      UPDATE projects
      SET
        keywords = ${JSON.stringify(updatedKeywords)},
        updated_at = ${now}
      WHERE id = ${id}
    `

    console.log('[Expand] Success, returning updated keywords')
    return NextResponse.json({
      success: true,
      data: {
        keywords: updatedKeywords
      }
    })

  } catch (error) {
    console.error('[Expand] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to expand project'
    }, { status: 500 })
  }
}
