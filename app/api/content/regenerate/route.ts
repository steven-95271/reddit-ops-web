import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { checkContentQuality } from '@/lib/quality-check'

// 调用 Kimi API
async function callKimi(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured')
  }

  const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'kimi-latest',
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('[Kimi Response]', JSON.stringify(data, null, 2))
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[Kimi Error] Invalid response structure:', data)
    throw new Error('Kimi API returned invalid response structure')
  }
  
  return data.choices[0].message.content || ''
}

// 调用 MiniMax API (fallback)
async function callMiniMax(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not configured')
  }

  const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('[MiniMax Response]', JSON.stringify(data, null, 2))
  
  // MiniMax API 可能返回不同的结构，使用可选链安全访问
  const content = data.choices?.[0]?.message?.content || 
                  data.choices?.[0]?.text || 
                  data.output || 
                  data.result ||
                  data.text
  
  if (!content) {
    console.error('[MiniMax Error] Invalid response structure:', data)
    throw new Error('MiniMax API returned invalid response structure')
  }
  
  return content
}

// POST /api/content/regenerate
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { content_id, feedback } = body

    if (!content_id) {
      return NextResponse.json({
        success: false,
        error: 'content_id is required'
      }, { status: 400 })
    }

    // 获取原始内容
    const contentResult = await sql`SELECT * FROM contents WHERE id = ${content_id}`
    if (contentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    const content = contentResult.rows[0]

    // 获取人设信息
    const personaResult = await sql`SELECT * FROM personas WHERE id = ${content.persona_id}`
    if (personaResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }
    const persona = personaResult.rows[0]

    // 获取项目信息
    const projectResult = await sql`SELECT * FROM projects WHERE id = ${content.project_id}`
    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }
    const project = projectResult.rows[0]
    const brandNames = project.brand_names ? JSON.parse(project.brand_names) : []
    const brandName = brandNames[0] || project.product_name || 'the product'

    // 解析原始 prompt
    let originalPrompt: { system: string; user: string }
    try {
      originalPrompt = content.generation_prompt ? JSON.parse(content.generation_prompt) : { system: '', user: '' }
    } catch {
      originalPrompt = { system: '', user: '' }
    }

    // 构建重新生成的 prompt（附加反馈）
    const systemPrompt = originalPrompt.system
    let userPrompt = originalPrompt.user

    if (feedback) {
      userPrompt += `\n\n用户反馈：${feedback}。请根据反馈重新生成，保持人设风格一致。`
    } else {
      userPrompt += '\n\n请重新生成一段不同但风格一致的内容。'
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    // 调用 AI 生成
    let aiResponse: string
    let modelUsed = 'kimi'
    try {
      aiResponse = await callKimi(messages)
    } catch (kimiError) {
      console.log('Kimi failed, trying MiniMax:', kimiError)
      aiResponse = await callMiniMax(messages)
      modelUsed = 'minimax'
    }

    // 质量评分
    const qualityResult = checkContentQuality(aiResponse, brandNames)

    // 更新数据库
    const contentTitle = content.content_mode === 'free_compose' ? aiResponse.split('\n')[0]?.replace(/^#+\s*/, '').trim() : null
    const contentBody = content.content_mode === 'free_compose' ? aiResponse.split('\n').slice(1).join('\n').trim() : aiResponse

    await sql`
      UPDATE contents
      SET 
        body = ${contentBody},
        title = COALESCE(${contentTitle}, title),
        quality_score = ${qualityResult.score},
        quality_issues = ${JSON.stringify(qualityResult.issues)},
        ai_model_used = ${modelUsed},
        generation_prompt = ${JSON.stringify({ system: systemPrompt, user: userPrompt })},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${content_id}
    `

    return NextResponse.json({
      success: true,
      data: {
        id: content_id,
        content: aiResponse,
        title: contentTitle,
        body: contentBody,
        quality_score: qualityResult.score,
        quality_issues: qualityResult.issues,
        model_used: modelUsed,
      }
    })

  } catch (error) {
    console.error('Error regenerating content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate content'
    }, { status: 500 })
  }
}
