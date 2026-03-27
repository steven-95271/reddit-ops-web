import { NextResponse } from 'next/server'
import { initDb, migrateDb } from '@/lib/db'

export async function POST() {
  try {
    console.log('Running database initialization...')
    await initDb()
    
    console.log('Running database migrations...')
    await migrateDb()
    
    return NextResponse.json({
      ok: true,
      message: 'Database initialized and migrated successfully'
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Migration failed',
      details: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    await migrateDb()
    return NextResponse.json({
      ok: true,
      message: 'Migration check completed'
    })
  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Migration check failed',
      details: String(error)
    }, { status: 500 })
  }
}