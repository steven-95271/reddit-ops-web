import { NextRequest, NextResponse } from 'next/server'
import { getScrapingStatus } from '@/lib/apify'

// GET /api/scraping/[runId] - 查询抓取任务状态
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'runId is required'
      }, { status: 400 })
    }

    // 查询 Apify 任务状态
    const status = await getScrapingStatus(runId)

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Error getting scraping status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scraping status'
    }, { status: 500 })
  }
}
