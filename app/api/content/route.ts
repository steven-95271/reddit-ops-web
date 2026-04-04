import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    const date = request.nextUrl.searchParams.get('date')

    if (!projectId || !date) {
      return NextResponse.json({ error: 'project_id and date required' }, { status: 400 })
    }

    // Return empty content structure
    return NextResponse.json({
      date,
      method: 'unknown',
      total: 0,
      content: []
    })
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}