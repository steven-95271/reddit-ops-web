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
    const { project_id, phase_configs } = body

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 获取项目信息
    const result = await sql`SELECT * FROM projects WHERE id = ${project_id}`
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = result.rows[0]
    const keywords = project.keywords ? JSON.parse(project.keywords) : {}

    // 生成 batch_id
      const batchId = generateId()

    // 为每个词创建运行记录并启动任务
    const runs: Array<{
      id: string
      phase: string
      query: string
      subreddit?: string
      status: string
    }> = []

    // Phase 1-3: 每个 query 一个 run
    const phases = ['phase1_brand', 'phase2_competitor', 'phase3_scene_pain']
    for (const phase of phases) {
      const phaseData = keywords[phase]
      if (!phaseData?.queries?.length) continue

      const config = phase_configs?.[phase] || {
        time_range: '7d',
        max_posts: 100,
        sort_by: 'hot'
      }

      for (const query of phaseData.queries) {
        const runId = generateId()
        
        // 创建运行记录
        await sql`
          INSERT INTO scraping_runs (
            id, batch_id, project_id, phase, query, status, params, created_at
          ) VALUES (
            ${runId}, ${batchId}, ${project_id}, ${phase}, ${query}, 
            'pending', ${JSON.stringify(config)}, NOW()
          )
        `

        try {
          // 启动 Apify 任务
          const apifyRunId = await startScrapingSingle({
            keywords: [query],
            subreddits: [],
            time_range: config.time_range,
            max_posts: config.max_posts,
            sort_by: config.sort_by
          })

          // 更新 apify_run_id
          await sql`
            UPDATE scraping_runs 
            SET apify_run_id = ${apifyRunId}, status = 'running', started_at = NOW()
            WHERE id = ${runId}
          `

          runs.push({ id: runId, phase, query, status: 'running' })
        } catch (error) {
          console.error(`Error starting scraping for ${query}:`, error)
          await sql`
            UPDATE scraping_runs 
            SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}
            WHERE id = ${runId}
          `
          runs.push({ id: runId, phase, query, status: 'failed' })
        }
      }
    }

    // Phase 4: 每个 subreddit 的每个 search_within 关键词都单独启动一个 run
    const phase4Data = keywords['phase4_subreddits']
    if (phase4Data?.targets?.length) {
      const config = phase_configs?.['phase4_subreddits'] || {
        time_range: '7d',
        max_posts: 100,
        sort_by: 'hot'
      }

      for (const target of phase4Data.targets) {
        const subreddit = target.subreddit
        const searchKeywords = target.search_within || []

        // 如果没有 search_within，使用空字符串作为关键词
        if (searchKeywords.length === 0) {
          searchKeywords.push('')
        }

        // 为每个 search_within 关键词单独启动一个 run
        for (const keyword of searchKeywords) {
          const runId = generateId()

          // 创建运行记录
          await sql`
            INSERT INTO scraping_runs (
              id, batch_id, project_id, phase, query, subreddit, status, params, created_at
            ) VALUES (
              ${runId}, ${batchId}, ${project_id}, 'phase4_subreddits', ${keyword}, ${subreddit},
              'pending', ${JSON.stringify({ ...config, search_within: target.search_within || [] })}, NOW()
            )
          `

          try {
            // 启动 Apify 任务
            const apifyRunId = await startScrapingSingle({
              keywords: keyword ? [keyword] : [],
              subreddits: [subreddit],
              time_range: config.time_range,
              max_posts: config.max_posts,
              sort_by: config.sort_by
            })

            // 更新 apify_run_id
            await sql`
              UPDATE scraping_runs 
              SET apify_run_id = ${apifyRunId}, status = 'running', started_at = NOW()
              WHERE id = ${runId}
            `

            runs.push({ id: runId, phase: 'phase4_subreddits', query: keyword, subreddit, status: 'running' })
          } catch (error) {
            console.error(`Error starting scraping for ${subreddit}/${keyword}:`, error)
            await sql`
              UPDATE scraping_runs 
              SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}
              WHERE id = ${runId}
            `
            runs.push({ id: runId, phase: 'phase4_subreddits', query: keyword, subreddit, status: 'failed' })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        total_runs: runs.length,
        runs
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error starting batch scraping:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start batch scraping'
    }, { status: 500 })
  }
}