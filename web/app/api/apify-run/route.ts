import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN |
const ACTOR_ID = 'aYMxR9AqRjxmgzcwB'

interface ScrapeConfig {
  search_query: string
  search_subreddit: string
  reddit_urls: string[]
  sort_order: string
  time_filter: string
  max_posts: number
  include_comments: boolean
  max_comments: number
  comment_depth: number
  filter_keywords: string[]
  deduplicate: boolean
}

// Generate meaningful name from config
function generateScrapeName(config: ScrapeConfig): string {
  const parts: string[] = []
  
  if (config.search_query) {
    parts.push(config.search_query.substring(0, 20))
  }
  if (config.search_subreddit) {
    parts.push(`r/${config.search_subreddit}`)
  }
  parts.push(config.sort_order)
  if (config.time_filter !== 'all') {
    parts.push(config.time_filter)
  }
  
  return parts.join('_') || 'scrape'
}

// Convert our config to Apify actor input format
function buildApifyInput(config: ScrapeConfig) {
  const urls: string[] = []
  
  // Build URLs for scraping
  if (config.search_query && config.search_subreddit) {
    urls.push(`https://www.reddit.com/r/${config.search_subreddit}/search/?q=${encodeURIComponent(config.search_query)}&sort=${config.sort_order}`)
  } else if (config.search_query) {
    urls.push(`https://www.reddit.com/search/?q=${encodeURIComponent(config.search_query)}&sort=${config.sort_order}`)
  } else if (config.search_subreddit) {
    urls.push(`https://www.reddit.com/r/${config.search_subreddit}/${config.sort_order}/`)
  }
  
  if (config.reddit_urls && config.reddit_urls.length > 0) {
    urls.push(...config.reddit_urls)
  }
  
  // Build Apify input - match actor's expected fields exactly
  const apifyInput: any = {
    // Actor expects these exact field names
    searchQuery: config.search_query || undefined,
    subreddit: config.search_subreddit || undefined,
    sort: config.sort_order || 'relevance',
    timeFilter: config.time_filter || 'all',
    
    // Other actor fields from observed input schema
    resultsLimit: config.max_posts || 100,
    includeComments: config.include_comments,
    maxCommentsPerPost: config.max_comments || 30,
    commentDepth: config.comment_depth || 3,
    deduplicatePosts: config.deduplicate,
    filterKeywords: config.filter_keywords || [],
    filterKeywordMode: 'any',
    maxRequestRetries: 5,
    
    // Fallback URLs if no search query
    urls: urls.length > 0 ? urls : ['https://www.reddit.com/r/technology/hot/'],
  }
  
  // Remove undefined values
  Object.keys(apifyInput).forEach(key => apifyInput[key] === undefined && delete apifyInput[key])
  
  return apifyInput
}

// Save scrape history to database
async function saveScrapeHistory(params: {
  projectId: string
  apifyRunId: string
  name: string
  config: ScrapeConfig
  datasetId?: string
}) {
  try {
    const id = `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const now = new Date().toISOString()
    
    await sql.query(
      `INSERT INTO scrape_history (
        id, project_id, apify_run_id, name, 
        search_query, search_subreddit, sort_order, time_filter, max_posts,
        status, dataset_id, started_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id, 
        params.projectId, 
        params.apifyRunId, 
        params.name,
        params.config.search_query || null, 
        params.config.search_subreddit || null,
        params.config.sort_order, 
        params.config.time_filter, 
        params.config.max_posts,
        'running', 
        params.datasetId || null, 
        now, 
        now
      ]
    )
    
    return id
  } catch (e) {
    console.error('Failed to save scrape history:', e)
    return null
  }
}

