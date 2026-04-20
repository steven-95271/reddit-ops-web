import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { startScrapingSingle, AdvancedApifyConfig } from '@/lib/apify'
import crypto from 'crypto'

function generateId(): string {
  return crypto.randomUUID()
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { project_id, phase_configs, items, advanced_config } = body

    if (!project_id || !items || !Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: 'project_id and items are required'
      }, { status: 400 })
    }

    const batchId = generateId()
    const runs: Array<{
      id: string
      apify_run_id: string | null
      phase: string
      query: string
      subreddit?: string
      status: string
    }> = []

    for (const item of items) {
      const { phase, query, subreddit } = item
      const runId = generateId()

      const config = phase_configs?.[phase] || {
        time_range: '7d',
        max_posts: 100,
        sort_by: 'hot'
      }

      await sql`
        INSERT INTO scraping_runs (
          id, batch_id, project_id, phase, query, subreddit, status, params, created_at
        ) VALUES (
          ${runId}, ${batchId}, ${project_id}, ${phase}, ${query}, ${subreddit || null},
          'pending', ${JSON.stringify({ ...config, advanced_config })}, NOW()
        )
      `

      try {
        const apifyRunId = await startScrapingSingle({
          keywords: [query],
          subreddits: subreddit ? [subreddit] : [],
          time_range: config.time_range,
          max_posts: config.max_posts,
          sort_by: config.sort_by,
          advanced: advanced_config as AdvancedApifyConfig | undefined,
        })

        await sql`
          UPDATE scraping_runs 
          SET apify_run_id = ${apifyRunId}, status = 'running', started_at = NOW()
          WHERE id = ${runId}
        `

        runs.push({ id: runId, apify_run_id: apifyRunId, phase, query, subreddit, status: 'running' })
      } catch (error) {
        await sql`
          UPDATE scraping_runs 
          SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}
          WHERE id = ${runId}
        `
        runs.push({ id: runId, apify_run_id: null, phase, query, subreddit, status: 'failed' })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        total_runs: runs.length,
        runs
      }
    })
  } catch (error) {
    console.error('Error starting custom batch scraping:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start batch scraping'
    }, { status: 500 })
  }
}
