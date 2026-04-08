import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Post ID is required'
      }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body // 'candidate' | 'unmark' | 'ignore' | 'unignore'

    let result
    switch (action) {
      case 'candidate':
        result = await sql`
          UPDATE posts 
          SET is_candidate = TRUE, ignored = FALSE, candidate_marked_at = NOW()
          WHERE id = ${id}
          RETURNING id, is_candidate, ignored
        `
        break
      case 'unmark':
        result = await sql`
          UPDATE posts 
          SET is_candidate = FALSE, candidate_marked_at = NULL
          WHERE id = ${id}
          RETURNING id, is_candidate, ignored
        `
        break
      case 'ignore':
        result = await sql`
          UPDATE posts 
          SET ignored = TRUE, is_candidate = FALSE
          WHERE id = ${id}
          RETURNING id, is_candidate, ignored
        `
        break
      case 'unignore':
        result = await sql`
          UPDATE posts 
          SET ignored = FALSE
          WHERE id = ${id}
          RETURNING id, is_candidate, ignored
        `
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

    if (!result || result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Post not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error updating post:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update post'
    }, { status: 500 })
  }
}