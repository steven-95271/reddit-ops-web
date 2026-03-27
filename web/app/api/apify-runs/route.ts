import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN |
const ACTOR_ID = 'aYMxR9AqRjxmgzcwB'

interface RunInput {
  searchQuery?: string
  sort?: string
  timeFilter?: string
  maxPostsPerSource?: number
  subreddit?: string
}

// Generate name from run input
function generateRunName(input: RunInput): string {
  const parts: string[] = []
  
  if (input.searchQuery) {
    parts.push(input.searchQuery.substring(0, 25))
  }
  if (input.sort) {
    parts.push(input.sort)
  }
  if (input.timeFilter && input.timeFilter !== 'all') {
    parts.push(input.timeFilter)
  }
  
  return parts.join('_') || 'scrape'
}

// Fetch input for a run from key-value store
async function fetchRunInput(keyValueStoreId: string): Promise<RunInput | null> {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/key-value-stores/${keyValueStoreId}/records/INPUT?token=${APIFY_TOKEN}`
    )
    if (response.ok) {
      return await response.json()
    }
  } catch (e) {
    console.error('Failed to fetch run input:', e)
  }
  return null
}

// GET /api/apify-runs?limit=20&offset=0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Get list of runs for this actor
    const response = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}&order=desc`,
      { cache: 'no-store' }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Apify runs API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }
    
    const data = await response.json()
    const apifyRuns = data.data?.items || []
    
    // Get our history names for these runs (from our database)
    const runIds = apifyRuns.map((r: any) => r.id)
    let historyMap: Record<string, any> = {}
    
    if (runIds.length > 0) {
      try {
        const placeholders = runIds.map((_: any, i: number) => `$${i + 1}`).join(', ')
        const historyResult = await sql.query(
          `SELECT apify_run_id, name, search_query, search_subreddit, sort_order, time_filter, posts_count 
           FROM scrape_history 
           WHERE apify_run_id IN (${placeholders})`,
          runIds
        )
        historyResult.rows?.forEach((row: any) => {
          historyMap[row.apify_run_id] = row
        })
      } catch (e) {
        console.error('Failed to fetch history names:', e)
      }
    }
    
    // Fetch inputs for runs that don't have history in our DB
    let runs = await Promise.all(apifyRuns.map(async (run: any) => {
      const history = historyMap[run.id]
      
      // If we have history in our DB, use that
      if (history) {
        return {
          id: run.id,
          name: history.name,
          search_query: history.search_query,
          search_subreddit: history.search_subreddit,
          sort_order: history.sort_order,
          time_filter: history.time_filter,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          stats: run.stats,
          datasetId: run.defaultDatasetId,
          postsCount: history.posts_count || 0,
          consoleUrl: `https://console.apify.com/view/runs/${run.id}`,
          buildNumber: run.buildNumber,
          usageTotalUsd: run.usageTotalUsd,
        }
      }
      
      // Otherwise fetch input from Apify key-value store
      let input: RunInput | null = null
      if (run.defaultKeyValueStoreId) {
        input = await fetchRunInput(run.defaultKeyValueStoreId)
      }
      
      const name = input ? generateRunName(input) : `${run.meta?.origin || 'run'}_${run.id.substring(0, 8)}`
      
      return {
        id: run.id,
        name,
        search_query: input?.searchQuery || null,
        search_subreddit: input?.subreddit || null,
        sort_order: input?.sort || null,
        time_filter: input?.timeFilter || null,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stats: run.stats,
        datasetId: run.defaultDatasetId,
        postsCount: 0,
        consoleUrl: `https://console.apify.com/view/runs/${run.id}`,
        buildNumber: run.buildNumber,
        usageTotalUsd: run.usageTotalUsd,
      }
    }))
    
    // Sort by startedAt descending (most recent first)
    runs.sort((a, b) => {
      const dateA = new Date(a.startedAt || 0).getTime()
      const dateB = new Date(b.startedAt || 0).getTime()
      return dateB - dateA
    })
    
    return NextResponse.json({
      runs,
      total: data.data?.total || 0,
      limit,
      offset,
      has_more: offset + limit < (data.data?.total || 0)
    })
    
  } catch (error) {
    console.error('Error fetching Apify runs:', error)
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }
}