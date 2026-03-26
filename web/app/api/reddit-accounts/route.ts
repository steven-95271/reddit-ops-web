import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/reddit-accounts?project_id=xxx
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }
    
    const result = await sql`
      SELECT 
        ra.*,
        p.name as persona_name,
        p.avatar_emoji,
        p.avatar_color
      FROM reddit_accounts ra
      LEFT JOIN personas p ON ra.id = p.reddit_account_id
      WHERE ra.project_id = ${projectId}
      ORDER BY ra.created_at DESC
    `;
    
    return NextResponse.json({ 
      accounts: result.rows.map(row => ({
        ...row,
        bound_persona: row.persona_name ? {
          name: row.persona_name,
          emoji: row.avatar_emoji,
          color: row.avatar_color,
        } : null,
      }))
    });
  } catch (error) {
    console.error('Error fetching Reddit accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST /api/reddit-accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      project_id, 
      username, 
      email, 
      password,
      proxy_config,
      persona_bindings = [] 
    } = body;
    
    if (!project_id || !username) {
      return NextResponse.json({ error: 'project_id and username required' }, { status: 400 });
    }
    
    const accountId = randomUUID();
    
    await sql`
      INSERT INTO reddit_accounts (
        id, project_id, username, email, password_encrypted,
        proxy_config, karma_post, karma_comment, account_status, created_at
      ) VALUES (
        ${accountId}, ${project_id}, ${username}, ${email || ''}, ${password || ''},
        ${JSON.stringify(proxy_config || {})}, 0, 0, 'active', ${new Date().toISOString()}
      )
    `;
    
    // 绑定人设
    if (persona_bindings.length > 0) {
      for (const personaId of persona_bindings) {
        await sql`
          UPDATE personas 
          SET reddit_account_id = ${accountId}
          WHERE id = ${personaId} AND project_id = ${project_id}
        `;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      account_id: accountId,
      message: 'Reddit账号创建成功'
    });
  } catch (error) {
    console.error('Error creating Reddit account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// DELETE /api/reddit-accounts?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    
    // 解除与人设的绑定
    await sql`UPDATE personas SET reddit_account_id = NULL WHERE reddit_account_id = ${id}`;
    
    // 删除账号
    await sql`DELETE FROM reddit_accounts WHERE id = ${id}`;
    
    return NextResponse.json({ success: true, message: '账号已删除' });
  } catch (error) {
    console.error('Error deleting Reddit account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
