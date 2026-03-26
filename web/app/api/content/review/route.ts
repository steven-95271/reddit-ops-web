import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/content/review?project_id=xxx&status=pending
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const contentType = request.nextUrl.searchParams.get('content_type');
    const personaId = request.nextUrl.searchParams.get('persona_id');
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }
    
    let query = sql`
      SELECT 
        cgt.*,
        p.name as persona_name,
        p.username as persona_username,
        p.avatar_emoji,
        p.avatar_color,
        sp.title as source_title,
        sp.subreddit as source_subreddit
      FROM content_generation_tasks cgt
      LEFT JOIN personas p ON cgt.persona_id = p.id
      LEFT JOIN scraped_posts sp ON cgt.source_content_id = sp.id
      WHERE cgt.project_id = ${projectId}
    `;
    
    if (status !== 'all') {
      query = sql`${query} AND cgt.human_approval_status = ${status}`;
    }
    
    if (contentType) {
      query = sql`${query} AND cgt.content_type = ${contentType}`;
    }
    
    if (personaId) {
      query = sql`${query} AND cgt.persona_id = ${personaId}`;
    }
    
    query = sql`${query} ORDER BY cgt.created_at DESC`;
    
    const result = await query;
    
    // 统计信息
    const statsResult = await sql`
      SELECT 
        human_approval_status,
        COUNT(*) as count
      FROM content_generation_tasks
      WHERE project_id = ${projectId}
      GROUP BY human_approval_status
    `;
    
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      published: 0,
    };
    
    for (const row of statsResult.rows) {
      stats[row.human_approval_status as keyof typeof stats] = parseInt(row.count);
    }
    
    return NextResponse.json({
      items: result.rows,
      stats,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching content for review:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

// PATCH /api/content/review - 更新审核状态
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      content_id, 
      action,  // 'approve' | 'reject' | 'edit'
      edited_title,
      edited_body,
      rejection_reason 
    } = body;
    
    if (!content_id || !action) {
      return NextResponse.json({ error: 'content_id and action required' }, { status: 400 });
    }
    
    let newStatus: string;
    let updateFields: any = {};
    
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        updateFields.rejection_reason = rejection_reason || '';
        break;
      case 'edit':
        newStatus = 'approved';
        updateFields.edited_title = edited_title;
        updateFields.edited_body = edited_body;
        updateFields.was_edited = true;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // 构建动态SQL
    let setClause = `human_approval_status = '${newStatus}', reviewed_at = '${new Date().toISOString()}'`;
    
    if (updateFields.edited_title) {
      setClause += `, generated_title = '${updateFields.edited_title.replace(/'/g, "''")}'`;
    }
    if (updateFields.edited_body) {
      setClause += `, generated_body = '${updateFields.edited_body.replace(/'/g, "''")}'`;
    }
    if (updateFields.was_edited) {
      setClause += `, was_edited = true`;
    }
    if (updateFields.rejection_reason) {
      setClause += `, rejection_reason = '${updateFields.rejection_reason.replace(/'/g, "''")}'`;
    }
    
    await sql`
      UPDATE content_generation_tasks 
      SET ${sql.unsafe(setClause)}
      WHERE id = ${content_id}
    `;
    
    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '内容已批准' : 
               action === 'reject' ? '内容已拒绝' : '内容已编辑并批准',
      content_id,
      new_status: newStatus,
    });
  } catch (error) {
    console.error('Error updating content status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

// POST /api/content/review/batch - 批量操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_ids, action } = body;
    
    if (!content_ids || !Array.isArray(content_ids) || content_ids.length === 0) {
      return NextResponse.json({ error: 'content_ids array required' }, { status: 400 });
    }
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const reviewedAt = new Date().toISOString();
    
    // 批量更新
    for (const contentId of content_ids) {
      await sql`
        UPDATE content_generation_tasks 
        SET human_approval_status = ${newStatus}, reviewed_at = ${reviewedAt}
        WHERE id = ${contentId}
      `;
    }
    
    return NextResponse.json({
      success: true,
      message: `已${action === 'approve' ? '批准' : '拒绝'} ${content_ids.length} 条内容`,
      processed_count: content_ids.length,
    });
  } catch (error) {
    console.error('Error batch updating content:', error);
    return NextResponse.json({ error: 'Failed to batch update' }, { status: 500 });
  }
}
