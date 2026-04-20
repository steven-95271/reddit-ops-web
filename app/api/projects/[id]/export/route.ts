import { NextRequest, NextResponse } from 'next/server'
import { utils, write } from 'xlsx'
import { initDb, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initDb()
    const { id } = params
    const format = new URL(request.url).searchParams.get('format') || 'json'

    if (!['json', 'xlsx'].includes(format)) {
      return NextResponse.json({ success: false, error: 'format must be json or xlsx' }, { status: 400 })
    }

    const projectResult = await sql`
      SELECT * FROM projects WHERE id = ${id} LIMIT 1
    `
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const row = projectResult.rows[0]
    const brandNames = row.brand_names ? (typeof row.brand_names === 'string' ? JSON.parse(row.brand_names) : row.brand_names) : []
    const competitorBrands = row.competitor_brands ? (typeof row.competitor_brands === 'string' ? JSON.parse(row.competitor_brands) : row.competitor_brands) : []
    const keywords = row.keywords ? (typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords) : {}

    const exportData = {
      project: {
        name: row.name,
        product_name: row.product_name,
        product_description: row.product_description,
        target_audience: row.target_audience,
        brand_names: brandNames,
        competitor_brands: competitorBrands,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      keywords,
      exported_at: new Date().toISOString(),
    }

    const safeName = (row.name || row.product_name || 'project').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')
    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
      const jsonStr = JSON.stringify(exportData, null, 2)
      return new NextResponse(jsonStr, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}_P1配置_${dateStr}.json"`,
        },
      })
    }

    // XLSX: 3 sheets
    const wb = utils.book_new()

    // Sheet 1: 项目信息
    const infoRows = [
      { key: '项目名称', value: row.name },
      { key: '产品名称', value: row.product_name },
      { key: '产品描述', value: row.product_description },
      { key: '目标受众', value: row.target_audience },
      { key: '自有品牌', value: brandNames.join(', ') },
      { key: '竞品品牌', value: competitorBrands.join(', ') },
      { key: '种子关键词', value: (keywords.seed || []).join(', ') },
      { key: '创建时间', value: row.created_at },
      { key: '更新时间', value: row.updated_at },
    ]
    utils.book_append_sheet(wb, utils.json_to_sheet(infoRows), '项目信息')

    // Sheet 2: 关键词方案
    const kwRows: Array<{ Phase: string; 关键词: string; 生成理由: string }> = []
    const phases = ['phase1_brand', 'phase2_competitor', 'phase3_scene_pain'] as const
    const phaseNames: Record<string, string> = {
      phase1_brand: 'Phase 1 品牌词',
      phase2_competitor: 'Phase 2 竞品词',
      phase3_scene_pain: 'Phase 3 场景词',
    }
    for (const phase of phases) {
      const data = keywords[phase]
      if (data?.queries) {
        for (const q of data.queries) {
          kwRows.push({ Phase: phaseNames[phase], 关键词: q, 生成理由: data.description || '' })
        }
      }
    }
    utils.book_append_sheet(wb, utils.json_to_sheet(kwRows), '关键词方案')

    // Sheet 3: Subreddit 推荐
    const subRows: Array<{ Subreddit: string; 相关度: string; 推荐理由: string; 定向搜索词: string }> = []
    const p4 = keywords.phase4_subreddits
    if (p4?.targets) {
      for (const t of p4.targets) {
        subRows.push({
          Subreddit: t.subreddit,
          相关度: t.relevance || '',
          推荐理由: t.reason || '',
          定向搜索词: (t.search_within || []).join(', '),
        })
      }
    }
    utils.book_append_sheet(wb, utils.json_to_sheet(subRows), 'Subreddit推荐')

    const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}_P1配置_${dateStr}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/export] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    }, { status: 500 })
  }
}
