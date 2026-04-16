import { NextRequest, NextResponse } from 'next/server'
import { utils, write } from 'xlsx'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type ExportPostRow = {
  id: string
  project_id: string
  scraping_run_id: string | null
  apify_run_id: string | null
  batch_id: string | null
  phase: string | null
  keyword: string | null
  reddit_id: string | null
  subreddit: string
  title: string
  body: string | null
  author: string | null
  url: string | null
  reddit_url: string | null
  score: number | null
  upvotes: number | null
  num_comments: number | null
  comments: number | null
  quality_score: number | null
  ai_relevance_score: number | null
  ai_intent_score: number | null
  ai_opportunity_score: number | null
  ai_suggested_angle: string | null
  category: string | null
  is_candidate: boolean | null
  ignored: boolean | null
  created_utc: string | null
  created_at_reddit: string | null
  scraped_at: string | null
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]

  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    await initDb()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const format = (searchParams.get('format') || 'csv').toLowerCase()

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'project_id is required' },
        { status: 400 }
      )
    }

    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'format must be csv or xlsx' },
        { status: 400 }
      )
    }

    const projectResult = await sql<{ id: string; name: string; product_name: string | null }>`
      SELECT id, name, product_name
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `

    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const postsResult = await sql<ExportPostRow>`
      SELECT
        id,
        project_id,
        scraping_run_id,
        apify_run_id,
        batch_id,
        phase,
        keyword,
        reddit_id,
        subreddit,
        title,
        body,
        author,
        url,
        reddit_url,
        score,
        upvotes,
        num_comments,
        comments,
        quality_score,
        ai_relevance_score,
        ai_intent_score,
        ai_opportunity_score,
        ai_suggested_angle,
        category,
        COALESCE(is_candidate, FALSE) AS is_candidate,
        COALESCE(ignored, FALSE) AS ignored,
        created_utc,
        created_at_reddit,
        scraped_at
      FROM posts
      WHERE project_id = ${projectId}
      ORDER BY created_utc DESC NULLS LAST, scraped_at DESC NULLS LAST
    `

    const exportRows = postsResult.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      scraping_run_id: row.scraping_run_id,
      apify_run_id: row.apify_run_id,
      batch_id: row.batch_id,
      phase: row.phase,
      keyword: row.keyword,
      reddit_id: row.reddit_id,
      subreddit: row.subreddit,
      title: row.title,
      body: row.body,
      author: row.author,
      url: row.url,
      reddit_url: row.reddit_url,
      score: row.score,
      upvotes: row.upvotes,
      num_comments: row.num_comments,
      comments: row.comments,
      quality_score: row.quality_score,
      ai_relevance_score: row.ai_relevance_score,
      ai_intent_score: row.ai_intent_score,
      ai_opportunity_score: row.ai_opportunity_score,
      ai_suggested_angle: row.ai_suggested_angle,
      category: row.category,
      is_candidate: row.is_candidate,
      ignored: row.ignored,
      created_utc: row.created_utc,
      created_at_reddit: row.created_at_reddit,
      scraped_at: row.scraped_at,
    }))

    const project = projectResult.rows[0]
    const safeProjectName = (project.name || project.product_name || 'project')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
    const baseFileName = `${safeProjectName || 'project'}_posts_${new Date().toISOString().slice(0, 10)}`

    if (format === 'xlsx') {
      const worksheet = utils.json_to_sheet(exportRows)
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, 'posts')
      const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseFileName}.xlsx"`,
        },
      })
    }

    const csvContent = buildCsv(exportRows)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseFileName}.csv"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/posts/export] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export posts',
      },
      { status: 500 }
    )
  }
}
