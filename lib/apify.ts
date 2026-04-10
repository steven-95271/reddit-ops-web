/**
 * Apify Reddit Scraper API Client
 * 封装 Apify Reddit Scraper 的调用逻辑
 */

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE_URL = 'https://api.apify.com/v2'

// Actor ID for Reddit Scraper (注意：Apify URL 中 / 改为 ~)
const REDDIT_SCRAPER_ACTOR_ID = 'automation-lab~reddit-scraper'

interface ScrapingParams {
  subreddits: string[]
  keywords: string[]
  time_range: '24h' | '7d' | '30d'
  max_posts: number
  sort_by: 'hot' | 'new' | 'top'
}

interface ScrapingResult {
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  score: number
  num_comments: number
  created_utc: number
  post_id?: string
  permalink?: string
}

interface RunStatus {
  id: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED'
  startedAt?: string
  finishedAt?: string
  errorMessage?: string
  stats?: {
    inputBodyLen: number
    outputBodyLen: number
  }
}

/**
 * 启动 Apify Reddit Scraper 抓取任务
 * @param params 抓取参数
 * @returns run_id 任务ID
 */
export async function startScraping(params: ScrapingParams): Promise<string> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    // 转换时间范围为 Apify 格式
    const timeFilterMap: Record<string, string> = {
      '24h': 'day',
      '7d': 'week',
      '30d': 'month'
    }

    // 构建搜索查询（关键词 + subreddit 组合）
    const searchQueries: string[] = []
    
    // 为每个关键词在每个 subreddit 中搜索
    for (const keyword of params.keywords) {
      if (params.subreddits.length > 0) {
        for (const subreddit of params.subreddits) {
          searchQueries.push(`${keyword} subreddit:${subreddit}`)
        }
      } else {
        searchQueries.push(keyword)
      }
    }

    // 如果关键词为空，直接使用 subreddits
    if (searchQueries.length === 0 && params.subreddits.length > 0) {
      for (const subreddit of params.subreddits) {
        searchQueries.push(`subreddit:${subreddit}`)
      }
    }

    // 构建 Apify Actor 输入
    const actorInput = {
      searchQueries: searchQueries.slice(0, 10), // 最多10个查询
      sortOrder: params.sort_by,
      timeFilter: timeFilterMap[params.time_range] || 'all',
      maxPostsPerSource: Math.min(params.max_posts, 30), // 限制30条避免超时
      includeComments: true,
      maxCommentsPerPost: 10,
      commentDepth: 2,
      deduplicatePosts: true,
      maxRetries: 3,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    }

    console.log('Starting Apify scraping with input:', JSON.stringify(actorInput, null, 2))

    // 调用 Apify API 启动 Actor
    const url = `${APIFY_BASE_URL}/acts/${REDDIT_SCRAPER_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`
    console.log('[Apify] Actor URL:', url)
    console.log('[Apify] Token exists:', !!APIFY_API_TOKEN)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actorInput),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    const runId = data.data?.id

    if (!runId) {
      throw new Error('Failed to get run ID from Apify response')
    }

    console.log(`Apify scraping started, run ID: ${runId}`)
    return runId

  } catch (error) {
    console.error('Error starting Apify scraping:', error)
    throw error
  }
}

/**
 * 查询抓取任务状态
 * @param run_id 任务ID
 * @returns 任务状态信息
 */
export async function getScrapingStatus(run_id: string): Promise<RunStatus> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    const response = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${run_id}?token=${APIFY_API_TOKEN}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.data as RunStatus

  } catch (error) {
    console.error('Error getting scraping status:', error)
    throw error
  }
}

/**
 * 获取抓取结果
 * @param run_id 任务ID
 * @returns 解析后的帖子列表
 */
