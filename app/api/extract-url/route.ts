import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const KIMI_API_KEY = process.env.KIMI_API_KEY || ''
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2-5'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7-Highspeed'

interface ExtractedInfo {
  product_name: string
  product_description: string
  target_audience: string
  brand_names: string[]
  competitor_brands: string[]
  suggested_keywords: string[]
}

/**
 * 调用 Apify Web Scraper 抓取页面内容
 */
async function scrapeWithApify(url: string): Promise<string | null> {
  if (!APIFY_API_TOKEN) {
    console.log('Apify API token not configured')
    return null
  }

  console.log('[Apify] Trying to scrape:', url)
  
  try {
    const APIFY_BASE_URL = 'https://api.apify.com/v2'
    const ACTOR_ID = 'apify/web-scraper'  // 使用 Apify 官方的 Web Scraper
    
    // 构建 Actor 输入
    const actorInput = {
      startUrls: [{ url }],
      useRequestQueue: true,
      pageFunction: `
        async function pageFunction(context) {
          const { page, request } = context;
          const html = await page.evaluate(() => document.documentElement.innerHTML);
          const text = await page.evaluate(() => document.body.innerText);
          return {
            url: request.url,
            title: await page.title(),
            html: html,
            text: text
          };
        }
      `,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      },
      maxRequestRetries: 3,
      maxPagesPerCrawl: 1,
      maxCrawlDepth: 0
    }

    // 启动 Actor 任务
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify(actorInput),
      }
    )

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('[Apify] Failed to start scraper:', runResponse.status, errorText)
      return null
    }

    const runData = await runResponse.json()
    const runId = runData.data?.id

    if (!runId) {
      console.error('[Apify] No run ID returned')
      return null
    }

    console.log(`[Apify] Scraper started, run ID: ${runId}`)

    // 等待任务完成（最多等待 60 秒）
    let attempts = 0
    const maxAttempts = 30
    const pollInterval = 2000  // 2秒检查一次
    
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(
        `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs/${runId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      )

      if (!statusResponse.ok) {
        console.error('[Apify] Status check failed:', statusResponse.status)
        break
      }

      const statusData = await statusResponse.json()
      const status = statusData.data?.status

      console.log(`[Apify] Run ${runId} status: ${status} (attempt ${attempts + 1}/${maxAttempts})`)

      if (['SUCCEEDED', 'FINISHED'].includes(status)) {
        // 任务完成，获取结果
        const itemsResponse = await fetch(
          `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs/${runId}/dataset/items`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${APIFY_API_TOKEN}`,
            },
          }
        )

        if (!itemsResponse.ok) {
          console.error('[Apify] Failed to get results:', itemsResponse.status)
          return null
        }

        const items = await itemsResponse.json()
        console.log(`[Apify] Retrieved ${items.length} items`)
        
        if (items.length > 0 && items[0].text) {
          return items[0].text
        }
        
        // 如果没有 text 字段，尝试从 html 中提取
        if (items.length > 0 && items[0].html) {
          return extractTextFromHtml(items[0].html)
        }
        
        return null
      }

      if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(status)) {
        console.error(`[Apify] Run failed with status: ${status}`)
        return null
      }

      // 继续等待
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++
    }

    console.error('[Apify] Timed out waiting for completion')
    return null

  } catch (error) {
    console.error('[Apify] Error scraping with Apify:', error)
    return null
  }
}

/**
 * 从 HTML 中提取纯文本内容
 */
function extractTextFromHtml(html: string): string {
  // 移除 script, style, nav, footer 等标签
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')

  // 提取文本
  const textContent = cleanHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return textContent
}

async function callAIWithFallback(prompt: string): Promise<string> {
  try {
    console.log('Trying Kimi K2.5...')
    const result = await callKimi(prompt)
    console.log('Kimi K2.5 success')
    return result
  } catch (error) {
    console.error('Kimi K2.5 failed:', error)
  }

  console.log('Falling back to MiniMax-M2.7-Highspeed...')
  try {
    if (!MINIMAX_API_KEY) {
      throw new Error('MINIMAX_API_KEY not configured')
    }
    const result = await callMiniMax(prompt)
    console.log('MiniMax API success')
    return result
  } catch (error) {
    console.error('MiniMax API also failed:', error)
    throw error
  }
}

