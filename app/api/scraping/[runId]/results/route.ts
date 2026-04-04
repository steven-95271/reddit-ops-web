import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getScrapingResults } from '@/lib/apify'

// POST /api/scraping/[runId]/results - 获取抓取结果并保存到数据库
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'runId is required'
      }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'project_id query parameter is required'
      }, { status: 400 })
    }

    // 验证项目是否存在
    const projectResult = await sql`SELECT id FROM projects WHERE id = ${projectId}`
    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // 获取抓取结果
    const results = await getScrapingResults(runId)

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          inserted: 0,
          skipped: 0
        }
      })
    }

    let inserted = 0
    let skipped = 0

    // 批量插入帖子数据（带去重）
    for (const post of results) {
      // 使用 post_id 作为唯一标识，如果没有则使用组合键
      const postId = post.post_id || `${post.subreddit}_${post.created_utc}_${post.title.slice(0, 50)}`

      try {
        // 检查是否已存在
        const existingResult = await sql`SELECT id FROM posts WHERE id = ${postId}`
        
        if (existingResult.rows.length > 0) {
          skipped++
          continue
        }

        // 插入新帖子
        await sql`
          INSERT INTO posts (
            id,
            project_id,
            subreddit,
            title,
            body,
            author,
            url,
            score,
            num_comments,
            created_utc,
            scraped_at
          )
          VALUES (
            ${postId},
            ${projectId},
            ${post.subreddit || ''},
            ${post.title || ''},
            ${post.body || ''},
            ${post.author || ''},
            ${post.url || ''},
            ${post.score || 0},
            ${post.num_comments || 0},
            ${post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString()},
            ${new Date().toISOString()}
          )
        `

        inserted++
      } catch (insertError) {
        console.error(`Error inserting post ${postId}:`, insertError)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        inserted,
        skipped
      }
    })

  } catch (error) {
    console.error('Error saving scraping results:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save scraping results'
    }, { status: 500 })
  }
}
