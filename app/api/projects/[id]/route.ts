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
      subreddits: result.rows[0].subreddits ? JSON.parse(result.rows[0].subreddits) : []
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}