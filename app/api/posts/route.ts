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

    // 为每个筛选条件组合定义查询函数
    const minQualityNum = min_quality ? parseInt(min_quality) : null
    
    // 组合条件：phase + min_quality + time_range + is_candidate + ignored
    // 由于 @vercel/postgres 不支持动态 SQL，我们需要枚举所有条件组合
    
    type QueryResult = {
      rows: any[]
    }
    
    let countResult: QueryResult
    let postsResult: QueryResult
    
    // 简化处理：使用客户端过滤来避免复杂的 SQL 组合
    // 先获取基础数据，然后过滤
    
    // 获取所有帖子（带基本过滤）
    const allPostsResult = await sql`
      SELECT 
        id, reddit_id, subreddit, title, body, author, url,
        score, num_comments, upvote_ratio, created_utc,
        quality_score, ai_relevance_score, ai_intent_score, 
        ai_opportunity_score, ai_suggested_angle, category,
        is_candidate, ignored, scraped_at
      FROM posts 
      WHERE project_id = ${project_id}
      ORDER BY quality_score DESC NULLS LAST, created_utc DESC
    `
    
    // 客户端过滤
    let filteredPosts = allPostsResult.rows
    
    if (minQualityNum !== null) {
      filteredPosts = filteredPosts.filter(post => (post.quality_score || 0) >= minQualityNum)
    }
    
    if (startDateStr) {
      const startDate = new Date(startDateStr)
      filteredPosts = filteredPosts.filter(post => {
        const postDate = new Date(post.created_utc)
        return postDate >= startDate
      })
    }
    
    if (phase) {
      filteredPosts = filteredPosts.filter(post => post.category === phase)
    }
    
    if (is_candidate === 'true') {
      filteredPosts = filteredPosts.filter(post => post.is_candidate === true)
    }
    
    if (ignored === 'true') {
      filteredPosts = filteredPosts.filter(post => post.ignored === true)
    } else if (ignored === 'false') {
      filteredPosts = filteredPosts.filter(post => post.ignored === false)
    }
    
    const total = filteredPosts.length
    
    // 应用分页
    const paginatedPosts = filteredPosts.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        posts: paginatedPosts,
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
