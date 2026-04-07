import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

// GET /api/personas/[id] — 单个人设详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    const result = await sql`SELECT * FROM personas WHERE id = ${id}`
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }

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
    console.error('Error fetching persona:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch persona'
    }, { status: 500 })
  }
}

// PUT /api/personas/[id] — 更新人设
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    const body = await request.json()
    const {
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

    // 构建动态更新字段
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (username !== undefined) {
      updates.push(`username = $${paramIndex++}`)
      values.push(username)
    }
    if (avatar_emoji !== undefined) {
      updates.push(`avatar_emoji = $${paramIndex++}`)
      values.push(avatar_emoji)
    }
    if (avatar_color !== undefined) {
      updates.push(`avatar_color = $${paramIndex++}`)
      values.push(avatar_color)
    }
    if (background !== undefined) {
      updates.push(`background = $${paramIndex++}`)
      values.push(background)
    }
    if (tone !== undefined) {
      updates.push(`tone = $${paramIndex++}`)
      values.push(tone)
    }
    if (reddit_habits !== undefined) {
      updates.push(`reddit_habits = $${paramIndex++}`)
      values.push(JSON.stringify(reddit_habits))
    }
    if (writing_traits !== undefined) {
      updates.push(`writing_traits = $${paramIndex++}`)
      values.push(JSON.stringify(writing_traits))
    }
    if (brand_strategy !== undefined) {
      updates.push(`brand_strategy = $${paramIndex++}`)
      values.push(brand_strategy)
    }
    if (flaws !== undefined) {
      updates.push(`flaws = $${paramIndex++}`)
      values.push(flaws)
    }
    if (sample_comments !== undefined) {
      updates.push(`sample_comments = $${paramIndex++}`)
      values.push(JSON.stringify(sample_comments))
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }
    if (description_en !== undefined) {
      updates.push(`description_en = $${paramIndex++}`)
      values.push(description_en)
    }
    if (focus !== undefined) {
      updates.push(`focus = $${paramIndex++}`)
      values.push(JSON.stringify(focus))
    }
    if (post_types !== undefined) {
      updates.push(`post_types = $${paramIndex++}`)
      values.push(JSON.stringify(post_types))
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    values.push(id)

    const query = `
      UPDATE personas 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await sql.query(query, values)
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }

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
    console.error('Error updating persona:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update persona'
    }, { status: 500 })
  }
}

// DELETE /api/personas/[id] — 删除人设
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    const result = await sql`
      DELETE FROM personas 
      WHERE id = ${id}
      RETURNING id
    `
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Persona not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id }
    })

  } catch (error) {
    console.error('Error deleting persona:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete persona'
    }, { status: 500 })
  }
}
