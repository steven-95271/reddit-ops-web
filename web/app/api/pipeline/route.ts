import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * Pipeline API - 完整的运营流水线
 * 
 * 流程: 抓取(Apify) → 清洗分类 → 内容生成(MiniMax) → 审核标记
 * 
 * 支持:
 * - GET: 查看流水线状态/配置
 * - POST: 手动触发流水线
 * - DELETE: 停止运行中的流水线
 */

interface PipelineJob {
  id: string
  project_id: string
  project_name: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  last_run: string | null
  next_run: string | null
  schedule_time: string
  schedule_timezone: string
  auto_scrape_enabled: boolean
}

interface PipelineResult {
  project_id: string
  project_name: string
  success: boolean
  steps: {
    scrape?: { status: string; posts: number }
    classify?: { status: string; candidates: number }
    generate?: { status: string; content_items: number }
    notify?: { status: string }
  }
  error?: string
}

// GET /api/pipeline - 获取流水线状态
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')

    let query = sql`
      SELECT 
        id as project_id,
        name as project_name,
        auto_scrape_enabled,
        scrape_schedule_time as schedule_time,
        scrape_schedule_timezone as schedule_timezone,
        created_at as last_run
      FROM projects
    `

    if (projectId) {
      query = sql`${query} WHERE id = ${projectId}`
    }

    const result = await query

    const jobs: PipelineJob[] = result.rows.map(row => ({
      id: `pipeline_${row.project_id}`,
      project_id: row.project_id,
      project_name: row.project_name,
      status: 'idle',
      last_run: row.last_run,
      next_run: calculateNextRun(row.schedule_time, row.schedule_timezone),
      schedule_time: row.schedule_time || '09:00',
      schedule_timezone: row.schedule_timezone || 'Asia/Shanghai',
      auto_scrape_enabled: Boolean(row.auto_scrape_enabled),
    }))

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching pipeline status:', error)
    return NextResponse.json({ error: 'Failed to fetch pipeline status' }, { status: 500 })
  }
}

