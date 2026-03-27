import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { generateContent } from '@/lib/minimax'

// GET /api/projects/[id]/keywords?generate=true
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const generate = request.nextUrl.searchParams.get('generate') === 'true'
    
    // Get project info
    const projectResult = await sql`
      SELECT * FROM projects WHERE id = ${project_id} LIMIT 1
    `
    
    if (!projectResult.rows || projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    const project = projectResult.rows[0]
    
    // If generate=true, generate new keywords using AI
    if (generate) {
      const { product_name, background_info, category, target_audience } = project
      
      const systemPrompt = `You are an expert Reddit marketing strategist. Your task is to generate effective search keywords for Reddit scraping based on a product's background information.

Generate 8-12 search keywords/queries that would help find relevant Reddit discussions about this product.

Requirements:
1. Include variations of the product name
2. Include related use cases and pain points
3. Include competitor product names where relevant
4. Include different ways people might search or ask questions
5. Include relevant subreddits where this product might be discussed

Return ONLY a JSON array of keyword strings, nothing else. Example format:
["keyword 1", "keyword 2", "keyword 3"]`

      const userPrompt = `Product Name: ${product_name || 'N/A'}
Product Category: ${category || 'N/A'}
Target Audience: ${target_audience || 'N/A'}
Background Info: ${background_info || 'N/A'}

Generate search keywords for finding relevant Reddit discussions about this product.`

      try {
        const response = await generateContent(systemPrompt, userPrompt)
        
        // Parse JSON response
        let keywords: string[] = []
        try {
          // Try to parse as JSON array
          const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          keywords = JSON.parse(cleaned)
        } catch {
          // If JSON parsing fails, try to extract keywords from text
          const lines = response.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
          keywords = lines.slice(0, 12)
        }
        
        return NextResponse.json({
          keywords,
          generated: true
        })
      } catch (e) {
        console.error('Failed to generate keywords:', e)
        return NextResponse.json({ error: 'Failed to generate keywords' }, { status: 500 })
      }
    }
    
    // Return stored keywords if any
    return NextResponse.json({
      keywords: project.search_queries ? JSON.parse(project.search_queries) : [],
      generated: false
    })
    
  } catch (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 })
  }
}

// POST /api/projects/[id]/keywords - Save generated keywords
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const { keywords } = await request.json()
    
    await sql`
      UPDATE projects 
      SET search_queries = ${JSON.stringify(keywords)}
      WHERE id = ${project_id}
    `
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error saving keywords:', error)
    return NextResponse.json({ error: 'Failed to save keywords' }, { status: 500 })
  }
}