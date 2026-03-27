import { NextRequest, NextResponse } from 'next/server'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN |

// GET /api/apify-data?dataset_id=xxx
// Returns ALL fields from Apify for full export
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const datasetId = searchParams.get('dataset_id')
    const limit = parseInt(searchParams.get('limit') || '1000')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!datasetId) {
      return NextResponse.json({ error: 'dataset_id is required' }, { status: 400 })
    }
    
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}`,
      { cache: 'no-store' }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Apify dataset API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch scraped data' }, { status: 500 })
    }
    
    // Return raw data with ALL fields
    const data = await response.json()
    
    return NextResponse.json({
      posts: data,
      total: data.length,
      has_more: data.length === limit,
      // Include all unique field keys for export reference
      fields: data.length > 0 ? Object.keys(data[0]) : []
    })
    
  } catch (error) {
    console.error('Error fetching scraped data:', error)
    return NextResponse.json({ error: 'Failed to fetch scraped data' }, { status: 500 })
  }
}