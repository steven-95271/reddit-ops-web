import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await initDb()
    
    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')
    const min_quality = searchParams.get('min_quality')
    const time_range = searchParams.get('time_range')
    const phase = searchParams.get('phase')
    const is_candidate = searchParams.get('is_candidate')
    const ignored = searchParams.get('ignored')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 获取候选帖子数量
    const candidateCountResult = await sql`
      SELECT COUNT(*) as count FROM posts WHERE project_id = ${project_id} AND is_candidate = TRUE
    `
    const candidateCount = parseInt(candidateCountResult.rows[0].count)

    // 获取总数量 - 使用条件查询
    let total = 0
    let postsResult

    // 构建时间范围条件
    let startDateStr: string | null = null
    if (time_range && time_range !== 'all') {
      const now = new Date()
      let startDate: Date
      switch (time_range) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(0)
      }
      startDateStr = startDate.toISOString()
    }

    // 根据条件组合执行不同的查询
    if (phase && min_quality && startDateStr) {
      // 所有条件
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND quality_score >= ${parseInt(min_quality)}
        AND created_utc >= ${startDateStr}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND quality_score >= ${parseInt(min_quality)}
        AND created_utc >= ${startDateStr}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (phase && min_quality) {
      // phase + min_quality
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND quality_score >= ${parseInt(min_quality)}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND quality_score >= ${parseInt(min_quality)}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (phase && startDateStr) {
      // phase + time_range
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND created_utc >= ${startDateStr}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND created_utc >= ${startDateStr}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (min_quality && startDateStr) {
      // min_quality + time_range
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND quality_score >= ${parseInt(min_quality)}
        AND created_utc >= ${startDateStr}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND quality_score >= ${parseInt(min_quality)}
        AND created_utc >= ${startDateStr}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (phase) {
      // phase only
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND category = ${phase}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (min_quality) {
      // min_quality only
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND quality_score >= ${parseInt(min_quality)}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND quality_score >= ${parseInt(min_quality)}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (startDateStr) {
      // time_range only
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id} 
        AND created_utc >= ${startDateStr}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        AND created_utc >= ${startDateStr}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      // 基础查询（仅 project_id）
      const countResult = await sql`
        SELECT COUNT(*) as total FROM posts 
        WHERE project_id = ${project_id}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
      `
      total = parseInt(countResult.rows[0].total)
      
      postsResult = await sql`
        SELECT 
          id, reddit_id, subreddit, title, body, author, url,
          score, num_comments, upvote_ratio, created_utc,
          quality_score, ai_relevance_score, ai_intent_score, 
          ai_opportunity_score, ai_suggested_angle, category,
          is_candidate, ignored, scraped_at
        FROM posts 
        WHERE project_id = ${project_id}
        ${is_candidate === 'true' ? sql`AND is_candidate = TRUE` : sql``}
        ${ignored === 'true' ? sql`AND ignored = TRUE` : ignored === 'false' ? sql`AND ignored = FALSE` : sql``}
        ORDER BY quality_score DESC NULLS LAST, created_utc DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    return NextResponse.json({
      success: true,
      data: {
        posts: postsResult!.rows,
        total,
        candidateCount,
        limit,
        offset
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
