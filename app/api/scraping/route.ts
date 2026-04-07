import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { startScraping } from '@/lib/apify'

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { project_id, time_range, max_posts, sort } = body

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    const validTimeRanges = ['24h', '7d', '30d']
    const validSortBy = ['hot', 'new', 'top']
    
    if (time_range && !validTimeRanges.includes(time_range)) {
      return NextResponse.json({
        success: false,
        error: 'time_range must be one of: 24h, 7d, 30d'
      }, { status: 400 })
    }

    if (sort && !validSortBy.includes(sort)) {
      return NextResponse.json({
        success: false,
        error: 'sort must be one of: hot, new, top'
      }, { status: 400 })
    }

    const result = await sql`SELECT * FROM projects WHERE id = ${project_id}`

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = result.rows[0]
    const keywords = project.keywords ? JSON.parse(project.keywords) : {}

    // 构建四阶段搜索查询
    const phases = ['phase1_brand', 'phase2_competitor', 'phase3_scene_pain', 'phase4_subreddits']
    const allQueries: string[] = []

    phases.forEach(phase => {
      if (phase === 'phase4_subreddits') {
        const targets = keywords[phase]?.targets || []
        targets.forEach((target: any) => {
          target.search_within?.forEach((term: string) => {
            allQueries.push(`${term} subreddit:${target.subreddit}`)
          })
        })
      } else {
        const queries = keywords[phase]?.queries || []
        allQueries.push(...queries)
      }
    })

    if (allQueries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No search queries configured. Please run AI expansion first.'
      }, { status: 400 })
    }

    const subreddits = project.subreddits ? JSON.parse(project.subreddits) : {}
    const allSubreddits: string[] = [
      ...(subreddits.high || []).map((s: any) => s.name),
      ...(subreddits.medium || []).map((s: any) => s.name)
    ]

    const runId = await startScraping({
      subreddits: allSubreddits,
      keywords: allQueries,
      time_range: time_range || '7d',
      max_posts: max_posts || 100,
      sort_by: sort || 'hot'
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
