import { initDb } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[Init API] Starting database initialization...')
    await initDb()
    console.log('[Init API] Database initialization complete')
    return NextResponse.json({ success: true, message: 'Database initialized' })
  } catch (error: any) {
    console.error('[Init API] Failed:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
