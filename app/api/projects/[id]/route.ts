import { NextRequest, NextResponse } from 'next/server'
import { initDb, sql } from '@/lib/db'

// GET /api/projects/[id] - 返回单个项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project ID is required' 
      }, { status: 400 })
    }

    const result = await sql`SELECT * FROM projects WHERE id = ${id}`
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 })
    }

    // 解析 JSON 字段
    const project = {
      ...result.rows[0],
      brand_names: result.rows[0].brand_names ? JSON.parse(result.rows[0].brand_names) : [],
      competitor_brands: result.rows[0].competitor_brands ? JSON.parse(result.rows[0].competitor_brands) : [],
      keywords: result.rows[0].keywords ? JSON.parse(result.rows[0].keywords) : {},
      subreddits: result.rows[0].subreddits ? JSON.parse(result.rows[0].subreddits) : []
    }

    return NextResponse.json({ 
      success: true, 
      data: project 
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch project' 
    }, { status: 500 })
  }
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project ID is required' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { 
      name, 
      product_name, 
      product_description, 
      target_audience, 
      brand_names, 
      competitor_brands, 
      seed_keywords,
      keywords, 
      subreddits, 
      status 
    } = body

    // 将 seed_keywords 合并到 keywords.seed（种子关键词只存在 keywords JSON 字段里）
    let keywordsToSave = keywords
    if (seed_keywords !== undefined) {
      keywordsToSave = {
        ...(keywords || {}),
        seed: seed_keywords
      }
    }

    // 检查项目是否存在
    const existingResult = await sql`SELECT id FROM projects WHERE id = ${id}`
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 })
    }

    const now = new Date().toISOString()
    
    // 将数组/对象转换为 JSON 字符串
    const brandNamesStr = brand_names !== undefined ? JSON.stringify(brand_names) : undefined
    const competitorBrandsStr = competitor_brands !== undefined ? JSON.stringify(competitor_brands) : undefined
    const keywordsStr = keywordsToSave !== undefined ? JSON.stringify(keywordsToSave) : undefined
    const subredditsStr = subreddits !== undefined ? JSON.stringify(subreddits) : undefined

    console.log('[API PUT] Updating project:', id)
    console.log('[API PUT] seed_keywords received:', seed_keywords)
    console.log('[API PUT] keywordsToSave:', keywordsToSave)

    // 动态构建更新语句
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (product_name !== undefined) {
      updates.push(`product_name = $${paramIndex++}`)
      values.push(product_name)
    }
    if (product_description !== undefined) {
      updates.push(`product_description = $${paramIndex++}`)
      values.push(product_description)
    }
    if (target_audience !== undefined) {
      updates.push(`target_audience = $${paramIndex++}`)
      values.push(target_audience)
    }
    if (brandNamesStr !== undefined) {
      updates.push(`brand_names = $${paramIndex++}`)
      values.push(brandNamesStr)
    }
    if (competitorBrandsStr !== undefined) {
      updates.push(`competitor_brands = $${paramIndex++}`)
      values.push(competitorBrandsStr)
    }
    if (keywordsStr !== undefined) {
      updates.push(`keywords = $${paramIndex++}`)
      values.push(keywordsStr)
    }
    if (subredditsStr !== undefined) {
      updates.push(`subreddits = $${paramIndex++}`)
      values.push(subredditsStr)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    
    // 始终更新 updated_at
    updates.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    
    // 添加 id 作为 WHERE 条件
    values.push(id)

    if (updates.length === 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'No fields to update' 
      }, { status: 400 })
    }

    // 使用原生 SQL 执行更新
    const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`
    console.log('[API PUT] Executing SQL:', query)
    console.log('[API PUT] SQL values:', values)
    await sql.query(query, values)

    // 获取更新后的项目
    const updatedResult = await sql`SELECT * FROM projects WHERE id = ${id}`
    console.log('[API PUT] Raw DB result keywords:', updatedResult.rows[0]?.keywords)
    
    const updatedProject = {
      ...updatedResult.rows[0],
      brand_names: updatedResult.rows[0].brand_names ? JSON.parse(updatedResult.rows[0].brand_names) : [],
      competitor_brands: updatedResult.rows[0].competitor_brands ? JSON.parse(updatedResult.rows[0].competitor_brands) : [],
      keywords: updatedResult.rows[0].keywords ? JSON.parse(updatedResult.rows[0].keywords) : {},
      subreddits: updatedResult.rows[0].subreddits ? JSON.parse(updatedResult.rows[0].subreddits) : []
    }
    
    console.log('[API PUT] Returning updated project keywords:', updatedProject.keywords)

    return NextResponse.json({ 
      success: true, 
      data: updatedProject 
    })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update project' 
    }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project ID is required' 
      }, { status: 400 })
    }

    // 检查项目是否存在
    const existingResult = await sql`SELECT id FROM projects WHERE id = ${id}`
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 })
    }

    await sql`DELETE FROM projects WHERE id = ${id}`

    return NextResponse.json({ 
      success: true, 
      data: { id, deleted: true }
    })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete project' 
    }, { status: 500 })
  }
}
