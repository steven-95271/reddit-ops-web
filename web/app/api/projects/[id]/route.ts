import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const result = await sql`SELECT * FROM projects WHERE id = ${id}`
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = {
      ...result.rows[0],
      subreddits: result.rows[0].subreddits ? JSON.parse(result.rows[0].subreddits) : [],
      search_queries: result.rows[0].search_queries ? JSON.parse(result.rows[0].search_queries) : [],
      competitor_brands: result.rows[0].competitor_brands ? JSON.parse(result.rows[0].competitor_brands) : [],
      classification_keywords: result.rows[0].classification_keywords ? JSON.parse(result.rows[0].classification_keywords) : {}
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { 
      name, 
      background_info, 
      search_query, 
      subreddits, 
      search_queries,
      competitor_brands,
      classification_keywords,
      auto_scrape_enabled,
      scrape_schedule_time,
      scrape_schedule_timezone
    } = body

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (name !== undefined) {
      updates.push(`name = $${idx++}`)
      values.push(name)
    }
    if (background_info !== undefined) {
      updates.push(`background_info = $${idx++}`)
      values.push(background_info)
    }
    if (search_query !== undefined) {
      updates.push(`search_query = $${idx++}`)
      values.push(typeof search_query === 'string' ? search_query : JSON.stringify(search_query))
    }
    if (subreddits !== undefined) {
      updates.push(`subreddits = $${idx++}`)
      values.push(typeof subreddits === 'string' ? subreddits : JSON.stringify(subreddits))
    }
    if (search_queries !== undefined) {
      updates.push(`search_queries = $${idx++}`)
      values.push(typeof search_queries === 'string' ? search_queries : JSON.stringify(search_queries))
    }
    if (competitor_brands !== undefined) {
      updates.push(`competitor_brands = $${idx++}`)
      values.push(typeof competitor_brands === 'string' ? competitor_brands : JSON.stringify(competitor_brands))
    }
    if (classification_keywords !== undefined) {
      updates.push(`classification_keywords = $${idx++}`)
      values.push(typeof classification_keywords === 'string' ? classification_keywords : JSON.stringify(classification_keywords))
    }
    if (auto_scrape_enabled !== undefined) {
      updates.push(`auto_scrape_enabled = $${idx++}`)
      values.push(auto_scrape_enabled)
    }
    if (scrape_schedule_time !== undefined) {
      updates.push(`scrape_schedule_time = $${idx++}`)
      values.push(scrape_schedule_time)
    }
    if (scrape_schedule_timezone !== undefined) {
      updates.push(`scrape_schedule_timezone = $${idx++}`)
      values.push(scrape_schedule_timezone)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id)
    await sql.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    )

    return NextResponse.json({ ok: true, project_id: id })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}