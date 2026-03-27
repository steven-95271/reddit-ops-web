import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    const date = request.nextUrl.searchParams.get('date')
    const category = request.nextUrl.searchParams.get('category')
    const sortBy = request.nextUrl.searchParams.get('sort') || 'score'

    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    let query
    if (sortBy === 'score') {
      query = await sql`
        SELECT * FROM scraped_posts 
        WHERE project_id = ${projectId}
        ORDER BY score DESC
        LIMIT 100
      `
    } else {
      query = await sql`
        SELECT * FROM scraped_posts 
        WHERE project_id = ${projectId}
        ORDER BY created_utc DESC
        LIMIT 100
      `
    }

    const posts = query.rows.map(row => ({
      id: row.id,
      title: row.title,
      selftext: row.selftext,
      subreddit: row.subreddit,
      author: row.author,
      score: row.score,
      num_comments: row.num_comments,
      url: row.url,
      scraped_at: row.scraped_at
    }))

    const categoryCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 }

    return NextResponse.json({
      posts,
      total: posts.length,
      category_counts: categoryCounts,
      date: date || new Date().toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('Error fetching candidates:', error)
    return NextResponse.json({ 
      posts: [],
      total: 0,
      category_counts: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      error: 'Database not connected' 
    }, { status: 200 })
  }
}
