import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const body = await request.json()
    const {
      name, username, emoji, color, description, description_en,
      background, tone, writing_style, focus, post_types, platform
    } = body

    const personaId = randomUUID()
    const focusStr = JSON.stringify(focus || [])
    const postTypesStr = JSON.stringify(post_types || [])

    await sql`
      INSERT INTO personas (id, project_id, name, username, avatar_emoji, avatar_color, description, description_en, background, tone, focus, writing_style, post_types, platform, created_at)
      VALUES (${personaId}, ${project_id}, ${name || 'New Persona'}, ${username || 'u/new_persona'}, ${emoji || '👤'}, ${color || '#888888'}, ${description || ''}, ${description_en || ''}, ${background || ''}, ${tone || ''}, ${focusStr}, ${writing_style || ''}, ${postTypesStr}, ${platform || 'Reddit'}, ${new Date().toISOString()})
    `

    return NextResponse.json({ ok: true, persona_id: personaId })
  } catch (error) {
    console.error('Error creating persona:', error)
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
  }
}