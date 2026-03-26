import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Received Apify webhook:', body)

    const actorId = body.actorId || ''
    const runId = body.runId || ''
    const status = body.status || ''
    const datasetId = body.defaultDatasetId || ''

    if (!actorId.toLowerCase().includes('reddit-scraper')) {
      return NextResponse.json({ error: 'Not a reddit-scraper run' }, { status: 400 })
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ error: `Run not succeeded: ${status}` }, { status: 400 })
    }

    // In production, you would:
    // 1. Fetch the dataset from Apify using the datasetId
    // 2. Process and store the posts
    // 3. Run the classification pipeline
    // 4. Generate content with MiniMax

    return NextResponse.json({
      ok: true,
      message: 'Webhook received',
      run_id: runId,
      dataset_id: datasetId
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}