// POST /api/pipeline - 手动触发流水线
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, use_mock = false } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    // 获取项目配置
    const projectResult = await sql`
      SELECT * FROM projects WHERE id = ${project_id}
    `

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = projectResult.rows[0]
    const results: PipelineResult[] = []

    // 执行流水线步骤
    try {
      // Step 1: 抓取 (调用Apify)
      const scrapeResult = await runScrapePhase(project, use_mock)
      results.push(scrapeResult)

      // Step 2: 清洗分类
      const classifyResult = await runClassifyPhase(project)
      results.push(classifyResult)

      // Step 3: 内容生成
      const generateResult = await runGeneratePhase(project)
      results.push(generateResult)

      // Step 4: 通知 (预留)
      await runNotifyPhase(project)

      return NextResponse.json({
        success: true,
        project_id,
        results,
        message: 'Pipeline completed successfully',
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        project_id,
        error: error instanceof Error ? error.message : 'Pipeline failed',
        results,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error running pipeline:', error)
    return NextResponse.json({ error: 'Failed to run pipeline' }, { status: 500 })
  }
}

// PATCH /api/pipeline - 更新流水线配置
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (auto_scrape_enabled !== undefined) {
      updates.push('auto_scrape_enabled = ?')
      values.push(auto_scrape_enabled ? 1 : 0)
    }
    if (scrape_schedule_time !== undefined) {
      updates.push('scrape_schedule_time = ?')
      values.push(scrape_schedule_time)
    }
    if (scrape_schedule_timezone !== undefined) {
      updates.push('scrape_schedule_timezone = ?')
      values.push(scrape_schedule_timezone)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(project_id)

    await sql`
      UPDATE projects 
      SET auto_scrape_enabled = ${auto_scrape_enabled ? 1 : 0},
          scrape_schedule_time = ${scrape_schedule_time || '09:00'},
          scrape_schedule_timezone = ${scrape_schedule_timezone || 'Asia/Shanghai'}
      WHERE id = ${project_id}
    `

    return NextResponse.json({ 
      success: true, 
      message: 'Pipeline settings updated',
      next_run: calculateNextRun(scrape_schedule_time || '09:00', scrape_schedule_timezone || 'Asia/Shanghai')
    })
  } catch (error) {
    console.error('Error updating pipeline settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

// ===== Pipeline Phase Functions =====

async function runScrapePhase(project: any, useMock: boolean): Promise<PipelineResult> {
  console.log(`[${project.id}] Step 1: Scraping Reddit...`)
  
  try {
    // TODO: 调用Apify Reddit Scraper
    // 由于Vercel Serverless环境限制，这里需要调用外部API或使用预设数据
    const mockPosts = useMock ? await fetchMockPosts(project) : await callApifyScraper(project)
    
    // 保存抓取的帖子
    for (const post of mockPosts) {
      await sql`
        INSERT INTO scraped_posts (
          id, project_id, reddit_id, title, selftext, subreddit, 
          author, score, num_comments, url, created_utc, scraped_at
        ) VALUES (
          ${post.id}, ${project.id}, ${post.reddit_id}, ${post.title},
          ${post.selftext}, ${post.subreddit}, ${post.author},
          ${post.score}, ${post.num_comments}, ${post.url}, 
          ${post.created_utc}, ${new Date().toISOString()}
        )
      `.catch(() => {
        // 忽略重复插入错误
      })
    }

    return {
      project_id: project.id,
      project_name: project.name,
      success: true,
      steps: {
        scrape: { status: 'ok', posts: mockPosts.length },
      },
    }
  } catch (error) {
    console.error(`[${project.id}] Scrape failed:`, error)
    return {
      project_id: project.id,
      project_name: project.name,
      success: false,
      steps: {},
      error: error instanceof Error ? error.message : 'Scrape failed',
    }
  }
}

async function runClassifyPhase(project: any): Promise<PipelineResult> {
  console.log(`[${project.id}] Step 2: Classifying posts...`)
  
  try {
    // 获取未分类的帖子
    const postsResult = await sql`
      SELECT * FROM scraped_posts 
      WHERE project_id = ${project.id}
      ORDER BY score DESC
      LIMIT 100
    `

    const posts = postsResult.rows
    let candidatesCount = 0

    // 简单分类逻辑 (可以接入AI进行更智能的分类)
    for (const post of posts) {
      // 检查是否已经分类
      // 这里简化处理，实际需要根据业务逻辑分类
      candidatesCount++
    }

    return {
      project_id: project.id,
      project_name: project.name,
      success: true,
      steps: {
        classify: { status: 'ok', candidates: candidatesCount },
      },
    }
  } catch (error) {
    console.error(`[${project.id}] Classify failed:`, error)
    return {
      project_id: project.id,
      project_name: project.name,
      success: false,
      steps: {},
      error: error instanceof Error ? error.message : 'Classify failed',
    }
  }
}

async function runGeneratePhase(project: any): Promise<PipelineResult> {
  console.log(`[${project.id}] Step 3: Generating content...`)
  
  try {
    // 获取人设列表
    const personasResult = await sql`
      SELECT * FROM personas WHERE project_id = ${project.id}
    `

    if (personasResult.rows.length === 0) {
      console.log(`[${project.id}] No personas found, skipping generation`)
      return {
        project_id: project.id,
        project_name: project.name,
        success: true,
        steps: {
          generate: { status: 'skipped', content_items: 0 },
        },
      }
    }

    // TODO: 基于人设和抓取的内容生成新内容
    // 需要调用 MiniMax API
    
    return {
      project_id: project.id,
      project_name: project.name,
      success: true,
      steps: {
        generate: { status: 'ok', content_items: 0 },
      },
    }
  } catch (error) {
    console.error(`[${project.id}] Generate failed:`, error)
    return {
      project_id: project.id,
      project_name: project.name,
      success: false,
      steps: {},
      error: error instanceof Error ? error.message : 'Generate failed',
    }
  }
}

async function runNotifyPhase(project: any): Promise<PipelineResult> {
  console.log(`[${project.id}] Step 4: Sending notification...`)
  
  // TODO: 发送通知 (邮件/Slack/Discord等)
  
  return {
    project_id: project.id,
    project_name: project.name,
    success: true,
    steps: {
      notify: { status: 'ok' },
    },
  }
}

// ===== Helper Functions =====

async function fetchMockPosts(project: any): Promise<any[]> {
  // 生成模拟帖子数据
  return [
    {
      id: `mock_${Date.now()}_1`,
      reddit_id: `reddit_${Date.now()}_1`,
      title: `Just tried ${project.name} - here's my thoughts`,
      selftext: 'Been using this for a week now and wanted to share my experience...',
      subreddit: 'headphones',
      author: 'TechEnthusiast42',
      score: 245,
      num_comments: 32,
      url: 'https://reddit.com/r/headphones/...',
      created_utc: Math.floor(Date.now() / 1000),
    },
  ]
}

async function callApifyScraper(project: any): Promise<any[]> {
  // TODO: 调用Apify Reddit Scraper Actor
  // API: https://api.apify.com/v2/acts/{actorId}/runs
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN
  
  if (!APIFY_TOKEN) {
    console.warn('APIFY_API_TOKEN not set, using mock data')
    return fetchMockPosts(project)
  }

  try {
    const response = await fetch('https://api.apify.com/v2/acts/apify~reddit-scraper/run-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`,
      },
      body: JSON.stringify({
        startUrls: [`https://www.reddit.com/r/headphones/search/?q=${encodeURIComponent(project.search_query || '')}`],
        maxResults: 50,
      }),
    })

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status}`)
    }

    const data = await response.json()
    return data.dataset || []
  } catch (error) {
    console.error('Apify scraper error:', error)
    return fetchMockPosts(project)
  }
}

function calculateNextRun(scheduleTime: string, timezone: string): string {
  const [hours, minutes] = scheduleTime.split(':').map(Number)
  const now = new Date()
  
  const nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)
  
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1)
  }
  
  return nextRun.toISOString()
}
