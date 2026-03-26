import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone } = body

    const updates: string[] = []
    const values: any[] = []

    if (auto_scrape_enabled !== undefined) {
      updates.push('auto_scrape_enabled = ?')
      values.push(auto_scrape_enabled ? 1 : 0)
    }
    if (scrape_schedule_time !== undefined) {
      updates.push('scrape_schedule_time = ?')
      values.push(scrape_schedule_time)
    }
    if (scrape_schedule_timezone !== undefined) {
      updates.push('scrape_schedule_timezone = ?')
      values.push(scrape_schedule_timezone)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(id)

    await sql`
      UPDATE projects 
      SET auto_scrape_enabled = ${auto_scrape_enabled ? 1 : 0},
          scrape_schedule_time = ${scrape_schedule_time || '09:00'},
          scrape_schedule_timezone = ${scrape_schedule_timezone || 'Asia/Shanghai'}
      WHERE id = ${id}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating scrape settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const result = await sql`SELECT auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone FROM projects WHERE id = ${id}`
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const row = result.rows[0]
    return NextResponse.json({
      auto_scrape_enabled: Boolean(row.auto_scrape_enabled),
      scrape_schedule_time: row.scrape_schedule_time || '09:00',
      scrape_schedule_timezone: row.scrape_schedule_timezone || 'Asia/Shanghai'
    })
  } catch (error) {
    console.error('Error fetching scrape settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}