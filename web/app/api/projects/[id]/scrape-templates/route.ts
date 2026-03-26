import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

// GET /api/projects/[id]/scrape-templates
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    
    const result = await sql`
      SELECT * FROM scrape_templates 
      WHERE project_id = ${project_id} 
      ORDER BY created_at DESC
    `
    
    const templates = result.rows.map(row => ({
      ...row,
      template_config: row.template_config ? JSON.parse(row.template_config) : {}
    }))
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/projects/[id]/scrape-templates
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const body = await request.json()
    const { name, config } = body
    
    if (!name) {
      return NextResponse.json({ error: 'Template name required' }, { status: 400 })
    }
    
    const template_id = randomUUID()
    const config_str = JSON.stringify(config || {})
    
    await sql`
      INSERT INTO scrape_templates (id, project_id, name, template_config, created_at)
      VALUES (${template_id}, ${project_id}, ${name}, ${config_str}, ${new Date().toISOString()})
    `
    
    return NextResponse.json({ ok: true, template_id })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}