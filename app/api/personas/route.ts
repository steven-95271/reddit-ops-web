import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    const result = await sql`SELECT * FROM personas WHERE project_id = ${projectId} ORDER BY created_at ASC`
    
    const personas = result.rows.map(row => ({
      ...row,
      focus: row.focus ? JSON.parse(row.focus) : [],
      post_types: row.post_types ? JSON.parse(row.post_types) : []
    }))

    return NextResponse.json({ personas })
  } catch (error) {
    console.error('Error fetching personas:', error)
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 })
  }
}