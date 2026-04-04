import { NextRequest, NextResponse } from 'next/server'

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
  return data.choices[0]?.message?.content || ''
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
  return data.choices[0]?.message?.content || ''
}

export async function POST(request: NextRequest) {
  try {
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

    // 获取网页内容
    let html: string
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      } as any)

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`)
      }

      html = await response.text()
    } catch (fetchError) {
      console.error('Error fetching URL:', fetchError)
      return NextResponse.json({
        success: false,
        error: '无法访问该 URL，请检查链接是否有效'
      }, { status: 400 })
    }

    // 提取纯文本内容
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

    // 截取前 5000 字符避免 token 超限
    const truncatedText = textContent.slice(0, 5000)

    if (truncatedText.length < 100) {
      return NextResponse.json({
        success: false,
        error: '页面内容过少，无法提取有效信息'
      }, { status: 400 })
    }

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
