import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/publish?project_id=xxx
export async function GET(request: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'project_id query parameter is required'
      }, { status: 400 })
    }

    // 获取待发布内容（status = approved）
    const approvedResult = await sql`
      SELECT c.*, 
             p.name as persona_name, 
             p.avatar_emoji as persona_emoji,
             c.title as content_title,
             c.body as content_body,
             c.body_edited as content_body_edited
      FROM contents c
      LEFT JOIN personas p ON c.persona_id = p.id
      WHERE c.project_id = ${projectId}
        AND c.status = 'approved'
      ORDER BY c.updated_at DESC
    `

    // 获取已发布内容（从 publish_log 关联）
    const publishedResult = await sql`
      SELECT pl.*, 
             c.title as content_title,
             c.body as content_body,
             c.body_edited as content_body_edited,
             p.name as persona_name, 
             p.avatar_emoji as persona_emoji,
             c.content_mode
      FROM publish_log pl
      LEFT JOIN contents c ON pl.content_id = c.id
      LEFT JOIN personas p ON c.persona_id = p.id
      WHERE c.project_id = ${projectId}
      ORDER BY pl.published_at DESC
    `

    return NextResponse.json({
      success: true,
      data: {
        pending: approvedResult.rows.map((row: any) => ({
          ...row,
          content_body: row.content_body_edited || row.content_body,
        })),
        published: publishedResult.rows,
      }
    })

  } catch (error) {
    console.error('Error fetching publish data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch publish data'
    }, { status: 500 })
  }
}

// POST /api/publish — 标记内容为已发布
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const { content_id, published_url } = body

    if (!content_id) {
      return NextResponse.json({
        success: false,
        error: 'content_id is required'
      }, { status: 400 })
    }

    // 获取内容信息
    const contentResult = await sql`SELECT * FROM contents WHERE id = ${content_id}`
    if (contentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    // 更新内容状态为 published
    await sql`
      UPDATE contents
      SET status = 'published', published_at = CURRENT_TIMESTAMP
      WHERE id = ${content_id}
    `

    // 创建发布记录
    const publishId = `publish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await sql`
      INSERT INTO publish_log (id, content_id, published_url, status, published_at, last_tracked_at)
      VALUES (${publishId}, ${content_id}, ${published_url || null}, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({
      success: true,
      data: {
        id: publishId,
        content_id,
        published_url,
        status: 'published',
      }
    })

  } catch (error) {
    console.error('Error publishing content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish content'
    }, { status: 500 })
  }
}
