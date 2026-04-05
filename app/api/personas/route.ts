import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/personas?project_id=xxx — 返回该项目的所有人设
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    
    if (!projectId) {
      return NextResponse.json({ 
        success: false,
        error: 'project_id required' 
      }, { status: 400 })
    }

    const result = await sql`SELECT * FROM personas WHERE project_id = ${projectId} ORDER BY created_at DESC`
    
    // 解析 JSON 字段
    const personas = result.rows.map(row => ({
      ...row,
      focus: row.focus ? JSON.parse(row.focus) : [],
      post_types: row.post_types ? JSON.parse(row.post_types) : [],
      reddit_habits: row.reddit_habits ? JSON.parse(row.reddit_habits) : null,
      writing_traits: row.writing_traits ? JSON.parse(row.writing_traits) : null,
      sample_comments: row.sample_comments ? JSON.parse(row.sample_comments) : null,
    }))

    return NextResponse.json({ 
      success: true,
      data: personas 
    })
  } catch (error) {
    console.error('Error fetching personas:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch personas' 
    }, { status: 500 })
  }
}

// POST /api/personas — 手动创建自定义人设
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id,
      name,
      username,
      avatar_emoji,
      avatar_color,
      background,
      tone,
      reddit_habits,
      writing_traits,
      brand_strategy,
      flaws,
      sample_comments,
      description,
      description_en,
      focus,
      post_types,
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'name is required'
      }, { status: 400 })
    }

    const id = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const result = await sql`
      INSERT INTO personas (
        id, project_id, name, username, avatar_emoji, avatar_color,
        background, tone, reddit_habits, writing_traits, brand_strategy,
        flaws, sample_comments, description, description_en, focus, post_types,
        updated_at
      ) VALUES (
        ${id}, ${project_id}, ${name}, ${username}, ${avatar_emoji}, ${avatar_color},
        ${background}, ${tone}, 
        ${reddit_habits ? JSON.stringify(reddit_habits) : null},
        ${writing_traits ? JSON.stringify(writing_traits) : null},
        ${brand_strategy}, ${flaws},
        ${sample_comments ? JSON.stringify(sample_comments) : null},
        ${description}, ${description_en},
        ${focus ? JSON.stringify(focus) : null},
        ${post_types ? JSON.stringify(post_types) : null},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `

    const persona = {
      ...result.rows[0],
      reddit_habits: result.rows[0].reddit_habits ? JSON.parse(result.rows[0].reddit_habits) : null,
      writing_traits: result.rows[0].writing_traits ? JSON.parse(result.rows[0].writing_traits) : null,
      sample_comments: result.rows[0].sample_comments ? JSON.parse(result.rows[0].sample_comments) : null,
      focus: result.rows[0].focus ? JSON.parse(result.rows[0].focus) : [],
      post_types: result.rows[0].post_types ? JSON.parse(result.rows[0].post_types) : [],
    }

    return NextResponse.json({
      success: true,
      data: persona
    })

  } catch (error) {
    console.error('Error creating persona:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create persona'
    }, { status: 500 })
  }
}
