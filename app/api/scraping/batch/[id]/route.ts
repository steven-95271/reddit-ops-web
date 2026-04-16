import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { getScrapingStatus, getRunDatasetId } from '@/lib/apify'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Batch ID is required'
      }, { status: 400 })
    }

    // 获取该 batch 的所有 runs
    const runsResult = await sql`
      SELECT * FROM scraping_runs 
      WHERE batch_id = ${id}
      ORDER BY created_at ASC
    `

    if (runsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 })
    }

    // 更新每个 running 状态的任务
    const updatedRuns = await Promise.all(
      runsResult.rows.map(async (run) => {
        if (run.status === 'running' && run.apify_run_id) {
          try {
            const status = await getScrapingStatus(run.apify_run_id)
            console.log(`[Batch ${id}] Run ${run.id} (${run.apify_run_id}) status: ${status.status}`)
            
            if (status.status === 'SUCCEEDED') {
              // 获取 dataset_id
              const datasetId = await getRunDatasetId(run.apify_run_id)
              
              await sql`
                UPDATE scraping_runs 
                SET status = 'succeeded', 
                    apify_dataset_id = ${datasetId},
                    completed_at = NOW()
                WHERE id = ${run.id}
              `
              return { ...run, status: 'succeeded', apify_dataset_id: datasetId }
            } else if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(status.status)) {
              console.log(`[Batch ${id}] Run ${run.id} failed with status: ${status.status}, error: ${status.errorMessage}`)
              await sql`
                UPDATE scraping_runs 
                SET status = 'failed', 
                    error_message = ${status.errorMessage || status.status},
                    completed_at = NOW()
                WHERE id = ${run.id}
              `
              return { ...run, status: 'failed', error_message: status.errorMessage }
            } else {
              // 仍在运行中
              return { ...run, apify_status: status.status }
            }
          } catch (error) {
            console.error(`Error checking status for run ${run.id}:`, error)
            return run
          }
        }
        return run
      })
    )

    // 统计状态
    const stats = {
      total: updatedRuns.length,
      pending: updatedRuns.filter(r => r.status === 'pending').length,
      running: updatedRuns.filter(r => r.status === 'running').length,
      succeeded: updatedRuns.filter(r => r.status === 'succeeded').length,
      failed: updatedRuns.filter(r => r.status === 'failed').length
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: id,
        stats,
        runs: updatedRuns.map(run => ({
          id: run.id,
          phase: run.phase,
          query: run.query,
          subreddit: run.subreddit,
          status: run.status,
          params: run.params ? JSON.parse(run.params) : null,
          total_posts: run.total_posts,
          inserted_posts: run.inserted_posts,
          skipped_posts: run.skipped_posts,
          apify_run_id: run.apify_run_id,
          apify_dataset_id: run.apify_dataset_id,
          error_message: run.error_message,
          started_at: run.started_at,
          completed_at: run.completed_at
        }))
      }
    })

  } catch (error) {
    console.error('Error getting batch status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get batch status'
    }, { status: 500 })
  }
}