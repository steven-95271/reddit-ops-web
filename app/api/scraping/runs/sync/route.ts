import { NextRequest, NextResponse } from 'next/server'
import { syncScrapingRuns } from '@/lib/scraping-runs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, batchId, runIds } = body as {
      projectId?: string
      batchId?: string
      runIds?: string[]
    }

    if (!projectId && !batchId && (!runIds || runIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'projectId, batchId, or runIds is required' },
        { status: 400 }
      )
    }

    const syncResult = await syncScrapingRuns(
      runIds && runIds.length > 0
        ? { runIds }
        : batchId
          ? { batchId }
          : { projectId: projectId! }
    )

    const stats = {
      total: syncResult.runs.length,
      pending: syncResult.runs.filter((run) => run.status === 'pending').length,
      running: syncResult.runs.filter((run) => run.status === 'running').length,
      succeeded: syncResult.runs.filter((run) => run.status === 'succeeded').length,
      failed: syncResult.runs.filter((run) => run.status === 'failed').length,
    }

    return NextResponse.json({
      success: true,
      data: {
        runs: syncResult.runs,
        stats,
        summary: syncResult.summary,
      },
    })
  } catch (error) {
    console.error('[POST /api/scraping/runs/sync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync scraping runs',
      },
      { status: 500 }
    )
  }
}
