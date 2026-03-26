import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { PERSONA_TEMPLATES } from '@/lib/persona-templates';

// GET /api/personas/templates
export async function GET(request: NextRequest) {
  try {
    const roleType = request.nextUrl.searchParams.get('role_type');
    
    let templates = PERSONA_TEMPLATES;
    
    // 如果指定了角色类型，筛选模板
    if (roleType) {
      templates = templates.filter(t => t.role_type === roleType);
    }
    
    // 返回简化的模板信息
    const simplifiedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      role_type: t.role_type,
      content_strategy_summary: {
        post_frequency: t.content_strategy.post.frequency,
        primary_tone: t.content_strategy.post.style_config.tone,
        comment_style: t.content_strategy.comment.content_style.contribution_type,
      }
    }));
    
    return NextResponse.json({
      templates: simplifiedTemplates,
      recommended_combo: ['tech_expert', 'casual_user', 'skeptical_buyer', 'newcomer'],
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/personas/templates/generate-set
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      project_info,
      use_prototype,
      prototype_url,
      selected_templates = []
    } = body;
    
    if (!project_info || !project_info.product_name) {
      return NextResponse.json({ error: 'project_info required' }, { status: 400 });
    }
    
    // 动态导入生成器（避免服务端问题）
    const { generateRecommendedPersonaSet, generatePersonaFromTemplate } = await import('@/lib/persona-generator');
    const { analyzeRedditProfile } = await import('@/lib/persona-analyzer');
    
    let personas = [];
    
    if (use_prototype && prototype_url) {
      // 基于标杆账号生成
      const analysis = await analyzeRedditProfile(prototype_url);
      personas = await generateRecommendedPersonaSet(project_info, analysis);
    } else if (selected_templates.length > 0) {
      // 基于选定模板生成
      for (const templateId of selected_templates) {
        const persona = await generatePersonaFromTemplate(templateId, project_info);
        personas.push(persona);
      }
    } else {
      // 使用默认推荐组合
      personas = await generateRecommendedPersonaSet(project_info);
    }
    
    return NextResponse.json({
      success: true,
      generated_count: personas.length,
      personas: personas.map(p => ({
        name: p.name,
        username: p.username,
        role_type: p.role_type,
        description: p.description,
        content_strategy_preview: {
          post_frequency: p.content_strategy.post.frequency,
          primary_tone: p.content_strategy.post.style_config.tone,
          comment_style: p.content_strategy.comment.content_style.contribution_type,
        },
        full_config: p,  // 完整配置供保存使用
      })),
    });
  } catch (error) {
    console.error('Error generating persona set:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate personas' 
    }, { status: 500 });
  }
}
