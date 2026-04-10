import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const batchId = searchParams.get('batchId')

    if (!projectId && !batchId) {
      return NextResponse.json(
        { error: 'projectId or batchId is required' },
        { status: 400 }
      )
    }

    let result

    if (batchId) {
      result = await sql`
        SELECT * FROM scraping_runs
        WHERE batch_id = ${batchId}
        ORDER BY created_at ASC
        LIMIT 500
      `
    } else {
      result = await sql`
        SELECT * FROM scraping_runs
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT 200
      `
    }

    const runs = result.rows.map(row => ({
      id: row.id,
      batch_id: row.batch_id,
      phase: row.phase,
      query: row.query,
      subreddit: row.subreddit,
      status: row.status,
      params: row.params ? JSON.parse(row.params) : null,
      total_posts: row.total_posts,
      inserted_posts: row.inserted_posts,
      skipped_posts: row.skipped_posts,
      apify_run_id: row.apify_run_id,
      apify_dataset_id: row.apify_dataset_id,
      error_message: row.error_message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at
    }))

    return NextResponse.json({ runs })
  } catch (error) {
    console.error('[GET /api/scraping/runs] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch runs' },
      { status: 500 }
    )
  }
}