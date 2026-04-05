import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/stats?project_id=xxx（project_id 可选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    // 项目总数
    const projectsResult = await sql`SELECT COUNT(*) as count FROM projects`
    const totalProjects = parseInt(projectsResult.rows[0].count)

    let whereClause = ''
    let values: any[] = []

    if (projectId) {
      whereClause = 'WHERE project_id = $1'
      values = [projectId]
    }

    // 总帖子数
    const postsResult = await sql.query(
      `SELECT COUNT(*) as count FROM posts ${whereClause}`,
      values
    )
    const totalPosts = parseInt(postsResult.rows[0].count)

    // 候选帖数
    const candidatesResult = await sql.query(
      `SELECT COUNT(*) as count FROM posts ${whereClause.replace('WHERE', 'WHERE is_candidate = true AND') || 'WHERE is_candidate = true'}`,
      values
    )
    const totalCandidates = parseInt(candidatesResult.rows[0].count)

    // 已生成内容数
    const contentsResult = await sql.query(
      `SELECT COUNT(*) as count FROM contents ${whereClause}`,
      values
    )
    const totalContents = parseInt(contentsResult.rows[0].count)

    // 各状态内容数
    const statusResult = await sql.query(
      `SELECT status, COUNT(*) as count FROM contents ${whereClause} GROUP BY status`,
      values
    )
    const statusCounts: Record<string, number> = { draft: 0, approved: 0, published: 0, rejected: 0 }
    statusResult.rows.forEach((row: any) => {
      statusCounts[row.status] = parseInt(row.count)
    })

    // 已发布数（从 publish_log）
    let publishWhereClause = ''
    let publishValues: any[] = []
    if (projectId) {
      publishWhereClause = 'WHERE c.project_id = $1'
      publishValues = [projectId]
    }
    const publishedResult = await sql.query(
      `SELECT COUNT(*) as count FROM publish_log pl 
       LEFT JOIN contents c ON pl.content_id = c.id 
       ${publishWhereClause}`,
      publishValues
    )
    const totalPublished = parseInt(publishedResult.rows[0].count)

    // 总 upvotes 和 replies
    const engagementResult = await sql.query(
      `SELECT COALESCE(SUM(upvotes), 0) as total_upvotes, COALESCE(SUM(replies), 0) as total_replies 
       FROM publish_log pl 
       LEFT JOIN contents c ON pl.content_id = c.id 
       ${publishWhereClause}`,
      publishValues
    )
    const totalUpvotes = parseInt(engagementResult.rows[0].total_upvotes) || 0
    const totalReplies = parseInt(engagementResult.rows[0].total_replies) || 0

    // 各等级分布
    const gradeResult = await sql.query(
      `SELECT 
         CASE 
           WHEN composite_score >= 0.8 THEN 'S'
           WHEN composite_score >= 0.6 THEN 'A'
           WHEN composite_score >= 0.4 THEN 'B'
           ELSE 'C'
         END as grade,
         COUNT(*) as count
       FROM posts 
       ${whereClause}
       GROUP BY grade`,
      values
    )
    const gradeStats: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 }
    gradeResult.rows.forEach((row: any) => {
      gradeStats[row.grade] = parseInt(row.count)
    })

    // 各分类分布
    const categoryResult = await sql.query(
      `SELECT category, COUNT(*) as count FROM posts ${whereClause} GROUP BY category`,
      values
    )
    const categoryStats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    categoryResult.rows.forEach((row: any) => {
      if (row.category && categoryStats[row.category] !== undefined) {
        categoryStats[row.category] = parseInt(row.count)
      }
    })

    // 获取各项目进度（如果查全局统计）
    let projectProgress: any[] = []
    if (!projectId) {
      const projectsListResult = await sql`SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 10`
      for (const project of projectsListResult.rows) {
        const projectStats = await sql`
          SELECT 
            (SELECT COUNT(*) FROM posts WHERE project_id = ${project.id}) as total_posts,
            (SELECT COUNT(*) FROM posts WHERE project_id = ${project.id} AND is_candidate = true) as candidates,
            (SELECT COUNT(*) FROM contents WHERE project_id = ${project.id}) as total_contents,
            (SELECT COUNT(*) FROM contents WHERE project_id = ${project.id} AND status = 'approved') as approved,
            (SELECT COUNT(*) FROM publish_log pl LEFT JOIN contents c ON pl.content_id = c.id WHERE c.project_id = ${project.id}) as published
        `
        projectProgress.push({
          id: project.id,
          name: project.name,
          stats: projectStats.rows[0],
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total_projects: totalProjects,
        total_posts: totalPosts,
        total_candidates: totalCandidates,
        total_contents: totalContents,
        status_counts: statusCounts,
        total_published: totalPublished,
        total_upvotes: totalUpvotes,
        total_replies: totalReplies,
        total_engagement: totalUpvotes + totalReplies,
        grade_stats: gradeStats,
        category_stats: categoryStats,
        project_progress: projectProgress,
      }
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats'
    }, { status: 500 })
  }
}
