import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { downloadDatasetAsCsv } from '@/lib/apify'

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    await initDb()
    const { runId } = params

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Run ID is required'
      }, { status: 400 })
    }

    // 获取运行记录
    const result = await sql`
      SELECT * FROM scraping_runs WHERE id = ${runId}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Run not found'
      }, { status: 404 })
    }

    const run = result.rows[0]

    if (run.status !== 'succeeded' || !run.apify_dataset_id) {
      return NextResponse.json({
        success: false,
        error: 'Run not completed or dataset not available'
      }, { status: 400 })
    }

    // 下载 CSV
    const csvContent = await downloadDatasetAsCsv(run.apify_dataset_id)

    // 返回 CSV 文件
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="reddit_${run.phase}_${run.query.replace(/\s+/g, '_')}.csv"`
      }
    })

  } catch (error) {
    console.error('Error downloading CSV:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download CSV'
    }, { status: 500 })
  }
}