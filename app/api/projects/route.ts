import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

// GET /api/projects - 返回所有项目列表
export async function GET() {
  try {
    const result = await sql`SELECT * FROM projects ORDER BY created_at DESC`
    
    // 解析 JSON 字段
    const projects = result.rows.map(row => ({
      ...row,
      brand_names: row.brand_names ? JSON.parse(row.brand_names) : [],
      competitor_brands: row.competitor_brands ? JSON.parse(row.competitor_brands) : [],
      keywords: row.keywords ? JSON.parse(row.keywords) : {},
      subreddits: row.subreddits ? JSON.parse(row.subreddits) : []
    }))

    return NextResponse.json({ 
      success: true, 
      data: projects 
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch projects' 
    }, { status: 500 })
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      product_name, 
      product_description, 
      target_audience, 
      brand_names, 
      competitor_brands, 
      seed_keywords 
    } = body

    // 必填字段验证
    if (!name || !product_name) {
      return NextResponse.json({ 
        success: false, 
        error: '项目名称和产品名称为必填项' 
      }, { status: 400 })
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    
    // 将数组转换为 JSON 字符串存储
    const brandNamesStr = JSON.stringify(brand_names || [])
    const competitorBrandsStr = JSON.stringify(competitor_brands || [])
    const keywordsStr = JSON.stringify({ seed: seed_keywords || [] })
    const subredditsStr = JSON.stringify([])

    await sql`
      INSERT INTO projects (
        id, 
        name, 
        product_name, 
        product_description, 
        target_audience, 
        brand_names, 
        competitor_brands, 
        keywords, 
        subreddits, 
        status, 
        created_at, 
        updated_at
      )
      VALUES (
        ${id}, 
        ${name}, 
        ${product_name || ''}, 
        ${product_description || ''}, 
        ${target_audience || ''}, 
        ${brandNamesStr}, 
        ${competitorBrandsStr}, 
        ${keywordsStr}, 
        ${subredditsStr}, 
        'draft', 
        ${now}, 
        ${now}
      )
    `

    // 返回创建的项目
    const newProject = {
      id,
      name,
      product_name,
      product_description: product_description || '',
      target_audience: target_audience || '',
      brand_names: brand_names || [],
      competitor_brands: competitor_brands || [],
      keywords: { seed: seed_keywords || [] },
      subreddits: [],
      status: 'draft',
      created_at: now,
      updated_at: now
    }

    return NextResponse.json({ 
      success: true, 
      data: newProject 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create project' 
    }, { status: 500 })
  }
}
