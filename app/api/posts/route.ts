import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await initDb()

    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    const candidateCountResult = await sql`
      SELECT COUNT(*) as count FROM posts WHERE project_id = ${project_id} AND COALESCE(is_candidate, FALSE) = TRUE
    `
    const candidateCount = parseInt(candidateCountResult.rows[0].count)

    const result = await sql`
      SELECT
        p.id,
        p.reddit_id,
        p.subreddit,
        p.title,
        p.body,
        p.author,
        p.url,
        p.score,
        p.num_comments,
        p.upvote_ratio,
        p.created_utc,
        p.phase,
        p.keyword AS matched_keyword,
        p.type,
        p.post_id,
        p.parent_id,
        p.depth,
        p.post_title,
        p.subreddit_subscribers,
        p.link_flair_text,
        p.permalink,
        p.is_stickied,
        p.is_nsfw,
        p.replies,
        p.total_awards,
        p.quality_score,
        p.hot_score,
        p.composite_score,
        p.relevance_score,
        p.intent_score,
        p.opportunity_score,
        p.ai_label,
        p.ai_reasoning,
        p.ai_suggested_angle,
        p.category,
        COALESCE(p.is_candidate, FALSE) AS is_candidate,
        COALESCE(p.ignored, FALSE) AS ignored,
        p.scraped_at,
        p.scraping_run_id
      FROM posts p
      WHERE p.project_id = ${project_id}
      ORDER BY p.quality_score DESC NULLS LAST, p.created_utc DESC
    `

    const typeStats = result.rows.reduce((acc: Record<string, number>, p: any) => {
      const t = p.type || 'NULL'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {})
    console.log('[posts API] type distribution:', JSON.stringify(typeStats), '| total:', result.rows.length, '| project:', project_id)

    if (typeStats['NULL'] && result.rows.length > 0) {
      const backfillResult = await sql`
        UPDATE posts SET type = 'post' WHERE type IS NULL
      `
      console.log('[posts API] Backfilled type=post for', backfillResult.rowCount, 'rows')
    }

    return NextResponse.json({
      success: true,
      data: {
        posts: result.rows,
        total: result.rows.length,
        candidateCount
      }
    })

  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch posts'
    }, { status: 500 })
  }
}