async function callKimi(prompt: string): Promise<string> {
  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not configured')
  }

  const response = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log('[Kimi Response]', JSON.stringify(data, null, 2))
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[Kimi Error] Invalid response structure:', data)
    throw new Error('Kimi API returned invalid response structure')
  }
  
  return data.choices[0].message.content || ''
}

async function callMiniMax(prompt: string): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY not configured')
  }

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log('[MiniMax Response]', JSON.stringify(data, null, 2))
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[MiniMax Error] Invalid response structure:', data)
    throw new Error('MiniMax API returned invalid response structure')
  }
  
  return data.choices[0].message.content || ''
}

export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // 验证 URL 格式
    let validatedUrl: URL
    try {
      validatedUrl = new URL(url)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 })
    }

    let pageContent = ''

    // 方案一：直接 fetch
    try {
      console.log('[Direct Fetch] Trying to fetch:', url)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })

      if (response.ok) {
        const html = await response.text()
        pageContent = extractTextFromHtml(html)
        console.log(`[Direct Fetch] Success, extracted ${pageContent.length} characters`)
      } else {
        console.log(`[Direct Fetch] Failed with status: ${response.status}`)
      }
    } catch (fetchError) {
      console.log('[Direct Fetch] Failed:', fetchError)
    }

    // 方案二：Apify fallback
    if (!pageContent || pageContent.length < 100) {
      console.log('[Fallback] Trying Apify...')
      const apifyContent = await scrapeWithApify(url)
      if (apifyContent) {
        pageContent = apifyContent
        console.log(`[Apify] Success, extracted ${pageContent.length} characters`)
      }
    }

    // 检查是否成功获取内容
    if (!pageContent || pageContent.length < 100) {
      return NextResponse.json({
        success: false,
        error: '无法访问该页面，请检查链接是否有效或手动填写产品信息'
      }, { status: 400 })
    }

    // 截取前 5000 字符避免 token 超限
    const truncatedText = pageContent.slice(0, 5000)

    // 构建 AI prompt
    const prompt = `You are a product information extraction expert. Analyze the following webpage content and extract key product information.

URL: ${url}

Webpage Content:
${truncatedText}

Please extract the following information in JSON format:
{
  "product_name": "产品全称（品牌+型号）",
  "product_description": "产品简要描述，包含核心卖点和功能特点",
  "target_audience": "目标用户群体，如：跑步爱好者、通勤族、音乐发烧友等",
  "brand_names": ["品牌名称"],
  "competitor_brands": ["从内容中提到的竞品品牌，如：Bose, Sony, Apple等"],
  "suggested_keywords": ["建议的关键词，用于 Reddit 搜索，如：running headphones, open ear earbuds等"]
}

Requirements:
1. Extract information only if clearly present in the content
2. Use English for all fields
3. brand_names should be the main brand of the product
4. competitor_brands should be brands mentioned as alternatives or comparisons
5. suggested_keywords should be search terms relevant to Reddit users
6. If information is not available, use empty string for text fields and empty array for array fields
7. Return ONLY valid JSON, no other text

Example output:
{
  "product_name": "Shokz OpenRun Pro",
  "product_description": "Premium bone conduction headphones with 10-hour battery life, IP55 water resistance, and open-ear design for situational awareness during sports.",
  "target_audience": "Runners, cyclists, and outdoor sports enthusiasts",
  "brand_names": ["Shokz"],
  "competitor_brands": ["Bose", "Sony", "AfterShokz"],
  "suggested_keywords": ["bone conduction headphones", "running headphones", "open ear earbuds", "sports headphones"]
}`

    // 调用 AI 提取信息
    const aiResponse = await callAIWithFallback(prompt)

    // 解析 AI 返回的 JSON
    let extractedInfo: ExtractedInfo
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse
      extractedInfo = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      return NextResponse.json({
        success: false,
        error: 'AI 解析失败，请手动填写'
      }, { status: 500 })
    }

    // 验证提取结果
    if (!extractedInfo.product_name && !extractedInfo.product_description) {
      return NextResponse.json({
        success: false,
        error: '无法从页面提取产品信息，请手动填写'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: extractedInfo
    })

  } catch (error) {
    console.error('Error extracting URL:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract URL'
    }, { status: 500 })
  }
}
