import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const token = process.env.APIFY_API_TOKEN

  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_API_TOKEN not configured' },
      { status: 500 }
    )
  }

  const { runId } = params

  try {
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    const run = data.data

    console.log('[Status] runId:', runId, 'status:', run?.status)

    return NextResponse.json({
      status: run.status,
      itemCount: run.stats?.itemCount ?? 0,
      costUsd: run.usageTotalUsd ?? 0,
      datasetId: run.defaultDatasetId,
      errorMessage: run.statusMessage ?? null
    })
  } catch (error) {
    console.error('[Status] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    )
  }
}
