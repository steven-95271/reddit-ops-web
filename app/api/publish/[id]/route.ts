import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

// PUT /api/publish/[id] — 更新发布记录
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    const body = await request.json()
    const { upvotes, replies, status, published_url } = body

    // 构建更新字段
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (upvotes !== undefined) {
      updates.push(`upvotes = $${paramIndex++}`)
      values.push(upvotes)
    }
    if (replies !== undefined) {
      updates.push(`replies = $${paramIndex++}`)
      values.push(replies)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (published_url !== undefined) {
      updates.push(`published_url = $${paramIndex++}`)
      values.push(published_url)
    }

    updates.push(`last_tracked_at = CURRENT_TIMESTAMP`)

    values.push(id)

    const query = `
      UPDATE publish_log
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await sql.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publish record not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error updating publish record:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update publish record'
    }, { status: 500 })
  }
}

// DELETE /api/publish/[id] — 删除发布记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    // 获取 content_id 以便更新内容状态
    const recordResult = await sql`SELECT content_id FROM publish_log WHERE id = ${id}`
    if (recordResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Publish record not found'
      }, { status: 404 })
    }

    const contentId = recordResult.rows[0].content_id

    // 删除发布记录
    await sql`DELETE FROM publish_log WHERE id = ${id}`

    // 将内容状态改回 approved
    await sql`
      UPDATE contents SET status = 'approved', published_at = NULL WHERE id = ${contentId}
    `

    return NextResponse.json({
      success: true,
      data: { id }
    })

  } catch (error) {
    console.error('Error deleting publish record:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete publish record'
    }, { status: 500 })
  }
}
