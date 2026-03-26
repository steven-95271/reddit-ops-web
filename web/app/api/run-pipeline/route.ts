import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { use_mock = true, project_id } = body

    console.log(`Pipeline trigger (mock=${use_mock}) for project ${project_id}`)

    // In production, this would:
    // 1. Run the scraper (Apify or mock)
    // 2. Clean and classify posts
    // 3. Generate content with MiniMax
    // 4. Send notifications

    return NextResponse.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      steps: {
        scrape: { status: 'ok', posts: use_mock ? 5 : 0 },
        classify: { status: 'ok', candidates: use_mock ? 3 : 0 },
        generate: { status: 'ok', content_items: use_mock ? 6 : 0 }
      },
      use_mock
    })
  } catch (error) {
    console.error('Pipeline error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}