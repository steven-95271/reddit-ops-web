import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { checkContentQuality } from '@/lib/quality-check'

// PUT /api/content/[id] — 更新内容（编辑后自动重新跑质量评分）
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    const body = await request.json()
    const { body_edited, status, title } = body

    // 获取原始内容
    const contentResult = await sql`SELECT * FROM contents WHERE id = ${id}`
    if (contentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    const content = contentResult.rows[0]

    // 获取品牌名用于质量评分
    const projectResult = await sql`SELECT brand_names FROM projects WHERE id = ${content.project_id}`
    const brandNames = projectResult.rows.length > 0 && projectResult.rows[0].brand_names
      ? JSON.parse(projectResult.rows[0].brand_names)
      : []

    // 使用编辑后的文本或原始文本进行质量评分
    const textToCheck = body_edited || content.body
    const qualityResult = checkContentQuality(textToCheck, brandNames)

    // 构建更新字段
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body_edited !== undefined) {
      updates.push(`body_edited = $${paramIndex++}`)
      values.push(body_edited)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(title)
    }

    // 始终更新质量评分
    updates.push(`quality_score = $${paramIndex++}`)
    values.push(qualityResult.score)

    updates.push(`quality_issues = $${paramIndex++}`)
    values.push(JSON.stringify(qualityResult.issues))

    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    values.push(id)

    const query = `
      UPDATE contents
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await sql.query(query, values)

    const updatedContent = {
      ...result.rows[0],
      quality_issues: result.rows[0].quality_issues ? JSON.parse(result.rows[0].quality_issues) : [],
    }

    return NextResponse.json({
      success: true,
      data: updatedContent
    })

  } catch (error) {
    console.error('Error updating content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update content'
    }, { status: 500 })
  }
}

// GET /api/content/[id] — 单条内容详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    const result = await sql`
      SELECT c.*, p.title as post_title, p.subreddit as post_subreddit,
             per.name as persona_name, per.avatar_emoji as persona_emoji
      FROM contents c
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN personas per ON c.persona_id = per.id
      WHERE c.id = ${id}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    const content = {
      ...result.rows[0],
      quality_issues: result.rows[0].quality_issues ? JSON.parse(result.rows[0].quality_issues) : [],
    }

    return NextResponse.json({
      success: true,
      data: content
    })

  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch content'
    }, { status: 500 })
  }
}

// DELETE /api/content/[id] — 删除内容
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    const result = await sql`
      DELETE FROM contents WHERE id = ${id} RETURNING id
    `

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id }
    })

  } catch (error) {
    console.error('Error deleting content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete content'
    }, { status: 500 })
  }
}
