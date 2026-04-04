import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { startScraping } from '@/lib/apify'

// POST /api/scraping - 启动抓取任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, time_range, max_posts, sort_by } = body

    // 验证必填字段
    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 验证参数有效性
    const validTimeRanges = ['24h', '7d', '30d']
    const validSortBy = ['hot', 'new', 'top']
    
    if (time_range && !validTimeRanges.includes(time_range)) {
      return NextResponse.json({
        success: false,
        error: 'time_range must be one of: 24h, 7d, 30d'
      }, { status: 400 })
    }

    if (sort_by && !validSortBy.includes(sort_by)) {
      return NextResponse.json({
        success: false,
        error: 'sort_by must be one of: hot, new, top'
      }, { status: 400 })
    }

    // 从数据库读取项目信息
    const result = await sql`SELECT * FROM projects WHERE id = ${project_id}`

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = result.rows[0]

    // 解析 keywords 和 subreddits
    const keywords = project.keywords ? JSON.parse(project.keywords) : {}
    const subreddits = project.subreddits ? JSON.parse(project.subreddits) : {}

    // 提取所有关键词
    const allKeywords: string[] = [
      ...(keywords.core || []),
      ...(keywords.longTail || []),
      ...(keywords.competitor || []),
      ...(keywords.scenario || []),
      ...(keywords.seed || [])
    ]

    // 提取所有 subreddits
    const allSubreddits: string[] = [
      ...(subreddits.high || []).map((s: any) => s.name),
      ...(subreddits.medium || []).map((s: any) => s.name),
      ...(subreddits.low || []).map((s: any) => s.name)
    ]

    // 去重
    const uniqueKeywords = Array.from(new Set(allKeywords)).filter(Boolean)
    const uniqueSubreddits = Array.from(new Set(allSubreddits)).filter(Boolean)

    if (uniqueKeywords.length === 0 && uniqueSubreddits.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No keywords or subreddits configured for this project. Please run AI expansion first.'
      }, { status: 400 })
    }

    // 启动 Apify 抓取任务
    const runId = await startScraping({
      subreddits: uniqueSubreddits,
      keywords: uniqueKeywords,
      time_range: time_range || '7d',
      max_posts: max_posts || 100,
      sort_by: sort_by || 'hot'
    })

    return NextResponse.json({
      success: true,
      data: { run_id: runId }
    }, { status: 201 })

  } catch (error) {
    console.error('Error starting scraping:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start scraping'
    }, { status: 500 })
  }
}
