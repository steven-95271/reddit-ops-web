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
    const limit = searchParams.get('limit') || '100'
    const offset = searchParams.get('offset') || '0'

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 构建查询条件
    const conditions: string[] = ['project_id = $1']
    const params: any[] = [project_id]
    let paramIndex = 2

    if (min_quality) {
      conditions.push(`quality_score >= $${paramIndex}`)
      params.push(parseInt(min_quality))
      paramIndex++
    }

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
      conditions.push(`created_utc >= $${paramIndex}`)
      params.push(startDate.toISOString())
      paramIndex++
    }

    if (phase) {
      conditions.push(`category = $${paramIndex}`)
      params.push(phase)
      paramIndex++
    }

    if (is_candidate === 'true') {
      conditions.push('is_candidate = TRUE')
    }

    if (ignored === 'true') {
      conditions.push('ignored = TRUE')
    } else if (ignored === 'false') {
      conditions.push('ignored = FALSE')
    }

    const whereClause = conditions.join(' AND ')
    
    // 获取总数
    const countResult = await sql`
      SELECT COUNT(*) as total FROM posts WHERE ${sql.unsafe(whereClause)}
    `
    const total = parseInt(countResult.rows[0].total)

    // 获取帖子列表
    const postsResult = await sql`
      SELECT 
        id,
        reddit_id,
        subreddit,
        title,
        body,
        author,
        url,
        score,
        num_comments,
        upvote_ratio,
        created_utc,
        quality_score,
        ai_relevance_score,
        ai_intent_score,
        ai_opportunity_score,
        ai_suggested_angle,
        category,
        is_candidate,
        ignored,
        scraped_at
      FROM posts 
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY quality_score DESC NULLS LAST, created_utc DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `

    // 获取候选帖子数量
    const candidateCountResult = await sql`
      SELECT COUNT(*) as count FROM posts WHERE project_id = ${project_id} AND is_candidate = TRUE
    `
    const candidateCount = parseInt(candidateCountResult.rows[0].count)

    return NextResponse.json({
      success: true,
      data: {
        posts: postsResult.rows,
        total,
        candidateCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
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