export async function getScrapingResults(run_id: string): Promise<ScrapingResult[]> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    // 先获取 run 信息拿到 datasetId
    const runInfoRes = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${run_id}?token=${APIFY_API_TOKEN}`,
      { method: 'GET' }
    )
    if (!runInfoRes.ok) {
      throw new Error(`Apify API error: ${runInfoRes.status}`)
    }
    const runData = await runInfoRes.json()
    const datasetId = runData.data?.defaultDatasetId
    if (!datasetId) {
      throw new Error(`No datasetId for run ${run_id}`)
    }

    // 用 datasetId 获取数据
    const response = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const rawData = await response.json()
    
    // 解析为标准格式
    const results: ScrapingResult[] = rawData.map((item: any) => ({
      subreddit: item.subreddit || '',
      title: item.title || '',
      body: item.body || item.selftext || '',
      author: item.author || '',
      url: item.url || '',
      score: item.score || 0,
      num_comments: item.num_comments || 0,
      created_utc: item.created_utc || 0,
      post_id: item.id || item.post_id || '',
      permalink: item.permalink || '',
    }))

    console.log(`Retrieved ${results.length} posts from Apify run ${run_id}`)
    return results

  } catch (error) {
    console.error('Error getting scraping results:', error)
    throw error
  }
}

/**
 * 等待任务完成（轮询）
 * @param run_id 任务ID
 * @param pollInterval 轮询间隔（毫秒）
 * @param maxAttempts 最大尝试次数
 * @returns 最终状态
 */
export async function waitForScrapingCompletion(
  run_id: string,
  pollInterval: number = 10000,
  maxAttempts: number = 60
): Promise<RunStatus> {
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const status = await getScrapingStatus(run_id)
    
    console.log(`Scraping status check ${attempts + 1}: ${status.status}`)
    
    // 如果任务完成或失败，返回状态
    if (['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(status.status)) {
      return status
    }
    
    // 等待后再次检查
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    attempts++
  }
  
  throw new Error(`Scraping task ${run_id} did not complete within ${maxAttempts} attempts`)
}

/**
 * 启动单个 Apify Reddit Scraper 抓取任务
 * @param params 抓取参数（单个查询）
 * @returns run_id 任务ID
 */
export async function startScrapingSingle(params: ScrapingParams): Promise<string> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    // 转换时间范围为 Apify 格式
    const timeFilterMap: Record<string, string> = {
      '24h': 'day',
      '7d': 'week',
      '30d': 'month',
      'year': 'year',
      'all': 'all'
    }

    // 使用 searchQuery 或构建 Reddit URL
    let searchQuery = ''
    let searchSubreddit = ''
    
    if (params.keywords.length > 0) {
      // 单个查询词
      searchQuery = params.keywords[0]
    }
    
    if (params.subreddits.length > 0) {
      // 如果指定了 subreddit
      searchSubreddit = params.subreddits[0]
    }

    // 构建 Apify Actor 输入
    const actorInput = {
      searchQuery,
      searchSubreddit,
      sort: params.sort_by,
      timeFilter: timeFilterMap[params.time_range] || 'week',
      maxPostsPerSource: Math.min(params.max_posts, 30), // 限制30条避免超时
      includeComments: true,
      maxCommentsPerPost: 10,
      commentDepth: 2,
      deduplicatePosts: true,
      maxRetries: 3,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    }

    console.log('Starting Apify scraping with input:', JSON.stringify(actorInput, null, 2))

    // 调用 Apify API 启动 Actor
    const url = `${APIFY_BASE_URL}/acts/${REDDIT_SCRAPER_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`
    console.log('[Apify] Actor URL:', url)
    console.log('[Apify] Token exists:', !!APIFY_API_TOKEN)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actorInput),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    const runId = data.data?.id

    if (!runId) {
      throw new Error('Failed to get run ID from Apify response')
    }

    console.log(`Apify scraping started, run ID: ${runId}`)
    return runId

  } catch (error) {
    console.error('Error starting Apify scraping:', error)
    throw error
  }
}

/**
 * 获取 Apify Run 的 Dataset ID
 * @param run_id 任务ID
 * @returns Dataset ID
 */
export async function getRunDatasetId(run_id: string): Promise<string | null> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    const response = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${run_id}?token=${APIFY_API_TOKEN}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.data?.defaultDatasetId || null

  } catch (error) {
    console.error('Error getting run dataset ID:', error)
    throw error
  }
}

/**
 * 下载 Dataset 为 CSV 格式
 * @param dataset_id Dataset ID
 * @returns CSV 内容
 */
export async function downloadDatasetAsCsv(dataset_id: string): Promise<string> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured')
  }

  try {
    const response = await fetch(
      `${APIFY_BASE_URL}/datasets/${dataset_id}/items?format=csv&token=${APIFY_API_TOKEN}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.text()

  } catch (error) {
    console.error('Error downloading dataset:', error)
    throw error
  }
}
