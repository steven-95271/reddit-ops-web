import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
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
  return data.choices[0].message.content
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
  return data.choices[0].message.content
}

// 构建 System Prompt（Anti-AI Detection）
function buildSystemPrompt(persona: any): string {
  const writingTraits = persona.writing_traits ? JSON.parse(persona.writing_traits) : {}
  const abbreviations = writingTraits.abbreviations || []
  const redditExpressions = writingTraits.reddit_expressions || []

  return `你现在是一个真实的 Reddit 用户，用户名 ${persona.username || persona.name}。以下是你的完整人设：
${persona.description_en || persona.background}

你的写作必须遵循以下规则：

1. 句式变化：混合使用短句（3-8 词）和长句（15-25 词），比例约 6:4
2. 开头方式：永远不要用 "I think..." 或 "In my opinion..." 开头，改用：
   - 直接讲经历："So I've been using X for about 3 months now..."
   - 回应对方："Yeah this is exactly what happened to me..."
   - 反问："Wait, you guys don't use X for this?"
3. 禁止使用以下 AI 高频词汇：
   delve, leverage, utilize, facilitate, streamline, foster, harness,
   moreover, furthermore, additionally, consequently, thus, hence,
   comprehensive, robust, seamless, cutting-edge, game-changer,
   it's worth noting, it's important to note, in conclusion
4. 使用 Reddit 特有表达（适量）：${[...abbreviations, ...redditExpressions].join(', ') || 'tbh, imo, ngl, FWIW, lol, nah'}
5. 加入不完美元素：
   - 偶尔的语法不完美（but 开头、sentence fragment）
   - 一个小的吐槽点（"my only complaint is..."）
   - 纠正自己（"well actually, let me rephrase that"）
6. 品牌提及规则：
   - 全文最多提及品牌名 1-2 次
   - 品牌名周围必须有个人体验描述
   - 永远不要用"推荐"这个词，改用"换了之后就没回去过"、"朋友安利的"等
   - 如果是回帖，品牌提及应在回复的后半段自然出现
7. 格式要求：
   - 不要使用标题标记（#）
   - 段落之间用空行分隔
   - 可以使用 Reddit markdown（**加粗**、*斜体*）
   - 长回复可以用 bullet points，但不要每条都用
8. 长度指导：
   - 回复评论：2-4 个段落，80-200 词
   - 主帖内容：3-6 个段落，200-500 词`
}

// 构建 User Prompt（根据模式）
function buildUserPrompt(mode: string, params: any): string {
  switch (mode) {
    case 'reply_post':
      return `你在浏览 r/${params.subreddit || 'reddit'}，看到了这个帖子：

标题：${params.post_title}
${params.post_body ? `内容：${params.post_body}` : ''}

请以 ${params.persona_name} 的身份写一条回复。
你的目标是：先提供有价值的回答或分享，然后自然提到 ${params.brand_name || 'the product'}。`

    case 'reply_comment':
      return `你在 r/${params.subreddit || 'reddit'} 的一个帖子下看到有人评论：

${params.post_title ? `原帖标题：${params.post_title}` : ''}
他人评论：${params.target_comment}

请以 ${params.persona_name} 的身份回复这条评论。
回复要直接针对对方说的内容，感觉像两个人在对话。`

    case 'free_compose':
      return `你想在 r/${params.target_subreddit || 'reddit'} 发一个帖子。

你的想法/主题：${params.user_idea}
帖子类型：${params.post_type || '经验分享'}

请以 ${params.persona_name} 的身份写一个完整的帖子，包含标题和正文。
标题要像真实 Reddit 帖子：具体、有个人色彩、能引发点击。
不要用 clickbait 标题。`

    default:
      return `请以 ${params.persona_name} 的身份写一段 Reddit 内容。`
  }
}

// POST /api/content/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id,
      persona_id,
      mode, // reply_post | reply_comment | free_compose
      post_id,
      post_title,
      post_body,
      target_comment,
      user_idea,
      target_subreddit,
      post_type,
    } = body

    if (!project_id || !persona_id || !mode) {
      return NextResponse.json({
        success: false,
        error: 'project_id, persona_id, and mode are required'
      }, { status: 400 })
    }

    // 获取人设信息
    const personaResult = await sql`SELECT * FROM personas WHERE id = ${persona_id}`
    if (personaResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }
    const persona = personaResult.rows[0]

    // 获取项目信息
    const projectResult = await sql`SELECT * FROM projects WHERE id = ${project_id}`
    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }
    const project = projectResult.rows[0]
    const brandNames = project.brand_names ? JSON.parse(project.brand_names) : []
    const brandName = brandNames[0] || project.product_name || 'the product'

    // 构建 prompt
    const systemPrompt = buildSystemPrompt(persona)
    const userPrompt = buildUserPrompt(mode, {
      persona_name: persona.name,
      brand_name: brandName,
      subreddit: target_subreddit || persona.subreddit || 'reddit',
      post_title,
      post_body,
      target_comment,
      user_idea,
      post_type,
    })

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

    // 保存到数据库
    const id = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const contentTitle = mode === 'free_compose' ? aiResponse.split('\n')[0]?.replace(/^#+\s*/, '').trim() : null
    const contentBody = mode === 'free_compose' ? aiResponse.split('\n').slice(1).join('\n').trim() : aiResponse

    await sql`
      INSERT INTO contents (
        id, project_id, post_id, persona_id, content_type, title, body,
        content_mode, target_comment, user_idea, target_subreddit, post_type,
        quality_score, quality_issues, ai_model_used, generation_prompt,
        status, updated_at
      ) VALUES (
        ${id}, ${project_id}, ${post_id || null}, ${persona_id}, 'comment',
        ${contentTitle}, ${contentBody},
        ${mode}, ${target_comment || null}, ${user_idea || null},
        ${target_subreddit || null}, ${post_type || null},
        ${qualityResult.score}, ${JSON.stringify(qualityResult.issues)},
        ${modelUsed}, ${JSON.stringify({ system: systemPrompt, user: userPrompt })},
        'draft', CURRENT_TIMESTAMP
      )
    `

    return NextResponse.json({
      success: true,
      data: {
        id,
        content: aiResponse,
        title: contentTitle,
        body: contentBody,
        quality_score: qualityResult.score,
        quality_issues: qualityResult.issues,
        model_used: modelUsed,
      }
    })

  } catch (error) {
    console.error('Error generating content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate content'
    }, { status: 500 })
  }
}
