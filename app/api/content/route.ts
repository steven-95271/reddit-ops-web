import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'
import { checkContentQuality } from '@/lib/quality-check'

export const dynamic = 'force-dynamic'

// GET /api/content?project_id=xxx&status=draft&mode=reply_post
export async function GET(request: NextRequest) {
  try {
    await initDb()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')
    const mode = searchParams.get('mode')
    const personaId = searchParams.get('persona_id')

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'project_id query parameter is required'
      }, { status: 400 })
    }

    let query = `
      SELECT c.*, p.title as post_title, p.subreddit as post_subreddit,
             per.name as persona_name, per.avatar_emoji as persona_emoji
      FROM contents c
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN personas per ON c.persona_id = per.id
      WHERE c.project_id = $1
    `
    const values: any[] = [projectId]
    let paramIndex = 2

    if (status) {
      query += ` AND c.status = $${paramIndex}`
      values.push(status)
      paramIndex++
    }

    if (mode) {
      query += ` AND c.content_mode = $${paramIndex}`
      values.push(mode)
      paramIndex++
    }

    if (personaId) {
      query += ` AND c.persona_id = $${paramIndex}`
      values.push(personaId)
      paramIndex++
    }

    query += ` ORDER BY c.created_at DESC`

    const result = await sql.query(query, values)

    const contents = result.rows.map((row: any) => ({
      ...row,
      quality_issues: row.quality_issues ? JSON.parse(row.quality_issues) : [],
    }))

    return NextResponse.json({
      success: true,
      data: contents
    })

  } catch (error) {
    console.error('Error fetching contents:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contents'
    }, { status: 500 })
  }
}

// POST /api/content — 创建内容（手动）
export async function POST(request: NextRequest) {
  try {
    await initDb()
    const body = await request.json()
    const {
      project_id,
      post_id,
      persona_id,
      content_type,
      title,
      body: contentBody,
      content_mode,
      target_comment,
      user_idea,
      target_subreddit,
      post_type,
    } = body

    if (!project_id || !contentBody) {
      return NextResponse.json({
        success: false,
        error: 'project_id and body are required'
      }, { status: 400 })
    }

    const id = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 获取品牌名用于质量评分
    const projectResult = await sql`SELECT brand_names FROM projects WHERE id = ${project_id}`
    const brandNames = projectResult.rows.length > 0 && projectResult.rows[0].brand_names
      ? JSON.parse(projectResult.rows[0].brand_names)
      : []

    const qualityResult = checkContentQuality(contentBody, brandNames)

    await sql`
      INSERT INTO contents (
        id, project_id, post_id, persona_id, content_type, title, body,
        content_mode, target_comment, user_idea, target_subreddit, post_type,
        quality_score, quality_issues, status, updated_at
      ) VALUES (
        ${id}, ${project_id}, ${post_id || null}, ${persona_id || null},
        ${content_type || 'comment'}, ${title}, ${contentBody},
        ${content_mode || null}, ${target_comment || null}, ${user_idea || null},
        ${target_subreddit || null}, ${post_type || null},
        ${qualityResult.score}, ${JSON.stringify(qualityResult.issues)},
        'draft', CURRENT_TIMESTAMP
      )
    `

    return NextResponse.json({
      success: true,
      data: {
        id,
        quality_score: qualityResult.score,
        quality_issues: qualityResult.issues,
      }
    })

  } catch (error) {
    console.error('Error creating content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create content'
    }, { status: 500 })
  }
}
