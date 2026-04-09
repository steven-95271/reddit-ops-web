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

    // 构建 ExtractedProductInfo
    const productInfo: ExtractedProductInfo = {
      productType: '',  // 从产品描述推断
      productName: project.product_name || '',
      sellingPoints: [],
      targetAudience: project.target_audience ? [project.target_audience] : [],
      competitors: competitorBrands,
      seedKeywords: seedKeywords
    }

    console.log('[Expand] Generating keywords with optimized prompt...')
    const keywordsResult = await generateKeywordsWithAI(productInfo)

    console.log('[Expand] Generating subreddits with optimized prompt...')
    const subredditsResult = await generateSubredditsWithAI(productInfo, keywordsResult)

    // 映射到 ExpandResult 格式
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
            search_within: keywordsResult.scenario.slice(0, 3).map(k => k.keyword)
          })),
          ...subredditsResult.subreddits.medium.map(s => ({
            subreddit: s.name,
            reason: s.reason,
            relevance: 'medium' as const,
            search_within: keywordsResult.scenario.slice(0, 3).map(k => k.keyword)
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
