import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * Vercel Cron API - 每日流水线触发器
 * 
 * 在 vercel.json 中配置:
 * {
 *   "crons": [{
 *     "path": "/api/pipeline/cron",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 * 
 * 每天北京时间 9:00 自动运行所有启用自动抓取的项目
 */

export async function GET(request: NextRequest) {
  // 验证请求来源 (Vercel Cron 会添加特定header)
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET || 'dev-secret'
  
  if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron] Starting daily pipeline run...')

    // 获取所有启用自动抓取的项目
    const projectsResult = await sql`
      SELECT id, name, search_query, subreddits, scrape_schedule_time, scrape_schedule_timezone
      FROM projects
      WHERE auto_scrape_enabled = 1
    `

    const results = []

    for (const project of projectsResult.rows) {
      try {
        console.log(`[Cron] Running pipeline for project: ${project.name}`)

        // 调用主流水线API
        const pipelineRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pipeline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            use_mock: process.env.NODE_ENV !== 'production',
          }),
        })

        const pipelineData = await pipelineRes.json()
        results.push({
          project_id: project.id,
          project_name: project.name,
          success: pipelineData.success,
          message: pipelineData.message,
        })

        console.log(`[Cron] Pipeline completed for ${project.name}: ${pipelineData.success ? 'OK' : 'FAILED'}`)
      } catch (error) {
        console.error(`[Cron] Pipeline failed for ${project.name}:`, error)
        results.push({
          project_id: project.id,
          project_name: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      message: `Pipeline run completed: ${successCount}/${results.length} projects succeeded`,
      timestamp: new Date().toISOString(),
      results,
    })

  } catch (error) {
    console.error('[Cron] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

// Vercel Cron 需要支持 POST 方法
export async function POST(request: NextRequest) {
  return GET(request)
}
