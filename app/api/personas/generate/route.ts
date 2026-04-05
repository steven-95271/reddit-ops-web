import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// 调用 Kimi API
async function callKimi(prompt: string): Promise<string> {
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
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// 调用 MiniMax API (fallback)
async function callMiniMax(prompt: string): Promise<string> {
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
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// 构建 AI Prompt
function buildPersonaPrompt(project: any): string {
  const keywords = project.keywords ? JSON.parse(project.keywords) : {}
  const brandNames = project.brand_names || 'our product'
  const competitors = project.competitor_brands ? JSON.parse(project.competitor_brands) : []

  return `你是一个 Reddit 社区运营专家。基于以下产品信息，生成 3-5 个适合在 Reddit 上推广此产品的虚拟用户人设。

产品信息：
- 产品名：${project.product_name || 'Unknown Product'}
- 产品描述：${project.product_description || 'No description'}
- 目标受众：${project.target_audience || 'General consumers'}
- 品牌名：${brandNames}
- 竞品：${competitors.join(', ') || 'N/A'}

每个人设需要包含以下字段（返回 JSON 数组格式）：
{
  "personas": [
    {
      "name": "英文人名",
      "username": "Reddit用户名（小写+下划线）",
      "avatar_emoji": "一个emoji作为头像",
      "avatar_color": "tailwind颜色类名如bg-blue-500",
      "background": "50-100字的背景故事，包含职业、生活场景、使用产品的理由",
      "tone": "语气风格（如: casual, nerdy, enthusiastic, skeptical-then-convinced, practical）",
      "reddit_habits": {
        "subreddits": ["常逛的subreddit列表"],
        "posting_frequency": "发帖频率描述",
        "interaction_style": "互动风格描述"
      },
      "writing_traits": {
        "sentence_style": "句式偏好（短句/长句/混合）",
        "abbreviations": ["常用的缩写如tbh, imo, ngl等"],
        "emoji_usage": "emoji使用频率（频繁/偶尔/很少）",
        "reddit_expressions": ["Reddit特有表达如tbh, imo, ngl等"]
      },
      "brand_strategy": "品牌提及策略描述（如：亲身体验分享/朋友推荐/偶然发现）",
      "flaws": "人设的小缺点或吐槽点（增加真实感）",
      "sample_comments": ["2-3条示例评论，展示这个人设的说话方式"],
      "description": "中文描述",
      "description_en": "完整英文人设描述，用于后续内容生成"
    }
  ]
}

要求：
1. 人设之间要有明显差异（不同年龄、职业、使用场景）
2. 人设要像真实的 Reddit 用户，不要像营销账号
3. 每个人设至少有一个"缺点"或"吐槽点"
4. 示例评论要展示不同的人设特点
5. 必须是合法的 JSON 格式，不要有任何 markdown 标记`
}

// POST /api/personas/generate — AI 生成人设
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id } = body

    if (!project_id) {
      return NextResponse.json({
        success: false,
        error: 'project_id is required'
      }, { status: 400 })
    }

    // 获取项目信息
    const projectResult = await sql`SELECT * FROM projects WHERE id = ${project_id}`
    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    const project = projectResult.rows[0]

    // 构建 Prompt
    const prompt = buildPersonaPrompt(project)

    // 调用 AI 生成
    let aiResponse: string
    try {
      aiResponse = await callKimi(prompt)
    } catch (kimiError) {
      console.log('Kimi failed, trying MiniMax:', kimiError)
      aiResponse = await callMiniMax(prompt)
    }

    // 解析 JSON 响应
    let parsedData: { personas: any[] }
    try {
      // 清理可能的 markdown 代码块
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedData = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        raw_response: aiResponse
      }, { status: 500 })
    }

    // 保存到数据库
    const savedPersonas = []
    for (const personaData of parsedData.personas) {
      const id = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const result = await sql`
        INSERT INTO personas (
          id, project_id, name, username, avatar_emoji, avatar_color,
          background, tone, reddit_habits, writing_traits, brand_strategy,
          flaws, sample_comments, description, description_en,
          updated_at
        ) VALUES (
          ${id}, ${project_id}, ${personaData.name}, ${personaData.username}, 
          ${personaData.avatar_emoji}, ${personaData.avatar_color},
          ${personaData.background}, ${personaData.tone}, 
          ${JSON.stringify(personaData.reddit_habits)},
          ${JSON.stringify(personaData.writing_traits)},
          ${personaData.brand_strategy}, ${personaData.flaws},
          ${JSON.stringify(personaData.sample_comments)},
          ${personaData.description}, ${personaData.description_en},
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `

      const savedPersona = {
        ...result.rows[0],
        reddit_habits: result.rows[0].reddit_habits ? JSON.parse(result.rows[0].reddit_habits) : null,
        writing_traits: result.rows[0].writing_traits ? JSON.parse(result.rows[0].writing_traits) : null,
        sample_comments: result.rows[0].sample_comments ? JSON.parse(result.rows[0].sample_comments) : null,
      }

      savedPersonas.push(savedPersona)
    }

    return NextResponse.json({
      success: true,
      data: savedPersonas
    })

  } catch (error) {
    console.error('Error generating personas:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate personas'
    }, { status: 500 })
  }
}
