import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generatePost, generateComment, batchGeneratePosts, batchGenerateComments } from '@/lib/content-generator';
import { randomUUID } from 'crypto';

// POST /api/content/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      project_id,
      persona_id,
      content_type,  // 'post' | 'comment'
      source_content_id,
      count = 1,
      options = {}
    } = body;
    
    if (!project_id || !persona_id || !content_type) {
      return NextResponse.json({ 
        error: 'project_id, persona_id, and content_type required' 
      }, { status: 400 });
    }
    
    // 获取人设详情
    const personaResult = await sql`
      SELECT * FROM personas WHERE id = ${persona_id} AND project_id = ${project_id}
    `;
    
    if (personaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    
    const persona = personaResult.rows[0];
    persona.content_strategy = JSON.parse(persona.content_strategy || '{}');
    persona.generation_config = JSON.parse(persona.generation_config || '{}');
    
    // 获取项目信息
    const projectResult = await sql`
      SELECT name, search_query FROM projects WHERE id = ${project_id}
    `;
    const project = projectResult.rows[0];
    
    const projectInfo = {
      product_name: project.name,
      key_benefits: project.search_query ? project.search_query.split(',').map((s: string) => s.trim()) : [],
      use_cases: []
    };
    
    const generatedItems = [];
    
    if (content_type === 'post') {
      // 获取源内容
      let sources = [];
      if (source_content_id) {
        const sourceResult = await sql`
          SELECT * FROM scraped_posts WHERE id = ${source_content_id}
        `;
        sources = sourceResult.rows;
      } else {
        // 获取最近的热门内容
        const sourcesResult = await sql`
          SELECT * FROM scraped_posts 
          WHERE project_id = ${project_id}
          ORDER BY score DESC 
          LIMIT ${count}
        `;
        sources = sourcesResult.rows;
      }
      
      // 批量生成帖子
      for (let i = 0; i < Math.min(count, sources.length); i++) {
        const source = sources[i];
        const post = await generatePost(
          persona,
          {
            id: source.id,
            title: source.title,
            selftext: source.selftext || '',
            subreddit: source.subreddit,
            score: source.score || 0,
          },
          projectInfo,
          options
        );
        
        // 保存到数据库
        const contentId = randomUUID();
        await sql`
          INSERT INTO content_generation_tasks (
            id, project_id, persona_id, content_type, source_content_id,
            generated_title, generated_body, brand_mention_score, authenticity_score,
            human_approval_status, created_at
          ) VALUES (
            ${contentId}, ${project_id}, ${persona_id}, 'post', ${source.id},
            ${post.title}, ${post.body}, ${post.brand_mention_score}, ${post.authenticity_score},
            'pending', ${new Date().toISOString()}
          )
        `;
        
        generatedItems.push({
          id: contentId,
          ...post,
          status: 'pending'
        });
      }
    } else if (content_type === 'comment') {
      // 生成评论
      // TODO: 获取目标帖子和评论上下文
      generatedItems.push({
        message: '评论生成功能需要目标帖子上下文'
      });
    }
    
    return NextResponse.json({
      success: true,
      generated_count: generatedItems.length,
      items: generatedItems,
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate content' 
    }, { status: 500 });
  }
}
