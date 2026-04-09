import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { startScrapingSingle } from '@/lib/apify'
import crypto from 'crypto'

function generateId(): string {
  return crypto.randomUUID()
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { project_id, phase, query, subreddit, config } = body

    if (!project_id || !phase || !query) {
      return NextResponse.json({
        success: false,
        error: 'project_id, phase, and query are required'
      }, { status: 400 })
    }

    const runId = generateId()
    const batchId = generateId()

    await sql`
      INSERT INTO scraping_runs (
        id, batch_id, project_id, phase, query, subreddit, status, params, created_at
      ) VALUES (
        ${runId}, ${batchId}, ${project_id}, ${phase}, ${query}, ${subreddit || null},
        'pending', ${JSON.stringify(config || {})}, NOW()
      )
    `

    try {
      const apifyRunId = await startScrapingSingle({
        keywords: [query],
        subreddits: subreddit ? [subreddit] : [],
        time_range: config?.time_range || '7d',
        max_posts: config?.max_posts || 100,
        sort_by: config?.sort_by || 'hot'
      })

      await sql`
        UPDATE scraping_runs 
        SET apify_run_id = ${apifyRunId}, status = 'running', started_at = NOW()
        WHERE id = ${runId}
      `

      return NextResponse.json({
        success: true,
        data: {
          run_id: runId,
          apify_run_id: apifyRunId
        }
      })
    } catch (error) {
      await sql`
        UPDATE scraping_runs 
        SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}
        WHERE id = ${runId}
      `
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start scraping'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error starting single scraping:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start scraping'
    }, { status: 500 })
  }
}
