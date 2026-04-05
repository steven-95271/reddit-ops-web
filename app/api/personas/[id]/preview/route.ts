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
        { role: 'system', content: 'You are a helpful assistant. Write in a natural, human-like Reddit style.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
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
        { role: 'system', content: 'You are a helpful assistant. Write in a natural, human-like Reddit style.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// POST /api/personas/[id]/preview — 生成示例回复
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { sample_post_title, sample_post_body } = body

    if (!sample_post_title) {
      return NextResponse.json({
        success: false,
        error: 'sample_post_title is required'
      }, { status: 400 })
    }

    // 获取人设详情
    const personaResult = await sql`SELECT * FROM personas WHERE id = ${id}`
    if (personaResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }

    const persona = personaResult.rows[0]

    // 解析 JSON 字段
    const redditHabits = persona.reddit_habits ? JSON.parse(persona.reddit_habits) : {}
    const writingTraits = persona.writing_traits ? JSON.parse(persona.writing_traits) : {}
    const sampleComments = persona.sample_comments ? JSON.parse(persona.sample_comments) : []

    // 构建 Prompt
    const prompt = `你现在是 ${persona.name}，一个真实的 Reddit 用户。

你的完整人设：
${persona.description_en || persona.background}

你的写作特点：
- 语气风格：${persona.tone}
- 句式偏好：${writingTraits.sentence_style || '混合使用短句和长句'}
- 常用缩写：${(writingTraits.abbreviations || []).join(', ')}
- Reddit 表达：${(writingTraits.reddit_expressions || []).join(', ')}
- 使用习惯：${redditHabits.interaction_style || '积极参与讨论'}

参考你平时的说话方式（示例）：
${sampleComments.map((c: string, i: number) => `${i + 1}. "${c}"`).join('\n')}

现在你在 Reddit 上看到了这个帖子：

标题：${sample_post_title}
${sample_post_body ? `内容：${sample_post_body}` : ''}

请以 ${persona.name} 的身份写一条回复。要求：
1. 像真实用户一样自然、有个人观点
2. 先提供有价值的信息或分享经历
3. 可以适度提及产品但不要太像广告
4. 80-150 词左右
5. 使用你的人设特有的语言风格`

    // 调用 AI 生成
    let aiResponse: string
    try {
      aiResponse = await callKimi(prompt)
    } catch (kimiError) {
      console.log('Kimi failed, trying MiniMax:', kimiError)
      aiResponse = await callMiniMax(prompt)
    }

    return NextResponse.json({
      success: true,
      data: {
        preview: aiResponse.trim(),
        persona_name: persona.name,
        persona_id: id,
      }
    })

  } catch (error) {
    console.error('Error generating preview:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview'
    }, { status: 500 })
  }
}
