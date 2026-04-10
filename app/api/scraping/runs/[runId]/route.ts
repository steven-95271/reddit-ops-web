import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    await initDb()
    const { runId } = params
    const body = await request.json()

    const { status, item_count, cost_usd, dataset_id, finished_at } = body

    await sql`
      UPDATE scraping_runs
      SET 
        status = ${status},
        total_posts = ${item_count ?? 0},
        cost_usd = ${cost_usd ?? 0},
        apify_dataset_id = ${dataset_id ?? null},
        completed_at = ${finished_at ?? new Date().toISOString()}
      WHERE apify_run_id = ${runId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/scraping/runs/[runId]] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update run' },
      { status: 500 }
    )
  }
}