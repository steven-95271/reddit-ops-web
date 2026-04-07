import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

// PUT /api/analysis/candidates - 批量更新候选状态
export async function PUT(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { post_ids, is_candidate } = body

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'post_ids array is required'
      }, { status: 400 })
    }

    if (typeof is_candidate !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'is_candidate boolean is required'
      }, { status: 400 })
    }

    // 批量更新候选状态
    const placeholders = post_ids.map((_, i) => `$${i + 1}`).join(',')
    const query = `
      UPDATE posts 
      SET is_candidate = $${post_ids.length + 1}
      WHERE id IN (${placeholders})
      RETURNING id
    `
    
    const result = await sql.query(query, [...post_ids, is_candidate])

    return NextResponse.json({
      success: true,
      data: {
        updated_count: result.rows.length,
        updated_ids: result.rows.map((r: any) => r.id),
        is_candidate
      }
    })

  } catch (error) {
    console.error('Error updating candidates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update candidates'
    }, { status: 500 })
  }
}
