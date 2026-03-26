import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const result = await sql`SELECT * FROM projects ORDER BY created_at ASC`
    const projects = result.rows.map(row => ({
      ...row,
      subreddits: row.subreddits ? JSON.parse(row.subreddits) : []
    }))
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, background_info, search_query, subreddits, auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone } = body

    const id = randomUUID()
    const subredditsStr = JSON.stringify(subreddits || [])

    await sql`
      INSERT INTO projects (id, name, background_info, search_query, subreddits, auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone, created_at)
      VALUES (${id}, ${name || 'New Project'}, ${background_info || ''}, ${search_query || 'open ear earbuds'}, ${subredditsStr}, ${auto_scrape_enabled || 0}, ${scrape_schedule_time || '09:00'}, ${scrape_schedule_timezone || 'Asia/Shanghai'}, ${new Date().toISOString()})
    `

    return NextResponse.json({ ok: true, project_id: id })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}