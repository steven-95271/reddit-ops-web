import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

// GET /api/projects/[id]/personas - List personas for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    
    const result = await sql`
      SELECT 
        p.*,
        ra.username as reddit_account_username
      FROM personas p
      LEFT JOIN reddit_accounts ra ON p.reddit_account_id = ra.id
      WHERE p.project_id = ${project_id}
      ORDER BY p.created_at DESC
    `
    
    return NextResponse.json({ personas: result.rows })
  } catch (error) {
    console.error('Error fetching personas:', error)
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 })
  }
}

// POST /api/projects/[id]/personas - Create persona
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const body = await request.json()
    const {
      name, username, emoji, color, description, description_en,
      background, tone, writing_style, focus, post_types, platform,
      reddit_account_id, role_type, brand_integration_level, content_strategy,
      full_config
    } = body

    const personaId = randomUUID()
    const focusStr = JSON.stringify(focus || [])
    const postTypesStr = JSON.stringify(post_types || [])
    const contentStrategyStr = content_strategy ? JSON.stringify(content_strategy) : null
    const fullConfigStr = full_config ? JSON.stringify(full_config) : null

    await sql`
      INSERT INTO personas (
        id, project_id, reddit_account_id, name, username, 
        avatar_emoji, avatar_color, description, description_en, 
        background, tone, writing_style, focus, writing_style, post_types, 
        platform, role_type, brand_integration_level, content_strategy,
        generation_config, created_at
      ) VALUES (
        ${personaId}, ${project_id}, ${reddit_account_id || null}, 
        ${name || 'New Persona'}, ${username || 'u/new_persona'}, 
        ${emoji || '👤'}, ${color || '#888888'}, ${description || ''}, ${description_en || ''}, 
        ${background || ''}, ${tone || ''}, ${writing_style || ''}, ${focusStr}, 
        ${writing_style || ''}, ${postTypesStr}, ${platform || 'Reddit'}, 
        ${role_type || 'casual_user'}, ${brand_integration_level || 'subtle'}, 
        ${contentStrategyStr}, ${fullConfigStr}, ${new Date().toISOString()}
      )
    `

    return NextResponse.json({ ok: true, persona_id: personaId })
  } catch (error) {
    console.error('Error creating persona:', error)
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
  }
}