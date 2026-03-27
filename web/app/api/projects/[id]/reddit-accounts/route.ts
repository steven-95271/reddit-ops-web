import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

// GET /api/projects/[id]/reddit-accounts - List accounts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    
    const result = await sql`
      SELECT * FROM reddit_accounts 
      WHERE project_id = ${project_id}
      ORDER BY created_at DESC
    `
    
    return NextResponse.json({ accounts: result.rows })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// POST /api/projects/[id]/reddit-accounts - Create account
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: project_id } = params
    const body = await request.json()
    const { username, email, password_encrypted, proxy_config } = body

    const accountId = randomUUID()

    await sql`
      INSERT INTO reddit_accounts (
        id, project_id, username, email, password_encrypted, 
        proxy_config, account_status, created_at
      ) VALUES (
        ${accountId}, ${project_id}, ${username}, ${email || null}, 
        ${password_encrypted || null}, ${proxy_config || null}, 
        'active', ${new Date().toISOString()}
      )
    `

    return NextResponse.json({ ok: true, account_id: accountId })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}