// Update scrape history status
async function updateScrapeHistory(apifyRunId: string, updates: {
  status?: string
  dataset_id?: string
  finished_at?: string
  posts_count?: number
}) {
  try {
    const setClauses: string[] = []
    const values: any[] = []
    let idx = 1
    
    if (updates.status) {
      setClauses.push(`status = $${idx++}`)
      values.push(updates.status)
    }
    if (updates.dataset_id) {
      setClauses.push(`dataset_id = $${idx++}`)
      values.push(updates.dataset_id)
    }
    if (updates.finished_at) {
      setClauses.push(`finished_at = $${idx++}`)
      values.push(updates.finished_at)
    }
    if (updates.posts_count !== undefined) {
      setClauses.push(`posts_count = $${idx++}`)
      values.push(updates.posts_count)
    }
    
    if (setClauses.length > 0) {
      values.push(apifyRunId)
      await sql.query(
        `UPDATE scrape_history SET ${setClauses.join(', ')} WHERE apify_run_id = $${idx}`,
        values
      )
    }
  } catch (e) {
    console.error('Failed to update scrape history:', e)
  }
}

// POST /api/apify-run
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, config } = body as { project_id: string; config: ScrapeConfig }
    
    console.log('Starting Apify scrape:', {
      project_id,
      config,
      timestamp: new Date().toISOString()
    })
    
    const apifyInput = buildApifyInput(config)
    const scrapeName = generateScrapeName(config)
    
    console.log('Apify input:', JSON.stringify(apifyInput, null, 2))
    
    const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apifyInput)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Apify API error:', response.status, errorText)
      return NextResponse.json({ 
        error: 'Failed to start Apify scrape',
        details: errorText 
      }, { status: 500 })
    }
    
    const runData = await response.json()
    const runId = runData.data.id
    const datasetId = runData.data.defaultDatasetId
    
    console.log('Apify run started:', { runId, datasetId, status: runData.data.status })
    
    // Save to our database
    const historyId = await saveScrapeHistory({
      projectId: project_id || 'default',
      apifyRunId: runId,
      name: scrapeName,
      config,
      datasetId
    })
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Scrape task started',
      run_id: runId,
      dataset_id: datasetId,
      history_id: historyId,
      name: scrapeName,
      run_url: `https://console.apify.com/view/runs/${runId}`,
      status: runData.data.status
    })
    
  } catch (error) {
    console.error('Error starting scrape:', error)
    return NextResponse.json({ error: 'Failed to start scrape' }, { status: 500 })
  }
}

// GET /api/apify-run?run_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('run_id')
  
  if (!runId) {
    return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
  }
  
  try {
    const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`, {
      signal: AbortSignal.timeout(10000) // 10秒超时
    })
    
    if (!response.ok) {
      // Apify API 错误，返回运行中状态
      return NextResponse.json({
        id: runId,
        status: 'RUNNING',
        message: 'Unable to fetch status from Apify, job may still be running'
      })
    }
    
    const runData = await response.json()
    
    // Update our history record
    await updateScrapeHistory(runId, {
      status: runData.data.status,
      dataset_id: runData.data.defaultDatasetId,
      finished_at: runData.data.finishedAt
    })
    
    // Get name from our history
    let name = null
    try {
      const historyResult = await sql.query(
        'SELECT name FROM scrape_history WHERE apify_run_id = $1 LIMIT 1',
        [runId]
      )
      if (historyResult.rows && historyResult.rows.length > 0) {
        name = historyResult.rows[0].name
      }
    } catch (e) {}
    
    return NextResponse.json({
      id: runData.data.id,
      name,
      status: runData.data.status,
      startedAt: runData.data.startedAt,
      finishedAt: runData.data.finishedAt,
      stats: runData.data.stats,
      datasetId: runData.data.defaultDatasetId,
      consoleUrl: `https://console.apify.com/view/runs/${runId}`
    })
    
  } catch (error: any) {
    console.error('Error getting run status:', error)
    
    // 即使出错也返回运行中状态，让前端继续等待
    return NextResponse.json({
      id: runId,
      status: 'RUNNING',
      message: error.message || 'Status check failed, job may still be running'
    })
  }
}