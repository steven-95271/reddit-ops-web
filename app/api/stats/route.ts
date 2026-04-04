import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id')
    const date = request.nextUrl.searchParams.get('date')

    if (!projectId || !date) {
      return NextResponse.json({ error: 'project_id and date required' }, { status: 400 })
    }

    // Return stats structure
    return NextResponse.json({
      total_posts: 0,
      total_candidates: 0,
      total_content: 0,
      approved: 0,
      published: 0,
      category_counts: {},
      is_mock: true
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}