import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { calculateHotScore, calculateCompositeScore, classifyGrade, classifyCategory } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

interface PostRow {
  id: string
  project_id: string
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  score: number
  num_comments: number
  created_utc: Date | string | number
  hot_score?: number
  composite_score?: number
  category?: string
  is_candidate?: boolean
  scraped_at?: Date
}

// POST /api/analysis - 对项目的帖子跑评分算法
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { project_id } = body

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 验证项目是否存在
    const projectResult = await sql`SELECT * FROM projects WHERE id = ${project_id}`
    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = projectResult.rows[0]
    
    // 解析 keywords 和 competitors
    const keywords = project.keywords ? JSON.parse(project.keywords) : {}
    const competitors = project.competitor_brands ? JSON.parse(project.competitor_brands) : []

    // 获取该项目所有帖子
    const postsResult = await sql`SELECT * FROM posts WHERE project_id = ${project_id}`
    const posts = postsResult.rows as PostRow[]

    if (posts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No posts found for this project. Please run scraping first.'
      }, { status: 400 })
    }

    // 对每个帖子跑评分和分类
    let updated = 0
    const gradeStats: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 }
    const categoryStats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }

    for (const post of posts) {
      try {
        const hotScore = calculateHotScore(post)
        const compositeScore = calculateCompositeScore(post, keywords)
        const grade = classifyGrade(compositeScore)
        const category = classifyCategory(post, keywords, competitors)

        // 更新数据库
        await sql`
          UPDATE posts 
          SET 
            hot_score = ${hotScore},
            composite_score = ${compositeScore},
            category = ${category}
          WHERE id = ${post.id}
        `

        updated++
        gradeStats[grade] = (gradeStats[grade] || 0) + 1
        categoryStats[category] = (categoryStats[category] || 0) + 1
      } catch (error) {
        console.error(`Error scoring post ${post.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total_posts: posts.length,
        updated,
        grade_stats: gradeStats,
        category_stats: categoryStats
      }
    })

  } catch (error) {
    console.error('Error running analysis:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run analysis'
    }, { status: 500 })
  }
}

// GET /api/analysis?project_id=xxx - 返回已评分的帖子列表
export async function GET(request: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const gradeFilter = searchParams.get('grade')
    const categoryFilter = searchParams.get('category')
    const candidateFilter = searchParams.get('is_candidate')
    const sortBy = searchParams.get('sort_by') || 'composite_score'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'project_id query parameter is required'
      }, { status: 400 })
    }

    // 构建查询
    let query = `SELECT * FROM posts WHERE project_id = $1`
    const values: any[] = [projectId]
    let paramIndex = 2

    // 筛选条件
    if (gradeFilter) {
      // 根据 grade 过滤，需要计算 composite_score 范围
      const gradeRanges: Record<string, [number, number]> = {
        S: [0.8, 1.0],
        A: [0.6, 0.8],
        B: [0.4, 0.6],
        C: [0, 0.4]
      }
      const range = gradeRanges[gradeFilter]
      if (range) {
        query += ` AND composite_score >= $${paramIndex} AND composite_score < $${paramIndex + 1}`
        values.push(range[0], range[1])
        paramIndex += 2
      }
    }

    if (categoryFilter) {
      query += ` AND category = $${paramIndex}`
      values.push(categoryFilter)
      paramIndex++
    }

    if (candidateFilter !== null) {
      query += ` AND is_candidate = $${paramIndex}`
      values.push(candidateFilter === 'true')
      paramIndex++
    }

    // 排序
    const validSortColumns = ['composite_score', 'hot_score', 'score', 'num_comments', 'created_utc']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'composite_score'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'
    query += ` ORDER BY ${sortColumn} ${order}`

    const result = await sql.query(query, values)

    // 为每个帖子添加 grade
    const posts = result.rows.map((post: any) => ({
      ...post,
      grade: classifyGrade(post.composite_score || 0)
    }))

    return NextResponse.json({
      success: true,
      data: posts
    })

  } catch (error) {
    console.error('Error fetching analysis:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analysis'
    }, { status: 500 })
  }
}
